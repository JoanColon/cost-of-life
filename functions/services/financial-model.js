import { FieldPath, FieldValue } from 'firebase-admin/firestore'
import { updateFinancialYearProjection } from '../domain/financial-year.js'
import { calculatePositionsAt } from '../domain/positions.js'
import { annualRealEstateValue } from '../domain/real-estate.js'
import { currentMonth, currentYear, positionStartMonth } from './financial-years.js'

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

const MAX_TRANSACTION_WRITES = 500

function financialModelMutationInput(data = {}, userId) {
  return {
    workspaceId: String(data.workspaceId || '').trim(),
    userId,
    section: data.section,
    operation: data.operation,
    itemId: data.itemId,
    item: data.item,
    categoryId: data.categoryId,
    relations: data.relations,
  }
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
    relations = null,
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
  const requestedMortgageId =
    section === 'assets' ?
      requestedItem?.mortgageLiabilityId || item?.mortgageLiabilityId :
      section === 'expenses' ?
        requestedItem?.liabilityId || item?.liabilityId :
        null
  const mortgageRelationRequest =
    section === 'liabilities' &&
    operation === 'update' &&
    isPlainObject(relations)
  const mortgageAssetRelationProvided =
    mortgageRelationRequest && Object.hasOwn(relations, 'mortgageAssetId')
  const mortgageExpenseRelationProvided =
    mortgageRelationRequest && Object.hasOwn(relations, 'mortgageExpenseId')
  if (relations != null) {
    const relationKeys = Object.keys(relations)
    if (
      !mortgageRelationRequest ||
      !relationKeys.length ||
      relationKeys.some((key) => !['mortgageAssetId', 'mortgageExpenseId'].includes(key)) ||
      relationKeys.some((key) => !isOptionalCanonicalId(relations[key]))
    ) {
      throw new Error('A valid financial model relationship is required')
    }
  }
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
    const linkedIncomeReference = workspaceReference.collection('modelIncome')
    const linkedAssetsReference = workspaceReference.collection('modelAssets')
    const linkedLiabilitiesReference = workspaceReference.collection('modelLiabilities')
    const linkedExpensesReference = workspaceReference.collection('modelExpenses')
    const expensesConfigReference = workspaceReference.collection('modelConfig').doc('expenses')
    const [
      itemsSnapshot,
      trackingSnapshot,
      linkedIncomeSnapshot,
      relatedLiabilitiesSnapshot,
      linkedAssetsSnapshot,
      linkedExpensesSnapshot,
      expensesConfigSnapshot,
    ] = await Promise.all([
      transaction.get(itemsReference),
      section === 'expenses' ||
      (section === 'liabilities' && ['update', 'delete', 'deleteCategory'].includes(operation)) ?
        transaction.get(
            workspaceReference
              .collection('expenseTracking')
              .where(FieldPath.documentId(), '>=', `${year}-01`)
              .where(FieldPath.documentId(), '<=', `${year}-12`),
          ) :
        null,
      section === 'assets' && operation === 'delete' ?
        transaction.get(linkedIncomeReference.where('portfolioAssetId', '==', itemId)) :
        section === 'assets' && operation === 'deleteCategory' ?
          transaction.get(linkedIncomeReference) :
          null,
      section === 'expenses' || requestedMortgageId ?
        transaction.get(linkedLiabilitiesReference) :
        null,
      section === 'liabilities' && ['update', 'delete', 'deleteCategory'].includes(operation) ?
        transaction.get(
            operation === 'delete' ?
              linkedAssetsReference.where('mortgageLiabilityId', '==', itemId) :
              linkedAssetsReference,
          ) :
        null,
      section === 'liabilities' && ['update', 'delete', 'deleteCategory'].includes(operation) ?
        transaction.get(
            operation === 'delete' ?
              linkedExpensesReference.where('liabilityId', '==', itemId) :
              linkedExpensesReference,
          ) :
        null,
      section === 'liabilities' && ['update', 'delete', 'deleteCategory'].includes(operation) ?
        transaction.get(expensesConfigReference) :
        null,
    ])
    const existingItems = documents(itemsSnapshot)
    const relatedLiabilities = documents(relatedLiabilitiesSnapshot)
    const existingItem = itemId ? existingItems.find(({ id }) => id === itemId) : null
    let nextItems = existingItems
    let syncedExpenses = null
    let pendingItemData = null
    let response

    if (operation === 'create') {
      assertCategoryEnabled(config, requestedItem.categoryId, section)
      assertOwnershipMembers(requestedItem.ownership, workspace.memberIds)
      assertUniquePortfolioIncomeLink(existingItems, requestedItem)
      assertMortgageManagedRelationship(section, null, requestedItem)
      assertLinkedMortgage(section, existingItems, requestedItem, null, relatedLiabilities)
      synchronizeExpenseCandidate(section, requestedItem, relatedLiabilities)
      const itemData = withAuditFields(requestedItem, userId, true)
      nextItems = [...existingItems, { id: itemReference.id, ...itemData }]
      pendingItemData = itemData
      response = { [definition.result]: clientItem(itemReference.id, itemData) }
    }

    if (operation === 'update') {
      if (!existingItem) throw new Error(`${capitalize(definition.result)} not found`)
      const previous = existingItem
      if (
        section === 'liabilities' &&
        previous.detail?.mortgage?.schemaVersion === 2 &&
        item?.balance !== previous.balance &&
        !item?.detail?.mortgage?.balanceAnchor
      ) {
        throw new Error('A modeled mortgage balance must be changed from its mortgage model')
      }
      const previousCategoryId = previous.categoryId
      if (!config.categories?.[previousCategoryId]) {
        throw new Error(`${capitalize(definition.result)} category not found`)
      }
      const updated = validatedCanonicalItem(section, {
        ...previous,
        ...item,
        categoryId: previousCategoryId,
        subcategoryId: previous.subcategoryId,
      })
      if (
        (mortgageAssetRelationProvided || mortgageExpenseRelationProvided) &&
        updated.categoryId !== 'mortgage'
      ) {
        throw new Error('Only a mortgage can manage mortgage relationships')
      }
      assertOwnershipMembers(updated.ownership, workspace.memberIds)
      assertUniquePortfolioIncomeLink(existingItems, updated, itemReference.id)
      assertMortgageManagedRelationship(section, previous, updated)
      assertLinkedMortgage(section, existingItems, updated, itemReference.id, relatedLiabilities)
      synchronizeExpenseCandidate(section, updated, relatedLiabilities)
      const itemData = withAuditFields({ ...previous, ...updated }, userId, false)
      nextItems = existingItems.map((candidate) =>
        candidate.id === itemReference.id ? { id: itemReference.id, ...itemData } : candidate,
      )
      pendingItemData = itemData
      if (section === 'liabilities' && updated.categoryId === 'mortgage') {
        syncMortgageAssetRelation(
          transaction,
          linkedAssetsSnapshot,
          itemReference.id,
          userId,
          mortgageAssetRelationProvided,
          relations?.mortgageAssetId ?? null,
        )
        syncedExpenses = syncMortgageExpenseRelation(
          transaction,
          linkedExpensesSnapshot,
          updated,
          itemReference.id,
          userId,
          mortgageExpenseRelationProvided,
          relations?.mortgageExpenseId ?? null,
        )
      }
      response = { [definition.result]: clientItem(itemReference.id, itemData) }
    }

    if (operation === 'delete') {
      if (!existingItem) throw new Error(`${capitalize(definition.result)} not found`)
      const deletedItem = existingItem
      nextItems = existingItems.filter((candidate) => candidate.id !== itemReference.id)
      transaction.delete(itemReference)
      unlinkPortfolioIncome(transaction, linkedIncomeSnapshot, new Set([itemReference.id]), userId)
      const unlinkedExpenses = unlinkMortgageRelations(
        transaction,
        linkedAssetsSnapshot,
        linkedExpensesSnapshot,
        new Set([itemReference.id]),
        userId,
      )
      if (section === 'liabilities' && unlinkedExpenses) syncedExpenses = unlinkedExpenses
      response = { categoryId: deletedItem.categoryId }
    }

    if (operation === 'deleteCategory') {
      assertText(categoryId, `A ${definition.result} category is required`)
      const categoryItems = existingItems.filter(
        (candidate) => candidate.categoryId === categoryId,
      )
      const categoryItemIds = new Set(categoryItems.map(({ id }) => id))
      assertDeleteCategoryWriteLimit(
        section,
        categoryItems,
        linkedIncomeSnapshot,
        categoryItemIds,
        linkedAssetsSnapshot,
        linkedExpensesSnapshot,
      )
      nextItems = existingItems.filter(
        (candidate) => candidate.categoryId !== categoryId,
      )
      categoryItems.forEach((candidate) => transaction.delete(itemsReference.doc(candidate.id)))
      unlinkPortfolioIncome(
        transaction,
        linkedIncomeSnapshot,
        categoryItemIds,
        userId,
      )
      const unlinkedExpenses = unlinkMortgageRelations(
        transaction,
        linkedAssetsSnapshot,
        linkedExpensesSnapshot,
        categoryItemIds,
        userId,
      )
      if (section === 'liabilities' && unlinkedExpenses) syncedExpenses = unlinkedExpenses
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

    if (section === 'assets' || section === 'liabilities') {
      const positions = calculatePositionsAt({
        [section]: nextItems,
        asOfDate: madridToday(),
      })
      nextItems = positions[section]
      if (pendingItemData) {
        const effectiveItem = nextItems.find(({ id }) => id === itemReference.id)
        if (effectiveItem) {
          const effectiveItemData = { ...effectiveItem }
          delete effectiveItemData.id
          pendingItemData = effectiveItemData
          response = {
            [definition.result]: clientItem(itemReference.id, effectiveItemData),
          }
        }
      }
    }
    if (pendingItemData) transaction.set(itemReference, pendingItemData)

    const latest = financialYearSnapshot.data()
    const projectionInput = {
      year,
      config: {
        [section]: config,
        ...(syncedExpenses ? { expenses: expensesConfigSnapshot.data() || {} } : {}),
      },
      [section]: nextItems,
      ...(syncedExpenses ? { expenses: syncedExpenses } : {}),
      ...(section === 'expenses' && relatedLiabilities.length ?
        { liabilities: relatedLiabilities } :
        {}),
      sections: syncedExpenses ? [section, 'expenses'] : [section],
      positionObservedMonth: month,
    }
    if (section === 'assets' || section === 'liabilities') {
      projectionInput.positionFromMonths = {
        [section]: positionStartMonth(latest, section, month),
      }
    }
    if (section === 'expenses' || syncedExpenses) {
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
    if (!isPlainObject(item.detail)) throw new Error('A canonical asset is required')
    if (item.mortgageLiabilityId != null) {
      assertCanonicalText(item.mortgageLiabilityId, 'A valid linked mortgage is required')
      if (
        item.categoryId !== 'real_estate' ||
        !['primary_home', 'rental_property'].includes(item.subcategoryId)
      ) {
        throw new Error('Only a home or rental property can link a mortgage')
      }
    }
    if (item.detail.realEstate != null) {
      assertCanonicalRealEstate(item.detail.realEstate, item)
      if (item.detail.realEstate.schemaVersion === 2) {
        item.currentValue = annualRealEstateValue(item.detail.realEstate, madridToday())
        item.valueSource = 'model'
      }
    }
    if (
      item.valueSource !== 'manual' &&
      !(item.valueSource === 'model' && item.detail.realEstate?.schemaVersion === 2)
    ) {
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
    if (item.categoryId === 'mortgage' && item.detail != null) {
      if (!isPlainObject(item.detail) || Object.keys(item.detail).some((key) => key !== 'mortgage')) {
        throw new Error('A canonical mortgage detail is required')
      }
      assertCanonicalMortgage(item.detail.mortgage, item.balance)
    }
    return cleanItem({ ...item, categoryId: category })
  }

  if (section === 'income') {
    assertCanonicalText(item.subcategoryId, 'A valid income subcategory is required')
    assertCanonicalText(item.itemName, 'An income item name is required')
    assertCanonicalTextField(item.notes, 'Canonical income notes are required')
    assertCanonicalIncomeCalculation(item.calculation)
    if (item.entryMode != null && !['simple', 'detailed'].includes(item.entryMode)) {
      throw new Error('A valid income entry mode is required')
    }
    if (item.portfolioAssetId != null) {
      if (category !== 'investments' || item.subcategoryId !== 'dividends') {
        throw new Error('Only dividend income can link to an investment portfolio')
      }
      assertCanonicalText(item.portfolioAssetId, 'A valid linked portfolio is required')
    }
    const isDividendIncome = category === 'investments' && item.subcategoryId === 'dividends'
    const disposablePercentage = isDividendIncome ? item.disposablePercentage ?? 100 : 100
    assertPercentage(disposablePercentage, 'A valid available-income percentage is required')
    return cleanItem({ ...item, categoryId: category, disposablePercentage })
  }

  return canonicalExpense(item, category)
}

function assertCanonicalMortgage(mortgage, currentBalance) {
  if (!isPlainObject(mortgage) || ![1, 2].includes(mortgage.schemaVersion)) {
    throw new Error('A canonical mortgage model is required')
  }
  assertNonNegativeMoney(mortgage.originalPrincipal, 'A valid original principal is required')
  assertNonNegativeMoney(mortgage.monthlyPayment, 'A valid monthly payment is required')
  if (mortgage.monthlyPayment <= 0) throw new Error('A valid monthly payment is required')
  if (
    typeof mortgage.annualInterestRate !== 'number' ||
    !Number.isFinite(mortgage.annualInterestRate) ||
    mortgage.annualInterestRate < 0 ||
    mortgage.annualInterestRate > 100
  ) {
    throw new Error('A valid annual interest rate is required')
  }
  if (
    !Number.isInteger(mortgage.termMonths) ||
    mortgage.termMonths <= 0 ||
    mortgage.termMonths > 1_200
  ) {
    throw new Error('A valid mortgage term is required')
  }
  if (!isCanonicalIsoDate(mortgage.startDate)) {
    throw new Error('A valid mortgage start date is required')
  }
  if (mortgage.amortizationType !== 'french' || mortgage.fixedRate !== true) {
    throw new Error('Only fixed-rate French amortization is supported')
  }
  if (mortgage.schemaVersion === 2) {
    if (!isPlainObject(mortgage.balanceAnchor)) {
      throw new Error('A valid mortgage balance anchor is required')
    }
    assertNonNegativeMoney(
      mortgage.balanceAnchor.amount,
      'A valid mortgage balance anchor is required',
    )
    if (
      !isCanonicalIsoDate(mortgage.balanceAnchor.date) ||
      mortgage.balanceAnchor.date < mortgage.startDate ||
      mortgage.balanceAnchor.amount > mortgage.originalPrincipal
    ) {
      throw new Error('A valid mortgage balance anchor is required')
    }
  }
  if (currentBalance > mortgage.originalPrincipal) {
    throw new Error('The current balance cannot exceed the original principal')
  }
  const monthlyInterest = roundMoney(currentBalance * (mortgage.annualInterestRate / 100 / 12))
  if (currentBalance > 0 && mortgage.monthlyPayment <= monthlyInterest) {
    throw new Error('The monthly payment must cover the accrued interest')
  }
}

function assertCanonicalRealEstate(realEstate, asset) {
  const commonValid =
    isPlainObject(realEstate) &&
    [1, 2].includes(realEstate.schemaVersion) &&
    asset.categoryId === 'real_estate' &&
    typeof realEstate.annualAppreciationRate === 'number' &&
    Number.isFinite(realEstate.annualAppreciationRate) &&
    realEstate.annualAppreciationRate >= -100 &&
    realEstate.annualAppreciationRate <= 100
  if (!commonValid) {
    throw new Error('A canonical real estate model is required')
  }
  if (realEstate.schemaVersion === 2) {
    assertNonNegativeMoney(realEstate.purchasePrice, 'A valid purchase price is required')
    if (!isCanonicalIsoDate(realEstate.purchaseDate)) {
      throw new Error('A valid purchase date is required')
    }
    annualRealEstateValue(realEstate, madridToday())
  }
}

function isCanonicalIsoDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return false
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return (
    date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() === Number(match[2]) - 1 &&
    date.getUTCDate() === Number(match[3])
  )
}

function madridToday() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Europe/Madrid',
    })
      .formatToParts(new Date())
      .map(({ type, value }) => [type, value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}`
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
  if (item.entryMode != null && !['simple', 'detailed'].includes(item.entryMode)) {
    throw new Error('A valid expense entry mode is required')
  }
  if (item.liabilityId != null) {
    assertCanonicalText(item.liabilityId, 'A valid linked mortgage is required')
    if (item.subcategoryId !== 'mortgage_rent') {
      throw new Error('Only a mortgage expense can link a mortgage')
    }
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

function assertUniquePortfolioIncomeLink(items, candidate, candidateId = null) {
  if (!candidate?.portfolioAssetId) return
  if (
    items.some(
      (item) => item.id !== candidateId && item.portfolioAssetId === candidate.portfolioAssetId,
    )
  ) {
    throw new Error('This portfolio is already linked to another dividend income source')
  }
}

function assertLinkedMortgage(section, items, candidate, candidateId, liabilities) {
  const linkField = section === 'assets' ? 'mortgageLiabilityId' : 'liabilityId'
  if (!['assets', 'expenses'].includes(section) || !candidate?.[linkField]) return

  const mortgage = liabilities.find(({ id }) => id === candidate[linkField])
  if (!mortgage || mortgage.categoryId !== 'mortgage') {
    throw new Error('The linked mortgage does not exist')
  }
  if (items.some((item) => item.id !== candidateId && item[linkField] === candidate[linkField])) {
    throw new Error(
      section === 'assets' ?
        'This mortgage is already linked to another property' :
        'This mortgage is already linked to another expense',
    )
  }
}

function assertMortgageManagedRelationship(section, previous, candidate) {
  const linkField = section === 'assets' ? 'mortgageLiabilityId' : 'liabilityId'
  if (!['assets', 'expenses'].includes(section)) return
  if (!previous && candidate?.[linkField] != null) {
    throw new Error('Mortgage relationships must be managed from the mortgage model')
  }
  // Legacy unlinked items may not have the relationship field at all. Treat a
  // missing field and an explicit null as the same unlinked state.
  if (previous && (previous[linkField] ?? null) !== (candidate?.[linkField] ?? null)) {
    throw new Error('Mortgage relationships must be managed from the mortgage model')
  }
}

function syncMortgageAssetRelation(
  transaction,
  snapshot,
  mortgageId,
  userId,
  relationProvided,
  selectedAssetId,
) {
  if (!relationProvided) return
  const linked = (snapshot?.docs || []).filter(
    (document) => document.data()?.mortgageLiabilityId === mortgageId,
  )
  if (linked.length > 1) throw new Error('This mortgage is linked to multiple properties')

  const selected = selectedAssetId ?
    (snapshot?.docs || []).find((document) => document.id === selectedAssetId) || null :
    null
  if (selectedAssetId && !selected) throw new Error('The linked property does not exist')
  if (selected) {
    const asset = selected.data()
    if (
      asset.categoryId !== 'real_estate' ||
      !['primary_home', 'rental_property'].includes(asset.subcategoryId)
    ) {
      throw new Error('Only a home or rental property can be linked to a mortgage')
    }
    if (asset.mortgageLiabilityId && asset.mortgageLiabilityId !== mortgageId) {
      throw new Error('This property is already linked to another mortgage')
    }
  }

  for (const previous of linked) {
    if (previous.id === selected?.id) continue
    transaction.update(previous.ref, {
      mortgageLiabilityId: null,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: userId,
    })
  }
  if (selected && selected.data()?.mortgageLiabilityId !== mortgageId) {
    transaction.update(selected.ref, {
      mortgageLiabilityId: mortgageId,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: userId,
    })
  }
}

function synchronizeExpenseCandidate(section, candidate, liabilities) {
  if (section !== 'expenses' || !candidate?.liabilityId) return
  const mortgage = liabilities.find(({ id }) => id === candidate.liabilityId)
  const payment = mortgage?.detail?.mortgage?.monthlyPayment
  if (!Number.isFinite(payment)) return
  const amount = payment
  candidate.estimate = { amount, frequency: 'monthly' }
  candidate.monthlyAmounts = Object.fromEntries(MONTHS.map((month) => [month, amount]))
  candidate.variability = 'fixed'
  candidate.recurrence = 'recurring'
}

function syncMortgageExpenseRelation(
  transaction,
  snapshot,
  mortgage,
  mortgageId,
  userId,
  relationProvided,
  selectedExpenseId,
) {
  const linked = (snapshot?.docs || []).filter(
    (document) => document.data()?.liabilityId === mortgageId,
  )
  if (linked.length > 1) throw new Error('This mortgage is linked to multiple expenses')

  const selected = relationProvided ?
    (snapshot?.docs || []).find((document) => document.id === selectedExpenseId) || null :
    linked[0] || null
  if (selectedExpenseId && !selected) throw new Error('The linked mortgage expense does not exist')
  if (selected) {
    const expense = selected.data()
    if (expense.categoryId !== 'housing' || expense.subcategoryId !== 'mortgage_rent') {
      throw new Error('Only a mortgage expense can be linked to a mortgage')
    }
    if (expense.liabilityId && expense.liabilityId !== mortgageId) {
      throw new Error('This expense is already linked to another mortgage')
    }
    if (!mortgage.detail?.mortgage) {
      throw new Error('Set up the mortgage model before linking an expense')
    }
  }
  if (!selected && !linked.length) return null

  const nextExpenses = documents(snapshot)
  for (const previous of linked) {
    if (previous.id === selected?.id) continue
    const updated = {
      ...previous.data(),
      liabilityId: null,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: userId,
    }
    transaction.set(previous.ref, updated)
    replaceDocument(nextExpenses, previous.id, updated)
  }

  if (!selected) return nextExpenses

  const amount = mortgage.detail.mortgage.monthlyPayment
  const monthlyAmounts = Object.fromEntries(MONTHS.map((month) => [month, amount]))
  const updated = {
    ...selected.data(),
    liabilityId: mortgageId,
    estimate: { amount, frequency: 'monthly' },
    monthlyAmounts,
    variability: 'fixed',
    recurrence: 'recurring',
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: userId,
  }
  transaction.set(selected.ref, updated)
  replaceDocument(nextExpenses, selected.id, updated)

  return nextExpenses
}

function replaceDocument(items, itemId, data) {
  const index = items.findIndex(({ id }) => id === itemId)
  if (index >= 0) items[index] = { id: itemId, ...data }
}

function resolveItemReference(itemsReference, operation, itemId) {
  if (operation === 'deleteCategory') return null
  if (operation === 'create') {
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

function unlinkPortfolioIncome(transaction, snapshot, assetIds, userId) {
  for (const document of snapshot?.docs || []) {
    if (!assetIds.has(document.data()?.portfolioAssetId)) continue
    transaction.update(document.ref, {
      portfolioAssetId: null,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: userId,
    })
  }
}

function unlinkMortgageRelations(transaction, assetsSnapshot, expensesSnapshot, mortgageIds, userId) {
  for (const document of assetsSnapshot?.docs || []) {
    if (!mortgageIds.has(document.data()?.mortgageLiabilityId)) continue
    transaction.update(document.ref, {
      mortgageLiabilityId: null,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: userId,
    })
  }
  const nextExpenses = documents(expensesSnapshot)
  let expensesChanged = false
  for (const document of expensesSnapshot?.docs || []) {
    if (!mortgageIds.has(document.data()?.liabilityId)) continue
    const updated = {
      ...document.data(),
      liabilityId: null,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: userId,
    }
    transaction.set(document.ref, updated)
    replaceDocument(nextExpenses, document.id, updated)
    expensesChanged = true
  }
  return expensesChanged ? nextExpenses : null
}

function assertDeleteCategoryWriteLimit(
  section,
  categoryItems,
  linkedIncomeSnapshot,
  itemIds,
  linkedAssetsSnapshot,
  linkedExpensesSnapshot,
) {
  const linkedIncomeWrites = (linkedIncomeSnapshot?.docs || []).filter((document) =>
    itemIds.has(document.data()?.portfolioAssetId),
  ).length
  const trackingConfigWrites = section === 'expenses' && categoryItems.length ? 1 : 0
  const linkedMortgageWrites =
    section === 'liabilities' ?
      (linkedAssetsSnapshot?.docs || []).filter((document) =>
          itemIds.has(document.data()?.mortgageLiabilityId),
        ).length +
        (linkedExpensesSnapshot?.docs || []).filter((document) =>
          itemIds.has(document.data()?.liabilityId),
        ).length :
      0
  const totalWrites =
    categoryItems.length + linkedIncomeWrites + linkedMortgageWrites + trackingConfigWrites + 2

  if (totalWrites > MAX_TRANSACTION_WRITES) {
    throw new Error('This category has too many related items to delete at once')
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

function assertPercentage(value, message) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
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

function isOptionalCanonicalId(value) {
  return (
    value == null ||
    (typeof value === 'string' && Boolean(value.trim()) && value === value.trim())
  )
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

export { financialModelMutationInput, mutateFinancialModel }
export default { financialModelMutationInput, mutateFinancialModel }
