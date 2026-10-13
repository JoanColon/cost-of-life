import { incomeMonths } from './income-calculations'
import { expenseAmountForMonth } from './expense-calculations'
import { applyOwnership } from './ownership'
import { isModelBaseline } from './model-baseline'

export const FINANCIAL_YEAR_SCHEMA_VERSION = 1
export const FINANCIAL_YEAR_TIME_ZONE = 'Europe/Madrid'

const monthKeys = incomeMonths.map((_, index) => String(index + 1).padStart(2, '0'))

export function currentFinancialYear(date = new Date()) {
  return Number(
    new Intl.DateTimeFormat('en', {
      year: 'numeric',
      timeZone: FINANCIAL_YEAR_TIME_ZONE,
    }).format(date),
  )
}

export function currentFinancialMonth(date = new Date()) {
  return new Intl.DateTimeFormat('en', {
    month: '2-digit',
    timeZone: FINANCIAL_YEAR_TIME_ZONE,
  }).format(date)
}

export function buildFinancialYear({
  year,
  config = {},
  assets = [],
  liabilities = [],
  expenses = [],
  income = [],
  trackingMonths = {},
}) {
  assertYear(year)
  const expenseCategories = config.expenses?.categories || {}
  const incomeCategories = config.income?.categories || {}
  const assetCategories = config.assets?.categories || {}
  const liabilityCategories = config.liabilities?.categories || {}

  const months = Object.fromEntries(
    monthKeys.map((monthKey, monthIndex) => {
      const expensesProjection = buildExpenseMonth({
        categoryConfig: expenseCategories,
        expenses,
        trackingMonth: trackingMonths[`${year}-${monthKey}`],
        monthIndex,
      })
      const incomeProjection = buildIncomeMonth({
        categoryConfig: incomeCategories,
        income,
        monthIndex,
      })
      const assetsProjection = buildPositionMonth(assetCategories, assets, 'currentValue')
      const liabilitiesProjection = buildPositionMonth(liabilityCategories, liabilities, 'balance')
      return [
        monthKey,
        {
          assets: assetsProjection,
          liabilities: liabilitiesProjection,
          income: incomeProjection,
          expenses: expensesProjection,
          netWorth: money(assetsProjection.total - liabilitiesProjection.total),
          memberNetWorth: subtractMaps(
            assetsProjection.memberValues,
            liabilitiesProjection.memberValues,
          ),
          savings: money(incomeProjection.total - expensesProjection.total),
          memberSavings: subtractMaps(
            incomeProjection.memberValues,
            expensesProjection.memberValues,
          ),
        },
      ]
    }),
  )

  return {
    year,
    schemaVersion: FINANCIAL_YEAR_SCHEMA_VERSION,
    months,
    totals: buildAnnualTotals(months),
  }
}

function buildPositionMonth(categoryConfig, items, valueField) {
  const byCategory = groupBy(items, 'category')
  const categories = {}

  for (const [categoryId, category] of Object.entries(categoryConfig)) {
    if (!category?.enabled) continue
    const categoryItems = byCategory[categoryId] || []
    const baseline = categoryItems.find(isModelBaseline)
    const itemizedItems = categoryItems.filter((item) => !isModelBaseline(item))
    const subcategories = {}
    if (itemizedItems.length) {
      for (const item of itemizedItems) {
        const total = money(item[valueField])
        subcategories[item.id] = {
          name: item.name || '',
          type: item.type || '',
          total,
          memberValues: allocate(total, item.ownership),
        }
      }
    } else {
      const total = money(baseline?.[valueField])
      subcategories[categoryId] = {
        name: '',
        type: categoryId,
        total,
        memberValues: allocate(total, baseline?.ownership),
      }
    }
    categories[categoryId] = aggregateCategory(subcategories, 'total')
  }

  return aggregateSection(categories)
}

export function financialYearValue(financialYear, section, memberId = 'all') {
  if (!financialYear) return 0
  if (!memberId || memberId === 'all') return money(financialYear.totals?.[section])
  if (section === 'savings') return money(financialYear.totals?.memberSavings?.[memberId])
  if (section === 'netWorth') return money(financialYear.totals?.memberNetWorth?.[memberId])
  return money(financialYear.totals?.[`${section}MemberValues`]?.[memberId])
}

export function financialYearMonthValue(financialYear, month, section, memberId = 'all') {
  const value = financialYear?.months?.[month]
  if (!value) return 0
  if (!memberId || memberId === 'all') {
    if (section === 'netWorth' || section === 'savings') return money(value[section])
    return money(value[section]?.total)
  }
  if (section === 'netWorth') return money(value.memberNetWorth?.[memberId])
  if (section === 'savings') return money(value.memberSavings?.[memberId])
  return money(value[section]?.memberValues?.[memberId])
}

export function financialYearCategoryValue(financialYear, section, categoryId, memberId = 'all') {
  const category = financialYear?.totals?.[`${section}Categories`]?.[categoryId]
  return memberId === 'all' ? money(category?.total) : money(category?.memberValues?.[memberId])
}

