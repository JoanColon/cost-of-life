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
    year,
    projectionState,
    months,
  }
  return result
}

function hasPositionValue(config, items) {
  if (items.some((item) => config?.categories?.[item.category]?.enabled)) return true
  return Object.values(config?.categories || {}).some(
    (category) => category?.enabled && Number(category.manualValue) > 0,
  )
}

function buildPositionMonth(categoryConfig, items, valueField) {
  const grouped = groupBy(items, 'category')
  const categories = {}
  for (const [categoryId, category] of Object.entries(categoryConfig)) {
    if (!category?.enabled) continue
    const categoryItems = grouped[categoryId] || []
    const subcategories = {}
    if (categoryItems.length) {
      for (const item of categoryItems) {
        const total = money(item[valueField])
        subcategories[item.id] = {
          name: item.name || '',
          type: item.type || '',
          total,
          memberValues: allocate(total, item.ownership),
        }
      }
    } else {
      const total = money(category.manualValue)
      subcategories[categoryId] = {
        name: '',
        type: categoryId,
        total,
        memberValues: allocate(total, category.ownership),
      }
    }
    categories[categoryId] = { subcategories }
  }
  return { categories }
}

function buildExpenseMonth(categoryConfig, expenses, trackingMonth, monthName) {
  const grouped = groupBy(expenses, 'category')
  const categories = {}
  for (const [categoryId, category] of Object.entries(categoryConfig)) {
    if (!category?.enabled) continue
    const categoryItems = grouped[categoryId] || []
    const subcategories = {}
    if (categoryItems.length) {
      for (const expense of categoryItems) {
        const id = expense.type === 'other' ? expense.id : expense.type
        const estimated = expenseMonth(expense, monthName)
        const tracked = expense.type === 'other' ? null : trackedValue(trackingMonth, expense.type)
        const applied = tracked?.applied === true
        subcategories[id] = {
          name: expense.name || '',
          type: expense.type,
          estimated,
          actual: tracked?.actual ?? null,
          effective: applied ? tracked.total : estimated,
          source: applied ? 'tracked' : 'model',
          memberValues: applied ? tracked.memberValues : allocate(estimated, expense.ownership),
          estimatedMemberValues: allocate(estimated, expense.ownership),
          actualMemberValues: tracked?.actualMemberValues || {},
        }
      }
    } else {
      const estimated = simpleExpenseMonth(category, monthName)
      subcategories[categoryId] = {
        name: '',
        type: categoryId,
        estimated,
        actual: null,
        effective: estimated,
        source: 'model',
        memberValues: allocate(estimated, category.ownership),
        estimatedMemberValues: allocate(estimated, category.ownership),
        actualMemberValues: {},
      }
    }
    categories[categoryId] = { subcategories }
  }
  return { categories }
}

function buildIncomeMonth(categoryConfig, income, monthIndex) {
  const grouped = groupBy(income, 'category')
  const categories = {}
  for (const [categoryId, category] of Object.entries(categoryConfig)) {
    if (!category?.enabled) continue
    const categoryItems = grouped[categoryId] || []
    const subcategories = {}
    if (categoryItems.length) {
      for (const item of categoryItems) {
        const total = incomeMonth(item.calculation, monthIndex)
        subcategories[item.id] = {
          name: item.name || '',
          type: item.subtype || '',
          total,
          memberValues: allocate(total, item.ownership),
        }
      }
    } else {
      const total = distributeAnnual(category.manualValue, monthIndex)
      subcategories[categoryId] = {
        name: '',
        type: categoryId,
        total,
        memberValues: allocate(total, category.ownership),
      }
    }
    categories[categoryId] = { subcategories }
  }
  return { categories }
}

function expenseMonth(expense, monthName) {
  if (expense.monthlyAmounts && Object.hasOwn(expense.monthlyAmounts, monthName)) {
    return money(expense.monthlyAmounts[monthName])
  }
  return estimateMonth(expense.estimate, monthName, 0)
}

