import { normalizeMoney } from './money'
import { categoryEffectiveValue } from './category-summary'
import { expenseAmountForMonth } from './expense-calculations'
import { incomeMonths } from './income-calculations'
import { applyOwnership } from './ownership'

export function emptyExpenseTrackingMonth(period) {
  return {
    year: Number(period.slice(0, 4)),
    month: Number(period.slice(5, 7)),
    categories: {},
    reconciliation: {},
    total: 0,
  }
}

export function addTrackedItem(month, subcategoryId, item) {
  return replaceCategoryItems(month, subcategoryId, [...categoryItems(month, subcategoryId), item])
}

export function updateTrackedItem(month, subcategoryId, itemId, changes) {
  const items = categoryItems(month, subcategoryId)
  if (!items.some(({ id }) => id === itemId)) throw new Error('Tracked expense not found')
  return replaceCategoryItems(
    month,
    subcategoryId,
    items.map((item) => (item.id === itemId ? { ...item, ...changes, id: item.id } : item)),
  )
}

export function deleteTrackedItem(month, subcategoryId, itemId) {
  const items = categoryItems(month, subcategoryId)
  if (!items.some(({ id }) => id === itemId)) throw new Error('Tracked expense not found')
  return replaceCategoryItems(
    month,
    subcategoryId,
    items.filter(({ id }) => id !== itemId),
  )
}

export function normalizeTrackingMonth(month, period) {
  const base = emptyExpenseTrackingMonth(period)
  const categories = Object.fromEntries(
    Object.entries(month?.categories || {}).map(([subcategoryId, category]) => [
      subcategoryId,
      buildCategory(category?.items || []),
    ]),
  )
  return {
    ...base,
    ...month,
    year: base.year,
    month: base.month,
    categories,
    reconciliation: normalizeReconciliation(month?.reconciliation, categories),
    total: money(Object.values(categories).reduce((sum, category) => sum + category.total, 0)),
  }
}

export function setTrackingDecision(month, subcategoryId, decision) {
  const reconciliation = { ...(month?.reconciliation || {}) }
  if (decision === 'tracked') {
    if (!categoryItems(month, subcategoryId).length) {
      throw new Error('Tracked decisions require at least one tracked expense')
    }
    reconciliation[subcategoryId] = { decision: 'tracked' }
  } else if (decision === 'model') {
    delete reconciliation[subcategoryId]
  } else {
    throw new Error('A valid tracking decision is required')
  }
  return { ...month, reconciliation }
}

export function setTrackingDecisions(month, subcategoryIds, decision) {
  return [...new Set(subcategoryIds)].reduce(
    (next, subcategoryId) => setTrackingDecision(next, subcategoryId, decision),
    month,
  )
}

export function resolveExpenseTrackingValue(modelValue, actualValue, decision) {
  const model = normalizeMoney(modelValue) || 0
  const actual = actualValue == null ? null : normalizeMoney(actualValue)
  const usesTracked = decision === 'tracked' && actual !== null
  return {
    model,
    actual,
    effective: usesTracked ? actual : model,
    source: usesTracked ? 'tracked' : 'model',
  }
}

export function effectiveExpenseValuesForYear({
  summary,
  expensesByCategory = {},
  trackingMonths = {},
  year,
  memberId = 'all',
}) {
  const categories = Object.fromEntries(
    Object.entries(summary?.categories || {}).map(([categoryId, category]) => {
      if (!category?.enabled) return [categoryId, 0]

      const expenses = expensesByCategory[categoryId] || []
      if (!expenses.length) {
        return [categoryId, categoryEffectiveValue(category, memberId)]
      }

      const value = expenses.reduce(
        (categoryTotal, expense) =>
          categoryTotal + effectiveExpenseValueForYear({ expense, trackingMonths, year, memberId }),
        0,
      )

      return [categoryId, money(value)]
    }),
  )

  return {
    categories,
    annualCostOfLife: money(Object.values(categories).reduce((total, value) => total + value, 0)),
  }
}

export function effectiveExpenseValueForYear({
  expense,
  trackingMonths = {},
  year,
  memberId = 'all',
}) {
  return money(
    incomeMonths.reduce((annualTotal, monthName, monthIndex) => {
      const model = applyOwnership(
        expenseAmountForMonth(expense, monthName),
        expense.ownership,
        memberId,
      )
      if (expense.type === 'other') return annualTotal + model

      const period = `${year}-${String(monthIndex + 1).padStart(2, '0')}`
      const trackingMonth = trackingMonths[period]
      const trackedCategory = trackingMonth?.categories?.[expense.type]
      const actual = trackedCategory?.items?.length
        ? trackedCategory.items.reduce(
            (total, item) => total + applyOwnership(item.amount, item.ownership, memberId),
            0,
          )
        : null
      return (
        annualTotal +
        resolveExpenseTrackingValue(
          model,
          actual,
          trackingMonth?.reconciliation?.[expense.type]?.decision,
        ).effective
      )
    }, 0),
  )
}

function categoryItems(month, subcategoryId) {
  return month?.categories?.[subcategoryId]?.items || []
}

function replaceCategoryItems(month, subcategoryId, items) {
  const categories = { ...(month?.categories || {}) }
  if (items.length) categories[subcategoryId] = buildCategory(items)
  else delete categories[subcategoryId]
  const reconciliation = { ...(month?.reconciliation || {}) }
  if (!items.length) delete reconciliation[subcategoryId]
  return {
    ...month,
    categories,
    reconciliation,
    total: money(Object.values(categories).reduce((sum, category) => sum + category.total, 0)),
  }
}

function buildCategory(items) {
  return {
    total: money(items.reduce((sum, item) => sum + (normalizeMoney(item.amount) || 0), 0)),
    items,
  }
}

function normalizeReconciliation(value, categories) {
  return Object.fromEntries(
    Object.entries(value || {}).flatMap(([subcategoryId, state]) => {
      return state?.decision === 'tracked' && categories[subcategoryId]?.items?.length
        ? [[subcategoryId, { decision: 'tracked' }]]
        : []
    }),
  )
}

function money(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}
