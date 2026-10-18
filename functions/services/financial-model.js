const { FieldPath, FieldValue } = require('firebase-admin/firestore')
const { updateFinancialYearProjection } = require('../domain/financial-year')
const { currentMonth, currentYear, positionStartMonth } = require('./financial-years')

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
  {
    workspaceId,
    userId,
    section,
    operation,
    itemId = null,
    item = null,
    categoryId = null,
  },
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
  const trackingConfigReference = workspaceReference.collection('modelConfig').doc('expenseTracking')
  const itemsReference = workspaceReference.collection(definition.collection)
  const financialYearReference = workspaceReference.collection('financialYears').doc(String(year))
  const requestedItem = operation === 'create' ? validatedCanonicalItem(section, item) : null
  const itemReference = resolveItemReference(itemsReference, operation, itemId)

  return firestore.runTransaction(async (transaction) => {
    const [workspaceSnapshot, configSnapshot, financialYearSnapshot] = await Promise.all([
      transaction.get(workspaceReference),
      transaction.get(configReference),
      transaction.get(financialYearReference),
    ])
    const workspace = assertWorkspaceAccess(workspaceSnapshot, userId)
    if (!financialYearSnapshot.exists || !financialYearSnapshot.data()?.months) {
      throw new Error('The current financial year must exist before changing the financial model')
    }

    const config = {
      ...(configSnapshot.data() || {}),
      categories: { ...(configSnapshot.data()?.categories || {}) },
    }
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
      assertCategoryEnabled(config, itemCategoryId(section, requestedItem), section)
      assertOwnershipMembers(requestedItem.ownership, workspace.memberIds)
      const itemData = withAuditFields(requestedItem, userId, true)
      nextItems = [...existingItems, { id: itemReference.id, ...itemData }]
      transaction.set(itemReference, itemData)
      response = { [definition.result]: clientItem(itemReference.id, itemData) }
    }

    if (operation === 'update') {
      if (!itemSnapshot?.exists) throw new Error(`${capitalize(definition.result)} not found`)
      const previous = itemSnapshot.data()
      const previousCategoryId = itemCategoryId(section, previous)
      if (!config.categories?.[previousCategoryId]) {
        throw new Error(`${capitalize(definition.result)} category not found`)
      }
      const updated = validatedCanonicalItem(section, {
        ...previous,
        ...item,
        categoryId: previousCategoryId,
        subcategoryId: previous.subcategoryId,
      })
      assertOwnershipMembers(updated.ownership, workspace.memberIds)
      if (updated.subcategoryId !== previous.subcategoryId) {
        throw new Error(`A ${section.slice(0, -1)} subcategory cannot be changed after creation`)
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
      const deletedItem = itemSnapshot.data()
      nextItems = existingItems.filter((candidate) => candidate.id !== itemReference.id)
      transaction.delete(itemReference)
      response = { categoryId: itemCategoryId(section, deletedItem) }
    }

    if (operation === 'deleteCategory') {
      assertText(categoryId, `A ${definition.result} category is required`)
      const categoryItems = existingItems.filter(
        (candidate) => itemCategoryId(section, candidate) === categoryId,
      )
      if (categoryItems.length > 498) {
        throw new Error('Categories with more than 498 items cannot be deleted at once')
      }
      nextItems = existingItems.filter(
        (candidate) => itemCategoryId(section, candidate) !== categoryId,
      )
      categoryItems.forEach((candidate) => transaction.delete(itemsReference.doc(candidate.id)))
      if (section === 'expenses') {
        removeTrackingPreferences(
          transaction,
          trackingConfigReference,
          [...new Set(categoryItems.map(({ subcategoryId }) => subcategoryId))],
          userId,
        )
      }
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

function validatedCanonicalItem(section, item = {}) {
  const category = item.categoryId
  assertText(category, `A valid ${section} category is required`)
  if (category !== category.trim()) throw new Error(`A valid ${section} category is required`)
  assertCanonicalOwnership(item.ownership)

  if (section === 'assets') {
    assertCanonicalText(item.subcategoryId, 'A valid asset subcategory is required')
    assertCanonicalText(item.itemName, 'An asset name is required')
    assertCanonicalTextField(item.notes, 'Canonical asset notes are required')
    assertNonNegativeMoney(item.currentValue, 'A non-negative numeric value is required')
    if (!isPlainObject(item.detail) || item.valueSource !== 'manual') {
      throw new Error('A canonical asset is required')
    }
    return cleanItem({
      ...item,
      categoryId: category,
    })
  }

  if (section === 'liabilities') {
    assertCanonicalText(item.subcategoryId, 'A valid liability subcategory is required')
    assertCanonicalText(item.itemName, 'A liability name is required')
    assertCanonicalTextField(item.notes, 'Canonical liability notes are required')
    assertNonNegativeMoney(item.balance, 'A non-negative balance is required')
    return cleanItem({ ...item, categoryId: category })
  }

  if (section === 'income') {
    assertCanonicalText(item.subcategoryId, 'A valid income subcategory is required')
    assertCanonicalText(item.itemName, 'An income item name is required')
    assertCanonicalTextField(item.notes, 'Canonical income notes are required')
    assertCanonicalIncomeCalculation(item.calculation)
    return cleanItem({ ...item, categoryId: category, disposablePercentage: 100 })
  }

  return canonicalExpense(item, category)
}

function canonicalExpense(item, category) {
  assertCanonicalText(item.categoryId, 'A valid expense category is required')
  assertCanonicalText(item.subcategoryId, 'A valid expense subcategory is required')
  assertCanonicalText(item.itemName, 'An item name is required')
  assertCanonicalTextField(item.notes, 'Canonical expense notes are required')
  assertNonNegativeMoney(item.estimate?.amount, 'A valid expense estimate is required')
  const frequency = item.estimate?.frequency
  if (
    !['monthly', 'every_two_months', 'quarterly', 'yearly'].includes(frequency)
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
  assertCanonicalMonthlyAmounts(item.monthlyAmounts)
  return cleanItem({
    ...item,
    categoryId: category,
  })
}

function assertCanonicalIncomeCalculation(calculation) {
  if (calculation?.mode === 'annual_salary') {
    assertNonNegativeMoney(calculation.annualAmount, 'A valid income calculation is required')
    if (!Number.isInteger(calculation.paymentsPerYear) || calculation.paymentsPerYear <= 0) {
      throw new Error('A valid income calculation is required')
    }
    return
  }
  if (calculation?.mode === 'monthly_schedule') {
    assertNonNegativeMoney(calculation.monthlyAmount, 'A valid income calculation is required')
    if (!isPlainObject(calculation.extrasByMonth)) {
      throw new Error('A valid income calculation is required')
    }
    for (const [month, value] of Object.entries(calculation.extrasByMonth)) {
      if (!MONTHS.includes(month)) throw new Error('A valid income calculation is required')
      assertNonNegativeMoney(value, 'A valid income calculation is required')
    }
    return
  }
  assertNonNegativeMoney(calculation?.amount, 'A valid income calculation is required')
  if (calculation.mode === 'one_time') {
    if (!MONTHS.includes(calculation.month)) throw new Error('A valid income calculation is required')
    return
  }
  if (
    calculation.mode !== 'recurring' ||
    !['monthly', 'quarterly', 'yearly'].includes(calculation.frequency)
  ) {
    throw new Error('A valid income calculation is required')
  }
}

function resolveItemReference(itemsReference, operation, itemId) {
  if (operation === 'deleteCategory') return null
  if (operation === 'create') {
    return itemsReference.doc()
  }
  assertText(itemId, 'A model item is required')
  return itemsReference.doc(itemId)
}

function itemCategoryId(section, item) {
  return item.categoryId
}

function withAuditFields(item, userId, creating) {
  return {
    ...item,
    ...(creating ? { createdAt: FieldValue.serverTimestamp(), createdBy: userId } : {}),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: userId,
  }
}

function removeTrackingPreferences(transaction, reference, subcategoryIds, userId) {
  if (!subcategoryIds.length) return
  transaction.set(
    reference,
    {
      enabledSubcategories: FieldValue.arrayRemove(...subcategoryIds),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: userId,
    },
    { merge: true },
  )
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

function assertCanonicalOwnership(ownership) {
  const shares = ownership?.shares || []
  const uniqueMembers = new Set(shares.map((share) => share.memberId))
  const total = shares.reduce((sum, share) => sum + share.percentage, 0)
  if (
    !shares.length ||
    uniqueMembers.size !== shares.length ||
    shares.some(
      (share) =>
        typeof share.memberId !== 'string' ||
        !share.memberId ||
        share.memberId !== share.memberId.trim() ||
        !Number.isFinite(share.percentage) ||
        share.percentage < 0 ||
        share.percentage > 100,
    ) ||
    Math.abs(total - 100) >= 0.001
  ) {
    throw new Error('Ownership must reference workspace members and add up to 100%')
  }
  const expectedMode = shares.length > 1 ? 'shared' : 'single'
  if (ownership.mode !== expectedMode) {
    throw new Error('Ownership must reference workspace members and add up to 100%')
  }
}

function assertOwnershipMembers(ownership, memberIds = []) {
  const allowed = new Set(memberIds)
  if (ownership.shares.some((share) => !allowed.has(share.memberId))) {
    throw new Error('Ownership must reference workspace members and add up to 100%')
  }
}

function assertCanonicalMonthlyAmounts(amounts) {
  if (!isPlainObject(amounts)) throw new Error('Canonical monthly expense amounts are required')
  for (const month of MONTHS) {
    assertNonNegativeMoney(amounts[month], 'Canonical monthly expense amounts are required')
  }
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

function assertNonNegativeMoney(value, message) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    roundMoney(value) !== value
  ) {
    throw new Error(message)
  }
}

function assertCanonicalText(value, message) {
  assertText(value, message)
  if (typeof value !== 'string' || value !== value.trim()) throw new Error(message)
}

function assertCanonicalTextField(value, message) {
  if (typeof value !== 'string' || value !== value.trim()) throw new Error(message)
}

function roundMoney(value) {
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
