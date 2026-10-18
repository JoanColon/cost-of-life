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

function buildFinancialYear({
  year,
  config = {},
  assets = [],
  liabilities = [],
  expenses = [],
  income = [],
  trackingMonths = {},
}) {
  return updateFinancialYearProjection(
    {},
    {
      year,
      config,
      assets,
      liabilities,
      expenses,
      income,
      trackingMonths,
      sections: ['assets', 'liabilities', 'income', 'expenses'],
    },
  )
}

function updateFinancialYearProjection(
  financialYear,
  {
    year,
    config = {},
    assets = [],
    liabilities = [],
    expenses = [],
    income = [],
    trackingMonths = {},
    sections = [],
    positionFromMonths = {},
    positionObservedMonth = '01',
  },
) {
  assertYear(year)
  assertMonth(positionObservedMonth)
  const assetStartMonth = positionFromMonths.assets || '01'
  const liabilityStartMonth = positionFromMonths.liabilities || '01'
  assertMonth(assetStartMonth)
  assertMonth(liabilityStartMonth)
  const affected = new Set(sections)
  const months = Object.fromEntries(
    MONTHS.map((monthName, monthIndex) => {
      const monthKey = String(monthIndex + 1).padStart(2, '0')
      const previous = financialYear?.months?.[monthKey] || {}
      const assetsValue =
        affected.has('assets') && monthKey >= assetStartMonth ?
          buildPositionMonth(config.assets?.categories || {}, assets, 'currentValue') :
          canonicalSection(previous.assets)
      const liabilitiesValue =
        affected.has('liabilities') && monthKey >= liabilityStartMonth ?
          buildPositionMonth(config.liabilities?.categories || {}, liabilities, 'balance') :
          canonicalSection(previous.liabilities)
      const expensesValue = affected.has('expenses') ?
        buildExpenseMonth(
            config.expenses?.categories || {},
            expenses,
            trackingMonths[`${year}-${monthKey}`],
            monthName,
          ) :
        canonicalSection(previous.expenses)
      const incomeValue = affected.has('income') ?
        buildIncomeMonth(config.income?.categories || {}, income, monthIndex) :
        canonicalSection(previous.income)
      return [
        monthKey,
        {
          assets: assetsValue,
          liabilities: liabilitiesValue,
          income: incomeValue,
          expenses: expensesValue,
        },
      ]
    }),
  )

  const projectionState = { ...(financialYear?.projectionState || {}) }
  if (
    affected.has('assets') &&
    !projectionState.assetsInitializedMonth &&
    hasPositionValue(config.assets, assets)
  ) {
    projectionState.assetsInitializedMonth = positionObservedMonth
  }
  if (
    affected.has('liabilities') &&
    !projectionState.liabilitiesInitializedMonth &&
    hasPositionValue(config.liabilities, liabilities)
  ) {
    projectionState.liabilitiesInitializedMonth = positionObservedMonth
  }

  const result = {
    ...financialYearMetadata(financialYear),
    schemaVersion: 1,
    year,
    projectionState,
    months,
  }
  return result
}

function hasPositionValue(config, items) {
  if (items.some((item) => config?.categories?.[item.categoryId]?.enabled)) return true
  return Object.values(config?.categories || {}).some(
    (category) => category?.enabled && Number(category.manualValue) > 0,
  )
}

function buildPositionMonth(categoryConfig, items, valueField) {
  const grouped = groupBy(items, 'categoryId')
  const categories = {}
  for (const [categoryId, category] of Object.entries(categoryConfig)) {
    if (!category?.enabled) continue
    const categoryItems = grouped[categoryId] || []
    const subcategories = {}
    if (categoryItems.length) {
      const subcategoryIds = [...new Set(categoryItems.map((item) => item.subcategoryId))]
      for (const subcategoryId of subcategoryIds) {
        const subcategoryItems = categoryItems.filter(
          (item) => item.subcategoryId === subcategoryId,
        )
        const projectedItems = Object.fromEntries(
          subcategoryItems.map((item) => {
            const total = moneyOrZero(item[valueField])
            return [
              item.id,
              {
                itemName: item.itemName,
                notes: item.notes || '',
                total,
                memberValues: allocate(total, item.ownership),
              },
            ]
          }),
        )
        subcategories[subcategoryId] = {
          items: projectedItems,
          total: moneyOrZero(
            Object.values(projectedItems).reduce((sum, item) => sum + item.total, 0),
          ),
          memberValues: Object.values(projectedItems).reduce(
            (sum, item) => addMaps(sum, item.memberValues),
            {},
          ),
        }
      }
    } else {
      const total = moneyOrZero(category.manualValue)
      subcategories[categoryId] = {
        total,
        memberValues: allocate(total, category.ownership),
      }
    }
    categories[categoryId] = { subcategories }
  }
  return { categories }
}

