const { FieldPath, FieldValue } = require('firebase-admin/firestore')
const { updateFinancialYearProjection } = require('../domain/financial-year')
const { currentMonth, currentYear } = require('./financial-years')

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
]

const sectionDefinitions = {
  assets: { collection: 'modelAssets', result: 'asset' },
  liabilities: { collection: 'modelLiabilities', result: 'liability' },
  income: { collection: 'modelIncome', result: 'income' },
  expenses: { collection: 'modelExpenses', result: 'expense' },
}

async function mutateFinancialModel(
  firestore,
  { workspaceId, userId, section, operation, itemId = null, item = null, categoryId = null },
) {
  assertText(workspaceId, 'A workspace is required')
  assertText(userId, 'Authentication is required')
  const definition = sectionDefinitions[section]
  if (!definition) throw new Error('A valid financial section is required')
  if (!['create', 'update', 'delete', 'deleteCategory'].includes(operation)) {
    throw new Error('A valid model operation is required')
  }

  const year = currentYear()
  const month = currentMonth()
  const workspaceReference = firestore.collection('workspaces').doc(workspaceId)
  const configReference = workspaceReference.collection('modelConfig').doc(section)
  const itemsReference = workspaceReference.collection(definition.collection)
  const financialYearReference = workspaceReference.collection('financialYears').doc(String(year))
  const requestedItem = operation === 'create' ? normalizeItem(section, item) : null
  const itemReference = resolveItemReference(
    itemsReference,
    section,
    operation,
    itemId,
    requestedItem,
  )

  return firestore.runTransaction(async (transaction) => {
    const [workspaceSnapshot, configSnapshot, financialYearSnapshot] = await Promise.all([
      transaction.get(workspaceReference),
      transaction.get(configReference),
      transaction.get(financialYearReference),
    ])
    const workspace = assertWorkspaceAccess(workspaceSnapshot, userId)
    if (!financialYearSnapshot.exists || !financialYearSnapshot.data()?.totals) {
      throw new Error('The current financial year must exist before changing the financial model')
    }

    const config = configSnapshot.data() || { categories: {} }
    const itemSnapshot = itemReference ? await transaction.get(itemReference) : null
    const reads = [transaction.get(itemsReference)]
    if (section === 'expenses') {
      reads.push(
        transaction.get(
          workspaceReference
            .collection('expenseTracking')
            .where(FieldPath.documentId(), '>=', `${year}-01`)
            .where(FieldPath.documentId(), '<=', `${year}-12`),
        ),
      )
    }
    const [itemsSnapshot, trackingSnapshot] = await Promise.all(reads)
    const existingItems = documents(itemsSnapshot)
    let nextItems = existingItems
    let response

    if (operation === 'create') {
      assertCategoryEnabled(config, requestedItem.category, section)
      assertOwnershipMembers(requestedItem.ownership, workspace.memberIds)
      if (itemSnapshot?.exists) {
        throw new Error('Only one expense is allowed for each standard subcategory')
      }
      const itemData = withAuditFields(requestedItem, userId, true)
      nextItems = [...existingItems, { id: itemReference.id, ...itemData }]
      transaction.set(itemReference, itemData)
      response = { [definition.result]: clientItem(itemReference.id, itemData) }
    }

    if (operation === 'update') {
      if (!itemSnapshot?.exists) throw new Error(`${capitalize(definition.result)} not found`)
      const previous = itemSnapshot.data()
      if (!config.categories?.[previous.category]) {
        throw new Error(`Itemized ${definition.result} category not found`)
      }
      const updated = normalizeItem(section, { ...previous, ...item, category: previous.category })
      assertOwnershipMembers(updated.ownership, workspace.memberIds)
      if (section === 'expenses' && updated.type !== previous.type) {
        throw new Error('An expense subcategory cannot be changed after creation')
      }
      const itemData = withAuditFields({ ...previous, ...updated }, userId, false)
      nextItems = existingItems.map((candidate) =>
        candidate.id === itemReference.id ? { id: itemReference.id, ...itemData } : candidate,
      )
      transaction.set(itemReference, itemData)
      response = { [definition.result]: clientItem(itemReference.id, itemData) }
    }

    if (operation === 'delete') {
      if (!itemSnapshot?.exists) throw new Error(`${capitalize(definition.result)} not found`)
      nextItems = existingItems.filter((candidate) => candidate.id !== itemReference.id)
      transaction.delete(itemReference)
      response = { categoryId: itemSnapshot.data().category }
    }

    if (operation === 'deleteCategory') {
      assertText(categoryId, `A ${definition.result} category is required`)
      const categoryItems = existingItems.filter((candidate) => candidate.category === categoryId)
      if (categoryItems.length > 498) {
        throw new Error('Categories with more than 498 items cannot be deleted at once')
      }
      nextItems = existingItems.filter((candidate) => candidate.category !== categoryId)
      categoryItems.forEach((candidate) => transaction.delete(itemsReference.doc(candidate.id)))
      const categories = { ...(config.categories || {}) }
      delete categories[categoryId]
      config.categories = categories
      transaction.set(
        configReference,
        {
          categories,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: userId,
        },
        { merge: true },
      )
      response = { categoryId }
    }

    const latest = financialYearSnapshot.data()
    const projectionInput = {
      year,
      config: { [section]: config },
      [section]: nextItems,
      sections: [section],
      positionObservedMonth: month,
    }
    if (section === 'assets' || section === 'liabilities') {
      projectionInput.positionFromMonths = {
        [section]: positionStartMonth(latest, section, month),
      }
    }
    if (section === 'expenses') {
      projectionInput.trackingMonths = Object.fromEntries(
        documents(trackingSnapshot).map((tracking) => [tracking.id, tracking]),
      )
    }
    const financialYear = updateFinancialYearProjection(latest, projectionInput)
    transaction.set(financialYearReference, {
      ...financialYear,
      status: 'active',
      generatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    return { ...response, year }
  })
}

function normalizeItem(section, item = {}) {
  const category = String(item.category || '').trim()
  assertText(category, `A valid ${section} category is required`)
  const ownership = normalizeOwnership(item.ownership)

  if (section === 'assets') {
    const currentValue = money(item.currentValue)
    if (currentValue === null) throw new Error('A non-negative numeric value is required')
    return cleanItem({
      ...item,
      category,
      currentValue,
      ownership,
      detail: isPlainObject(item.detail) ? item.detail : {},
      valueSource: 'manual',
    })
  }

  if (section === 'liabilities') {
    const balance = money(item.balance)
    if (balance === null) throw new Error('A non-negative balance is required')
    return cleanItem({ ...item, category, balance, ownership })
  }

  if (section === 'income') {
    const subtype = String(item.subtype || '').trim()
    const name = String(item.name || '').trim()
    assertText(subtype, 'A valid income type is required')
    const calculation = normalizeIncomeCalculation(item.calculation)
    if (!calculation) throw new Error('A valid income calculation is required')
    return cleanItem({ ...item, category, subtype, name, calculation, ownership })
  }

  return normalizeExpense(item, category, ownership)
}

function normalizeExpense(item, category, ownership) {
  const type = String(item.type || '').trim()
  assertText(type, 'A valid expense type is required')
  const amount = money(item.estimate?.amount)
  const frequency = item.estimate?.frequency
  if (
    amount === null ||
    !['weekly', 'monthly', 'every_two_months', 'quarterly', 'yearly', 'irregular'].includes(
      frequency,
    )
  ) {
    throw new Error('A valid expense estimate is required')
  }
  if (!['fixed', 'variable'].includes(item.variability)) {
    throw new Error('Valid expense behavior is required')
  }
  if (!['recurring', 'occasional'].includes(item.recurrence)) {
    throw new Error('Valid expense behavior is required')
  }
  if (item.necessity != null && !['essential', 'lifestyle'].includes(item.necessity)) {
    throw new Error('A valid expense necessity is required')
  }
  const estimate = { amount, frequency }
  return cleanItem({
    ...item,
    category,
    type,
    name: String(item.name || '').trim(),
    estimate,
    monthlyAmounts: normalizeMonthlyAmounts(item.monthlyAmounts) || monthlyAmounts(estimate),
    variability: item.variability,
    recurrence: item.recurrence,
    necessity: item.necessity ?? null,
    ownership,
    trackingEligible: type !== 'other' && item.trackingEligible !== false,
  })
}

function normalizeIncomeCalculation(calculation) {
  if (calculation?.mode === 'annual_salary') {
    const annualAmount = money(calculation.annualAmount)
    const paymentsPerYear = Number(calculation.paymentsPerYear)
    if (annualAmount === null || !Number.isInteger(paymentsPerYear) || paymentsPerYear <= 0) {
      return null
    }
    return { mode: 'annual_salary', annualAmount, paymentsPerYear }
  }
  if (calculation?.mode === 'monthly_schedule') {
    const monthlyAmount = money(calculation.monthlyAmount)
    if (monthlyAmount === null || !isPlainObject(calculation.extrasByMonth)) return null
    const extrasByMonth = {}
    for (const [month, value] of Object.entries(calculation.extrasByMonth)) {
      const amount = money(value)
      if (!MONTHS.includes(month) || amount === null) return null
      if (amount > 0) extrasByMonth[month] = amount
    }
    return { mode: 'monthly_schedule', monthlyAmount, extrasByMonth }
  }
  const amount = money(calculation?.amount)
  if (amount === null) return null
  if (calculation.mode === 'one_time') {
    return {
      mode: 'one_time',
      amount,
      month: MONTHS.includes(calculation.month) ? calculation.month : 'january',
    }
  }
  if (
    calculation.mode !== 'recurring' ||
    !['weekly', 'monthly', 'quarterly', 'yearly'].includes(calculation.frequency)
  ) {
    return null
  }
  return { mode: 'recurring', amount, frequency: calculation.frequency }
}

function resolveItemReference(itemsReference, section, operation, itemId, item) {
  if (operation === 'deleteCategory') return null
  if (operation === 'create') {
    if (section === 'expenses' && item.type !== 'other') {
      return itemsReference.doc(`${item.category}--${item.type}`)
    }
    return itemsReference.doc()
  }
  assertText(itemId, 'A model item is required')
  return itemsReference.doc(itemId)
}

function withAuditFields(item, userId, creating) {
  return {
    ...item,
    ...(creating ? { createdAt: FieldValue.serverTimestamp(), createdBy: userId } : {}),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: userId,
  }
}

function clientItem(id, item) {
  return { ...item, id, createdAt: null, updatedAt: null }
}

function cleanItem(item) {
  const clean = { ...item }
  delete clean.id
  delete clean.createdAt
  delete clean.createdBy
  delete clean.updatedAt
  delete clean.updatedBy
  return clean
}

function normalizeOwnership(ownership) {
  const shares = (ownership?.shares || []).map((share) => ({
    memberId: String(share.memberId || '').trim(),
    percentage: Number(share.percentage),
  }))
  const uniqueMembers = new Set(shares.map((share) => share.memberId))
  const total = shares.reduce((sum, share) => sum + share.percentage, 0)
  if (
    !shares.length ||
    uniqueMembers.size !== shares.length ||
    shares.some(
      (share) =>
        !share.memberId ||
        !Number.isFinite(share.percentage) ||
        share.percentage < 0 ||
        share.percentage > 100,
    ) ||
    Math.abs(total - 100) >= 0.001
  ) {
    throw new Error('Ownership must reference workspace members and add up to 100%')
  }
  return { mode: ownership?.mode || (shares.length > 1 ? 'shared' : 'single'), shares }
}

function assertOwnershipMembers(ownership, memberIds = []) {
  const allowed = new Set(memberIds)
  if (ownership.shares.some((share) => !allowed.has(share.memberId))) {
    throw new Error('Ownership must reference workspace members and add up to 100%')
  }
}

function normalizeMonthlyAmounts(amounts) {
  if (!isPlainObject(amounts)) return null
  const normalized = {}
  for (const month of MONTHS) {
    const value = money(amounts[month])
    if (value === null) return null
    normalized[month] = value
  }
  return normalized
}

function monthlyAmounts(estimate) {
  const interval = { monthly: 1, every_two_months: 2, quarterly: 3, yearly: 12 }[
    estimate.frequency
  ]
  if (!interval) {
    const multiplier = estimate.frequency === 'weekly' ? 52 : 1
    const monthly = rounded((estimate.amount * multiplier) / 12)
    return Object.fromEntries(MONTHS.map((month) => [month, monthly]))
  }
  return Object.fromEntries(
    MONTHS.map((month, index) => [month, index % interval === 0 ? estimate.amount : 0]),
  )
}

function positionStartMonth(financialYear, section, observedMonth) {
  const initializedMonth = financialYear?.projectionState?.[`${section}InitializedMonth`]
  return !initializedMonth || initializedMonth === observedMonth ? '01' : observedMonth
}

function assertWorkspaceAccess(snapshot, userId) {
  const workspace = snapshot.data()
  if (!snapshot.exists || workspace?.deletionPendingAt || !workspace?.memberIds?.includes(userId)) {
    throw new Error('Workspace membership is required')
  }
  return workspace
}

function assertCategoryEnabled(config, categoryId, section) {
  if (!config.categories?.[categoryId]?.enabled) {
    throw new Error(`${capitalize(section.slice(0, -1))} category is not enabled`)
  }
}

function documents(snapshot) {
  return (snapshot?.docs || []).map((document) => ({ id: document.id, ...document.data() }))
}

function money(value) {
  if (value === '' || value == null) return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? rounded(number) : null
}

function rounded(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function capitalize(value) {
  return `${value[0]?.toUpperCase() || ''}${value.slice(1)}`
}

function assertText(value, message) {
  if (!String(value || '').trim()) throw new Error(message)
}

module.exports = { mutateFinancialModel }
