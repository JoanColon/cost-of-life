import { normalizeNonNegativeMoney } from './money'
import { financialYearExpenseItemValue } from './financial-year'

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
    reconciliation: normalizeReconciliation(month?.reconciliation),
    total: roundMoney(Object.values(categories).reduce((sum, category) => sum + category.total, 0)),
  }
}

export function setTrackingDecision(month, subcategoryId, decision) {
  const reconciliation = { ...(month?.reconciliation || {}) }
  if (decision === 'tracked') {
    reconciliation[subcategoryId] = { decision: 'tracked' }
  } else if (decision === 'combined') {
    reconciliation[subcategoryId] = { decision: 'combined' }
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
  const model = normalizeNonNegativeMoney(modelValue) || 0
  const actual = actualValue == null ? null : normalizeNonNegativeMoney(actualValue)
  const usesTracked = decision === 'tracked' && actual !== null
  const usesCombined = decision === 'combined' && actual !== null
  const source = usesTracked ? 'tracked' : usesCombined ? 'combined' : 'model'
  const effective = usesCombined ? model + actual : actual
  return {
    model,
    actual,
    effective: financialYearExpenseItemValue({ source, effective }, model),
    source,
  }
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
    total: roundMoney(Object.values(categories).reduce((sum, category) => sum + category.total, 0)),
  }
}

function buildCategory(items) {
  return {
    total: roundMoney(
      items.reduce((sum, item) => sum + (normalizeNonNegativeMoney(item.amount) || 0), 0),
    ),
    items,
  }
}

function normalizeReconciliation(value) {
  return Object.fromEntries(
    Object.entries(value || {}).flatMap(([subcategoryId, state]) => {
      return ['tracked', 'combined'].includes(state?.decision)
        ? [[subcategoryId, { decision: state.decision }]]
        : []
    }),
  )
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}