export function financialYearMonthCategoryValue(
  financialYear,
  month,
  section,
  categoryId,
  memberId = 'all',
) {
  const category = financialYear?.months?.[month]?.[section]?.categories?.[categoryId]
  return memberId === 'all' ? money(category?.total) : money(category?.memberValues?.[memberId])
}

export function financialYearCategoryItemCount(financialYear, section, categoryId, month = null) {
  const category = month
    ? financialYear?.months?.[month]?.[section]?.categories?.[categoryId]
    : financialYear?.totals?.[`${section}Categories`]?.[categoryId]
  return Object.keys(category?.subcategories || {}).filter((id) => id !== categoryId).length
}

export function financialYearCategoryMemberIds(financialYear, section, categoryId, month = null) {
  const category = month
    ? financialYear?.months?.[month]?.[section]?.categories?.[categoryId]
    : financialYear?.totals?.[`${section}Categories`]?.[categoryId]
  return Object.keys(category?.memberValues || {}).filter(
    (memberId) => Number(category.memberValues[memberId]) !== 0,
  )
}

export function financialYearSubcategoryValue(
  financialYear,
  section,
  categoryId,
  subcategoryId,
  memberId = 'all',
) {
  const item =
    financialYear?.totals?.[`${section}Categories`]?.[categoryId]?.subcategories?.[subcategoryId]
  const total = section === 'expenses' ? item?.effective : item?.total
  return memberId === 'all' ? money(total) : money(item?.memberValues?.[memberId])
}

function buildExpenseMonth({ categoryConfig, expenses, trackingMonth, monthIndex }) {
  const monthName = incomeMonths[monthIndex]
  const byCategory = groupBy(expenses, 'category')
  const categories = {}

  for (const [categoryId, category] of Object.entries(categoryConfig)) {
    if (!category?.enabled) continue
    const categoryExpenses = byCategory[categoryId] || []
    const baseline = categoryExpenses.find(isModelBaseline)
    const itemizedExpenses = categoryExpenses.filter((item) => !isModelBaseline(item))
    const subcategories = {}

    if (itemizedExpenses.length) {
      for (const expense of itemizedExpenses) {
        const subcategoryId = expense.type === 'other' ? expense.id : expense.type
        const estimated = money(expenseAmountForMonth(expense, monthName))
        const estimatedMembers = allocate(estimated, expense.ownership)
        const tracked = expense.type === 'other' ? null : trackedValue(trackingMonth, expense.type)
        const usesTracked = tracked?.applied === true
        subcategories[subcategoryId] = {
          name: expense.name || '',
          type: expense.type,
          estimated,
          actual: tracked?.actual ?? null,
          effective: usesTracked ? tracked.total : estimated,
          source: usesTracked ? 'tracked' : 'model',
          memberValues: usesTracked ? tracked.memberValues : estimatedMembers,
          estimatedMemberValues: estimatedMembers,
          actualMemberValues: tracked?.actualMemberValues || {},
        }
      }
    } else {
      const estimated = simpleExpenseMonthValue(baseline, monthName)
      subcategories[categoryId] = {
        name: '',
        type: categoryId,
        estimated,
        actual: null,
        effective: estimated,
        source: 'model',
        memberValues: allocate(estimated, baseline?.ownership),
        estimatedMemberValues: allocate(estimated, baseline?.ownership),
        actualMemberValues: {},
      }
    }

    categories[categoryId] = aggregateCategory(subcategories, 'effective')
  }

  return aggregateSection(categories)
}

function buildIncomeMonth({ categoryConfig, income, monthIndex }) {
  const byCategory = groupBy(income, 'category')
  const categories = {}

  for (const [categoryId, category] of Object.entries(categoryConfig)) {
    if (!category?.enabled) continue
    const categoryIncome = byCategory[categoryId] || []
    const baseline = categoryIncome.find(isModelBaseline)
    const itemizedIncome = categoryIncome.filter((item) => !isModelBaseline(item))
    const subcategories = {}

    if (itemizedIncome.length) {
      for (const item of itemizedIncome) {
        const total = incomeValueForMonth(item.calculation, monthIndex)
        subcategories[item.id] = {
          name: item.name || '',
          type: item.subtype || '',
          total,
          memberValues: allocate(total, item.ownership),
        }
      }
    } else {
      const total = money((Number(baseline?.annualValue) || 0) / 12)
      subcategories[categoryId] = {
        name: '',
        type: categoryId,
        total,
        memberValues: allocate(total, baseline?.ownership),
      }
    }

    categories[categoryId] = aggregateCategory(subcategories, 'total')
  }

  return aggregateSection(categories)
}

