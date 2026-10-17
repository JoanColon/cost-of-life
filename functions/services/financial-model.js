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
    subcategories = null,
  },
) {
  assertText(workspaceId, 'A workspace is required')
  assertText(userId, 'Authentication is required')
  const definition = sectionDefinitions[section]
  if (!definition) throw new Error('A valid financial section is required')
  if (!['create', 'update', 'delete', 'deleteCategory', 'syncTracking'].includes(operation)) {
    throw new Error('A valid model operation is required')
  }
  if (operation === 'syncTracking' && section !== 'expenses') {
    throw new Error('Tracking can only be synchronized with expenses')
  }

  const year = currentYear()
  const month = currentMonth()
  const workspaceReference = firestore.collection('workspaces').doc(workspaceId)
  const configReference = workspaceReference.collection('modelConfig').doc(section)
  const trackingConfigReference = workspaceReference.collection('modelConfig').doc('expenseTracking')
  const itemsReference = workspaceReference.collection(definition.collection)
  const financialYearReference = workspaceReference.collection('financialYears').doc(String(year))
  const requestedItem = operation === 'create' ? validatedCanonicalItem(section, item) : null
  const requestedSubcategories =
    operation === 'syncTracking' ? canonicalTrackingSubcategories(subcategories) : []
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
    let modelChanged = operation !== 'syncTracking'
    let configChanged = false

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
      const updated = validatedCanonicalItem(section, {
        ...previous,
        ...item,
        category: previous.category,
      })
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
      const deletedItem = itemSnapshot.data()
      nextItems = existingItems.filter((candidate) => candidate.id !== itemReference.id)
      transaction.delete(itemReference)
      if (section === 'expenses' && deletedItem.type !== 'other') {
        removeTrackingPreferences(transaction, trackingConfigReference, [deletedItem.type], userId)
      }
      response = { categoryId: deletedItem.category }
    }

    if (operation === 'deleteCategory') {
      assertText(categoryId, `A ${definition.result} category is required`)
      const categoryItems = existingItems.filter((candidate) => candidate.category === categoryId)
      if (categoryItems.length > 498) {
        throw new Error('Categories with more than 498 items cannot be deleted at once')
      }
      nextItems = existingItems.filter((candidate) => candidate.category !== categoryId)
      categoryItems.forEach((candidate) => transaction.delete(itemsReference.doc(candidate.id)))
      if (section === 'expenses') {
        removeTrackingPreferences(
          transaction,
          trackingConfigReference,
          categoryItems.filter(({ type }) => type !== 'other').map(({ type }) => type),
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

    if (operation === 'syncTracking') {
      const selectedIds = requestedSubcategories.map(({ type }) => type)

      for (const requested of requestedSubcategories) {
        const previousCategory = config.categories[requested.category] || {
          enabled: false,
          manualEstimate: { amount: 0, frequency: 'monthly' },
          necessity: null,
          ownership: createTrackingOwnership(workspace.memberIds),
        }
        if (!previousCategory.enabled) {
          config.categories[requested.category] = { ...previousCategory, enabled: true }
          modelChanged = true
          configChanged = true
        }

        const existing = nextItems.find(
          (candidate) =>
            candidate.category === requested.category && candidate.type === requested.type,
        )
        if (existing) {
          continue
        }

        const firstItem = !nextItems.some(
          (candidate) => candidate.category === requested.category,
        )
        const category = config.categories[requested.category]
        const estimate = firstItem ? category.manualEstimate || requested.estimate : requested.estimate
        const expense = validatedCanonicalItem('expenses', {
          ...requested,
          estimate,
          monthlyAmounts:
            (firstItem ? category.monthlyAmounts : requested.monthlyAmounts) ||
            generateTrackingMonthlyAmounts(estimate),
          ownership: category.ownership || createTrackingOwnership(workspace.memberIds),
        })
        assertOwnershipMembers(expense.ownership, workspace.memberIds)
        const itemData = withAuditFields(expense, userId, true)
        const reference = itemsReference.doc(`${expense.category}--${expense.type}`)
        nextItems = [...nextItems, { id: reference.id, ...itemData }]
        transaction.set(reference, itemData)
        modelChanged = true
      }

      if (configChanged) {
        transaction.set(
          configReference,
          {
            categories: config.categories,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: userId,
          },
          { merge: true },
        )
      }
      transaction.set(
        trackingConfigReference,
        {
          schemaVersion: 1,
          enabledSubcategories: selectedIds,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: userId,
        },
        { merge: true },
      )
      response = { enabledSubcategories: selectedIds }
    }

    if (!modelChanged) return response

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
  const category = item.category
  assertText(category, `A valid ${section} category is required`)
  if (category !== category.trim()) throw new Error(`A valid ${section} category is required`)
  assertCanonicalOwnership(item.ownership)

  if (section === 'assets') {
    assertNonNegativeMoney(item.currentValue, 'A non-negative numeric value is required')
    if (!isPlainObject(item.detail) || item.valueSource !== 'manual') {
      throw new Error('A canonical asset is required')
    }
    return cleanItem({
      ...item,
      category,
    })
  }

  if (section === 'liabilities') {
    assertNonNegativeMoney(item.balance, 'A non-negative balance is required')
    return cleanItem({ ...item, category })
  }

  if (section === 'income') {
    assertCanonicalText(item.subtype, 'A valid income type is required')
    assertCanonicalTextField(item.name, 'A canonical income name is required')
    assertCanonicalIncomeCalculation(item.calculation)
    return cleanItem({ ...item, category })
  }

  return canonicalExpense(item, category)
}

function canonicalTrackingSubcategories(subcategories) {
  if (!Array.isArray(subcategories)) {
    throw new Error('Tracking subcategories are required')
  }
  const seen = new Set()
  return subcategories.map((subcategory) => {
    const category = subcategory?.category
    const type = subcategory?.type
    assertCanonicalText(category, 'A valid expense category is required')
    assertCanonicalText(type, 'A valid expense type is required')
    if (type === 'other' || seen.has(type)) {
      throw new Error('Tracking subcategories must be unique standard expenses')
    }
    seen.add(type)
    const canonical = canonicalExpense(
      {
        ...subcategory,
        category,
        type,
        ownership: { mode: 'single', shares: [{ memberId: 'pending', percentage: 100 }] },
      },
      category,
    )
    delete canonical.ownership
    return canonical
  })
}

function canonicalExpense(item, category) {
  assertCanonicalText(item.type, 'A valid expense type is required')
  assertCanonicalTextField(item.name, 'A canonical expense name is required')
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
    category,
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

function resolveItemReference(itemsReference, section, operation, itemId, item) {
  if (operation === 'deleteCategory' || operation === 'syncTracking') return null
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

function createTrackingOwnership(memberIds) {
  if (!memberIds.length) throw new Error('Workspace membership is required')
  const percentage = Math.floor(100000 / memberIds.length) / 1000
  let allocated = 0
  const shares = memberIds.map((memberId, index) => {
    const share = index === memberIds.length - 1 ?
      Math.round((100 - allocated) * 1000) / 1000 :
      percentage
    allocated += share
    return { memberId, percentage: share }
  })
  return { mode: memberIds.length > 1 ? 'shared' : 'single', shares }
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

function generateTrackingMonthlyAmounts(estimate) {
  const interval = { monthly: 1, every_two_months: 2, quarterly: 3, yearly: 12 }[
    estimate.frequency
  ]
  return Object.fromEntries(
    MONTHS.map((month, index) => [month, index % interval === 0 ? estimate.amount : 0]),
  )
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