function buildExpenseMonth(categoryConfig, expenses, trackingMonth, monthName) {
  const grouped = groupBy(expenses, 'categoryId')
  const categories = {}
  for (const [categoryId, category] of Object.entries(categoryConfig)) {
    if (!category?.enabled) continue
    const categoryItems = grouped[categoryId] || []
    const subcategories = {}
    const subcategoryIds = [...new Set(categoryItems.map((item) => item.subcategoryId))]
    for (const subcategoryId of subcategoryIds) {
      const modelItems = categoryItems.filter((item) => item.subcategoryId === subcategoryId)
      const tracked = trackedValue(trackingMonth, subcategoryId)
      const applied = tracked.applied === true
      const items = Object.fromEntries(
        modelItems.map((expense) => {
          const estimated = expenseMonth(expense, monthName)
          const actual = tracked.items[expense.id]
          const estimatedMemberValues = allocate(estimated, expense.ownership)
          return [
            expense.id,
            {
              itemName: expense.itemName,
              notes: expense.notes || '',
              estimated,
              actual: actual?.total ?? null,
              effective: applied ? actual?.total || 0 : estimated,
              source: applied ? 'tracked' : 'model',
              necessity: expense.necessity ?? null,
              memberValues: applied ? actual?.memberValues || {} : estimatedMemberValues,
              estimatedMemberValues,
              actualMemberValues: actual?.memberValues || {},
            },
          ]
        }),
      )
      const estimated = moneyOrZero(
        Object.values(items).reduce((sum, item) => sum + item.estimated, 0),
      )
      const estimatedMemberValues = Object.values(items).reduce(
        (sum, item) => addMaps(sum, item.estimatedMemberValues),
        {},
      )
      subcategories[subcategoryId] = {
        estimated,
        actual: tracked.actual,
        effective: applied ? tracked.total : estimated,
        source: applied ? 'tracked' : 'model',
        necessity: null,
        memberValues: applied ? tracked.memberValues : estimatedMemberValues,
        estimatedMemberValues,
        actualMemberValues: tracked.actualMemberValues,
        items,
      }
    }
    categories[categoryId] = { subcategories }
  }
  return { categories }
}

function buildIncomeMonth(categoryConfig, income, monthIndex) {
  const grouped = groupBy(income, 'categoryId')
  const categories = {}
  for (const [categoryId, category] of Object.entries(categoryConfig)) {
    if (!category?.enabled) continue
    const categoryItems = grouped[categoryId] || []
    const subcategories = {}
    const subcategoryIds = [...new Set(categoryItems.map((item) => item.subcategoryId))]
    for (const subcategoryId of subcategoryIds) {
      const items = Object.fromEntries(
        categoryItems
          .filter((item) => item.subcategoryId === subcategoryId)
          .map((item) => {
            const total = incomeMonth(item.calculation, monthIndex)
            return [
              item.id,
              {
                itemName: item.itemName,
                notes: item.notes || '',
                total,
                disposablePercentage: disposablePercentage(item.disposablePercentage),
                memberValues: allocate(total, item.ownership),
              },
            ]
          }),
      )
      subcategories[subcategoryId] = {
        items,
        total: moneyOrZero(Object.values(items).reduce((sum, item) => sum + item.total, 0)),
        memberValues: Object.values(items).reduce(
          (sum, item) => addMaps(sum, item.memberValues),
          {},
        ),
      }
    }
    categories[categoryId] = { subcategories }
  }
  return { categories }
}

function disposablePercentage(value) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : 100
}

function expenseMonth(expense, monthName) {
  if (expense.monthlyAmounts && Object.hasOwn(expense.monthlyAmounts, monthName)) {
    return moneyOrZero(expense.monthlyAmounts[monthName])
  }
  return estimateMonth(expense.estimate, monthName)
}

function estimateMonth(estimate, monthName) {
  const amount = Number(estimate?.amount) || 0
  const index = MONTHS.indexOf(monthName)
  if (estimate?.frequency === 'monthly') return moneyOrZero(amount)
  if (estimate?.frequency === 'every_two_months') return index % 2 === 0 ? moneyOrZero(amount) : 0
  if (estimate?.frequency === 'quarterly') return index % 3 === 0 ? moneyOrZero(amount) : 0
  if (estimate?.frequency === 'yearly') return index === 0 ? moneyOrZero(amount) : 0
  return 0
}

function incomeMonth(calculation, monthIndex) {
  if (calculation?.mode === 'monthly_schedule') {
    return moneyOrZero(
      (Number(calculation.monthlyAmount) || 0) +
        (Number(calculation.extrasByMonth?.[MONTHS[monthIndex]]) || 0),
    )
  }
  if (calculation?.mode === 'annual_salary') {
    return distributeAnnual(calculation.annualAmount, monthIndex)
  }
  if (calculation?.mode === 'one_time') {
    const month = MONTHS.includes(calculation.month) ? calculation.month : 'january'
    return month === MONTHS[monthIndex] ? moneyOrZero(calculation.amount) : 0
  }
  const multiplier = { monthly: 12, quarterly: 4, yearly: 1 }[calculation?.frequency] || 0
  return distributeAnnual((Number(calculation?.amount) || 0) * multiplier, monthIndex)
}