function simpleExpenseMonth(category = {}, monthName) {
  if (category.monthlyAmounts && Object.hasOwn(category.monthlyAmounts, monthName)) {
    return money(category.monthlyAmounts[monthName])
  }
  return estimateMonth(category.manualEstimate, monthName, 0)
}

function estimateMonth(estimate, monthName, annualFallback) {
  const amount = Number(estimate?.amount) || 0
  const index = MONTHS.indexOf(monthName)
  if (estimate?.frequency === 'monthly') return money(amount)
  if (estimate?.frequency === 'every_two_months') return index % 2 === 0 ? money(amount) : 0
  if (estimate?.frequency === 'quarterly') return index % 3 === 0 ? money(amount) : 0
  if (estimate?.frequency === 'yearly') return index === 0 ? money(amount) : 0
  return money((Number(annualFallback) || 0) / 12)
}

function incomeMonth(calculation, monthIndex) {
  if (calculation?.mode === 'monthly_schedule') {
    return money(
      (Number(calculation.monthlyAmount) || 0) +
        (Number(calculation.extrasByMonth?.[MONTHS[monthIndex]]) || 0),
    )
  }
  if (calculation?.mode === 'annual_salary') {
    return distributeAnnual(calculation.annualAmount, monthIndex)
  }
  if (calculation?.mode === 'one_time') {
    const month = MONTHS.includes(calculation.month) ? calculation.month : 'january'
    return month === MONTHS[monthIndex] ? money(calculation.amount) : 0
  }
  const multiplier =
    { weekly: 52, monthly: 12, quarterly: 4, yearly: 1 }[calculation?.frequency] || 0
  return distributeAnnual((Number(calculation?.amount) || 0) * multiplier, monthIndex)
}

function distributeAnnual(value, monthIndex) {
  const annualCents = Math.round(money(value) * 100)
  const monthlyCents = Math.floor(annualCents / 12)
  const remainder = annualCents % 12
  return money((monthlyCents + (monthIndex < remainder ? 1 : 0)) / 100)
}

function trackedValue(month, id) {
  const category = month?.categories?.[id]
  const applied = month?.reconciliation?.[id]?.decision === 'tracked'
  const hasActual = Boolean(category) || applied
  const items = category?.items || []
  const total = money(items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0))
  const memberValues = items.reduce(
    (sum, item) => addMaps(sum, allocate(item.amount, item.ownership)),
    {},
  )
  return {
    applied,
    actual: hasActual ? total : null,
    total,
    memberValues,
    actualMemberValues: hasActual ? memberValues : {},
  }
}

function applyTrackingMonth(financialYear, monthKey, trackingMonth) {
  const previous = financialYear?.months?.[monthKey]
  if (!previous) return financialYear
  const categories = {}
  for (const [categoryId, category] of Object.entries(previous.expenses?.categories || {})) {
    const subcategories = {}
    for (const [id, item] of Object.entries(category.subcategories || {})) {
      if (item.type === 'other') {
        subcategories[id] = item
        continue
      }
      const tracked = trackedValue(trackingMonth, item.type)
      const applied = tracked.applied === true
      subcategories[id] = {
        ...item,
        actual: tracked.actual,
        effective: applied ? tracked.total : item.estimated,
        source: applied ? 'tracked' : 'model',
        memberValues: applied ?
          tracked.memberValues :
          item.estimatedMemberValues || item.memberValues,
        actualMemberValues: tracked.actualMemberValues,
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
    ['status', 'generatedAt', 'updatedAt']
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
  const amountInCents = Math.round(money(value) * 100)
  const shares = (ownership?.shares || []).filter((share) => Number(share.percentage) > 0)
  let assignedCents = 0
  shares.forEach((share, index) => {
    const cents =
      index === shares.length - 1 ?
        amountInCents - assignedCents :
        Math.round((amountInCents * Number(share.percentage)) / 100)
    assignedCents += cents
    result[share.memberId] = money((result[share.memberId] || 0) + cents / 100)
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
    [...keys].map((key) => [key, money((Number(first[key]) || 0) + (Number(second[key]) || 0))]),
  )
}

function money(value) {
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
