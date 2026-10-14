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

const SCHEMA_VERSION = 1

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
          previous.assets || aggregateSection({})
      const liabilitiesValue =
        affected.has('liabilities') && monthKey >= liabilityStartMonth ?
          buildPositionMonth(config.liabilities?.categories || {}, liabilities, 'balance') :
          previous.liabilities || aggregateSection({})
      const expensesValue = affected.has('expenses') ?
        buildExpenseMonth(
            config.expenses?.categories || {},
            expenses,
            trackingMonths[`${year}-${monthKey}`],
            monthName,
          ) :
        previous.expenses || aggregateSection({})
      const incomeValue = affected.has('income') ?
        buildIncomeMonth(config.income?.categories || {}, income, monthIndex) :
        previous.income || aggregateSection({})
      return [
        monthKey,
        {
          ...previous,
          assets: assetsValue,
          liabilities: liabilitiesValue,
          income: incomeValue,
          expenses: expensesValue,
          netWorth: money(assetsValue.total - liabilitiesValue.total),
          memberNetWorth: subtractMaps(assetsValue.memberValues, liabilitiesValue.memberValues),
          savings: money(incomeValue.total - expensesValue.total),
          memberSavings: subtractMaps(incomeValue.memberValues, expensesValue.memberValues),
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

  return {
    ...financialYear,
    year,
    schemaVersion: SCHEMA_VERSION,
    projectionState,
    months,
    totals: annualTotals(months),
  }
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
    categories[categoryId] = aggregateCategory(subcategories, 'total')
  }
  return aggregateSection(categories)
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
    categories[categoryId] = aggregateCategory(subcategories, 'effective')
  }
  return aggregateSection(categories)
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
      const total = money((Number(category.manualValue) || 0) / 12)
      subcategories[categoryId] = {
        name: '',
        type: categoryId,
        total,
        memberValues: allocate(total, category.ownership),
      }
    }
    categories[categoryId] = aggregateCategory(subcategories, 'total')
  }
  return aggregateSection(categories)
}

function annualTotals(months) {
  const endingPosition = months['12']
  const incomeCategories = annualCategories(months, 'income')
  const expensesCategories = annualCategories(months, 'expenses')
  const incomeMemberValues = sumMonthMaps(months, 'income')
  const expensesMemberValues = sumMonthMaps(months, 'expenses')
  return {
    assets: endingPosition.assets.total,
    liabilities: endingPosition.liabilities.total,
    netWorth: endingPosition.netWorth,
    assetsMemberValues: endingPosition.assets.memberValues,
    liabilitiesMemberValues: endingPosition.liabilities.memberValues,
    memberNetWorth: endingPosition.memberNetWorth,
    assetsCategories: endingPosition.assets.categories,
    liabilitiesCategories: endingPosition.liabilities.categories,
    income: sumMonths(months, 'income'),
    expenses: sumMonths(months, 'expenses'),
    savings: money(Object.values(months).reduce((sum, month) => sum + month.savings, 0)),
    incomeMemberValues,
    expensesMemberValues,
    memberSavings: subtractMaps(incomeMemberValues, expensesMemberValues),
    incomeCategories,
    expensesCategories,
  }
}

function annualCategories(months, section) {
  const result = {}
  for (const month of Object.values(months)) {
    for (const [categoryId, category] of Object.entries(month[section].categories)) {
      const target = (result[categoryId] ||= { total: 0, memberValues: {}, subcategories: {} })
      target.total = money(target.total + category.total)
      target.memberValues = addMaps(target.memberValues, category.memberValues)
      for (const [id, item] of Object.entries(category.subcategories)) {
        const annual = (target.subcategories[id] ||= {
          name: item.name,
          type: item.type,
          estimated: 0,
          actual: 0,
          effective: 0,
          total: 0,
          trackedMonths: 0,
          memberValues: {},
        })
        annual.estimated = money(annual.estimated + (Number(item.estimated) || 0))
        if (item.actual != null) annual.actual = money(annual.actual + item.actual)
        annual.effective = money(annual.effective + (Number(item.effective) || 0))
        annual.total = money(annual.total + (Number(item.total) || 0))
        if (item.source === 'tracked') annual.trackedMonths += 1
        annual.memberValues = addMaps(annual.memberValues, item.memberValues)
      }
    }
  }
  return result
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
    return money((Number(calculation.annualAmount) || 0) / 12)
  }
  if (calculation?.mode === 'one_time') {
    const month = MONTHS.includes(calculation.month) ? calculation.month : 'january'
    return month === MONTHS[monthIndex] ? money(calculation.amount) : 0
  }
  const multiplier =
    { weekly: 52, monthly: 12, quarterly: 4, yearly: 1 }[calculation?.frequency] || 0
  return money(((Number(calculation?.amount) || 0) * multiplier) / 12)
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
    categories[categoryId] = aggregateCategory(subcategories, 'effective')
  }
  const expenses = aggregateSection(categories)
  const month = {
    ...previous,
    expenses,
    savings: money(previous.income.total - expenses.total),
    memberSavings: subtractMaps(previous.income.memberValues, expenses.memberValues),
  }
  const months = { ...financialYear.months, [monthKey]: month }
  return { ...financialYear, months, totals: annualTotals(months) }
}

function aggregateCategory(subcategories, field) {
  return {
    total: money(
      Object.values(subcategories).reduce((sum, item) => sum + (Number(item[field]) || 0), 0),
    ),
    memberValues: Object.values(subcategories).reduce(
      (sum, item) => addMaps(sum, item.memberValues),
      {},
    ),
    subcategories,
  }
}

function aggregateSection(categories) {
  return {
    total: money(Object.values(categories).reduce((sum, category) => sum + category.total, 0)),
    memberValues: Object.values(categories).reduce(
      (sum, category) => addMaps(sum, category.memberValues),
      {},
    ),
    categories,
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

function subtractMaps(first = {}, second = {}) {
  const keys = new Set([...Object.keys(first), ...Object.keys(second)])
  return Object.fromEntries(
    [...keys].map((key) => [key, money((Number(first[key]) || 0) - (Number(second[key]) || 0))]),
  )
}

function sumMonths(months, section) {
  return money(Object.values(months).reduce((sum, month) => sum + month[section].total, 0))
}

function sumMonthMaps(months, section) {
  return Object.values(months).reduce((sum, month) => addMaps(sum, month[section].memberValues), {})
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
  SCHEMA_VERSION,
  applyTrackingMonth,
  buildFinancialYear,
  updateFinancialYearProjection,
}