function distributeAnnual(value, monthIndex) {
  const annualCents = Math.round(moneyOrZero(value) * 100)
  const monthlyCents = Math.floor(annualCents / 12)
  const remainder = annualCents % 12
  return moneyOrZero((monthlyCents + (monthIndex < remainder ? 1 : 0)) / 100)
}

function trackedValue(month, id) {
  const category = month?.categories?.[id]
  const applied = month?.reconciliation?.[id]?.decision === 'tracked'
  const hasActual = Boolean(category) || applied
  const items = category?.items || []
  const total = moneyOrZero(items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0))
  const memberValues = items.reduce(
    (sum, item) => addMaps(sum, allocate(item.amount, item.ownership)),
    {},
  )
  const itemValues = {}
  for (const entry of items) {
    if (!entry.itemId) continue
    const target = (itemValues[entry.itemId] ||= { total: 0, memberValues: {} })
    target.total = moneyOrZero(target.total + (Number(entry.amount) || 0))
    target.memberValues = addMaps(target.memberValues, allocate(entry.amount, entry.ownership))
  }
  return {
    applied,
    actual: hasActual ? total : null,
    total,
    memberValues,
    actualMemberValues: hasActual ? memberValues : {},
    items: itemValues,
  }
}

function applyTrackingMonth(financialYear, monthKey, trackingMonth) {
  const previous = financialYear?.months?.[monthKey]
  if (!previous) return financialYear
  const categories = {}
  for (const [categoryId, category] of Object.entries(previous.expenses?.categories || {})) {
    const subcategories = {}
    for (const [id, item] of Object.entries(category.subcategories || {})) {
      const tracked = trackedValue(trackingMonth, id)
      const applied = tracked.applied === true
      const items = Object.fromEntries(
        Object.entries(item.items || {}).map(([itemId, modelItem]) => {
          const actual = tracked.items[itemId]
          return [
            itemId,
            {
              ...modelItem,
              actual: actual?.total ?? null,
              effective: applied ? actual?.total || 0 : modelItem.estimated,
              source: applied ? 'tracked' : 'model',
              memberValues: applied ?
                actual?.memberValues || {} :
                modelItem.estimatedMemberValues || modelItem.memberValues,
              actualMemberValues: actual?.memberValues || {},
            },
          ]
        }),
      )
      subcategories[id] = {
        ...item,
        actual: tracked.actual,
        effective: applied ? tracked.total : item.estimated,
        source: applied ? 'tracked' : 'model',
        memberValues: applied ?
          tracked.memberValues :
          item.estimatedMemberValues || item.memberValues,
        actualMemberValues: tracked.actualMemberValues,
        items,
      }
    }
    categories[categoryId] = { subcategories }
  }
  const expenses = { categories }
  const month = {
    assets: canonicalSection(previous.assets),
    liabilities: canonicalSection(previous.liabilities),
    income: canonicalSection(previous.income),
    expenses,
  }
  const months = { ...financialYear.months, [monthKey]: month }
  return {
    ...financialYearMetadata(financialYear),
    year: financialYear.year,
    projectionState: { ...(financialYear.projectionState || {}) },
    months,
  }
}

function financialYearMetadata(financialYear) {
  return Object.fromEntries(
    ['schemaVersion', 'status', 'generatedAt', 'updatedAt']
      .filter((field) => financialYear?.[field] != null)
      .map((field) => [field, financialYear[field]]),
  )
}

function canonicalSection(section) {
  return {
    categories: Object.fromEntries(
      Object.entries(section?.categories || {}).map(([categoryId, category]) => [
        categoryId,
        { subcategories: { ...(category?.subcategories || {}) } },
      ]),
    ),
  }
}

function allocate(value, ownership) {
  const result = {}
  const amountInCents = Math.round(moneyOrZero(value) * 100)
  const shares = (ownership?.shares || []).filter((share) => Number(share.percentage) > 0)
  let assignedCents = 0
  shares.forEach((share, index) => {
    const cents =
      index === shares.length - 1 ?
        amountInCents - assignedCents :
        Math.round((amountInCents * Number(share.percentage)) / 100)
    assignedCents += cents
    result[share.memberId] = moneyOrZero((result[share.memberId] || 0) + cents / 100)
  })
  return result
}

function groupBy(items, field) {
  return items.reduce((groups, item) => {
    groups[item[field]] = [...(groups[item[field]] || []), item]
    return groups
  }, {})
}

function addMaps(first = {}, second = {}) {
  const keys = new Set([...Object.keys(first), ...Object.keys(second)])
  return Object.fromEntries(
    [...keys].map((key) => [
      key,
      moneyOrZero((Number(first[key]) || 0) + (Number(second[key]) || 0)),
    ]),
  )
}

function moneyOrZero(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.round((number + Number.EPSILON) * 100) / 100 : 0
}

function assertYear(year) {
  if (!Number.isInteger(year) || year < 2000 || year > 9999) {
    throw new Error('A valid financial year is required')
  }
}

function assertMonth(month) {
  if (!/^(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error('A valid projection month is required')
  }
}

module.exports = {
  applyTrackingMonth,
  buildFinancialYear,
  updateFinancialYearProjection,
}