function buildAnnualTotals(months) {
  const endingPosition = months['12']
  const incomeCategories = mergeAnnualCategories(months, 'income')
  const expensesCategories = mergeAnnualCategories(months, 'expenses')
  const incomeMemberValues = sumMonthMaps(months, 'income', 'memberValues')
  const expensesMemberValues = sumMonthMaps(months, 'expenses', 'memberValues')

  return {
    assets: endingPosition.assets.total,
    liabilities: endingPosition.liabilities.total,
    netWorth: endingPosition.netWorth,
    assetsMemberValues: endingPosition.assets.memberValues,
    liabilitiesMemberValues: endingPosition.liabilities.memberValues,
    memberNetWorth: endingPosition.memberNetWorth,
    assetsCategories: endingPosition.assets.categories,
    liabilitiesCategories: endingPosition.liabilities.categories,
    income: sumMonths(months, 'income', 'total'),
    expenses: sumMonths(months, 'expenses', 'total'),
    savings: money(Object.values(months).reduce((sum, month) => sum + month.savings, 0)),
    incomeMemberValues,
    expensesMemberValues,
    memberSavings: subtractMaps(incomeMemberValues, expensesMemberValues),
    incomeCategories,
    expensesCategories,
  }
}

function mergeAnnualCategories(months, section) {
  const result = {}
  for (const month of Object.values(months)) {
    for (const [categoryId, category] of Object.entries(month[section].categories)) {
      const target = (result[categoryId] ||= { total: 0, memberValues: {}, subcategories: {} })
      target.total = money(target.total + category.total)
      target.memberValues = addMaps(target.memberValues, category.memberValues)
      for (const [subcategoryId, item] of Object.entries(category.subcategories)) {
        const annual = (target.subcategories[subcategoryId] ||= {
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

function trackedValue(month, subcategoryId) {
  const category = month?.categories?.[subcategoryId]
  const applied = month?.reconciliation?.[subcategoryId]?.decision === 'tracked'
  const hasActual = Boolean(category) || applied
  const items = category?.items || []
  const total = money(items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0))
  const memberValues = items.reduce(
    (totals, item) => addMaps(totals, allocate(item.amount, item.ownership)),
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

function simpleExpenseMonthValue(category = {}, monthName) {
  const monthlyAmounts = category.monthlyAmounts
  if (monthlyAmounts && Object.hasOwn(monthlyAmounts, monthName)) {
    return money(monthlyAmounts[monthName])
  }
  const amount = Number(category.estimate?.amount) || 0
  const frequency = category.estimate?.frequency
  if (frequency === 'monthly') return money(amount)
  if (frequency === 'every_two_months')
    return incomeMonths.indexOf(monthName) % 2 === 0 ? money(amount) : 0
  if (frequency === 'quarterly')
    return incomeMonths.indexOf(monthName) % 3 === 0 ? money(amount) : 0
  if (frequency === 'yearly') return monthName === 'january' ? money(amount) : 0
  return 0
}

function incomeValueForMonth(calculation, monthIndex) {
  if (!calculation) return 0
  if (calculation.mode === 'monthly_schedule') {
    const extra = calculation.extrasByMonth?.[incomeMonths[monthIndex]] || 0
    return money((Number(calculation.monthlyAmount) || 0) + (Number(extra) || 0))
  }
  if (calculation.mode === 'annual_salary')
    return money((Number(calculation.annualAmount) || 0) / 12)
  if (calculation.mode === 'one_time') {
    return calculation.month === incomeMonths[monthIndex] ? money(calculation.amount) : 0
  }
  const multipliers = { weekly: 52, monthly: 12, quarterly: 4, yearly: 1 }
  return money(((Number(calculation.amount) || 0) * (multipliers[calculation.frequency] || 0)) / 12)
}

function aggregateCategory(subcategories, valueKey) {
  return {
    total: money(
      Object.values(subcategories).reduce((sum, item) => sum + (Number(item[valueKey]) || 0), 0),
    ),
    memberValues: Object.values(subcategories).reduce(
      (totals, item) => addMaps(totals, item.memberValues),
      {},
    ),
    subcategories,
  }
}

function aggregateSection(categories) {
  return {
    total: money(Object.values(categories).reduce((sum, category) => sum + category.total, 0)),
    memberValues: Object.values(categories).reduce(
      (totals, category) => addMaps(totals, category.memberValues),
      {},
    ),
    categories,
  }
}

function allocate(value, ownership) {
  const result = {}
  for (const share of ownership?.shares || []) {
    result[share.memberId] = money(
      (result[share.memberId] || 0) + applyOwnership(value, ownership, share.memberId),
    )
  }
  return result
}

function groupBy(items, key) {
  return items.reduce((groups, item) => {
    const value = item[key]
    groups[value] = [...(groups[value] || []), item]
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

function sumMonths(months, section, field) {
  return money(Object.values(months).reduce((sum, month) => sum + month[section][field], 0))
}

function sumMonthMaps(months, section, field) {
  return Object.values(months).reduce((totals, month) => addMaps(totals, month[section][field]), {})
}

function money(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return 0
  return Math.round((amount + Number.EPSILON) * 100) / 100
}

function assertYear(year) {
  if (!Number.isInteger(year) || year < 2000 || year > 9999) {
    throw new Error('A valid financial year is required')
  }
}
