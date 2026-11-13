/**
 * Pure builder for the materialized financial-year document. It projects positions and flows by month, applies ownership and tracking decisions, and preserves closed-month metadata.
 */
import { allocateMoneyByOwnership } from '../../shared/core/ownership.js'
import { roundMoneyOrZero as moneyOrZero } from '../../shared/core/money.js'
import { calculateExpenseAmountForMonth } from '../../shared/expenses/calculations.js'
import {
  reconcileExpenseMemberValues,
  reconcileModeledAndTrackedExpense,
} from '../../shared/expenses/reconciliation.js'
import { calculateIncomeAmountForMonth } from '../../shared/income/calculations.js'
import { isLiabilityPaymentDueInMonth } from './position-calculations.js'

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

/**
 * Creates a complete twelve-month projection from editable source models.
 */
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

/**
 * Rebuilds requested year sections while preserving closed months and unaffected data.
 */
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
      const closed = previous.positionStatus === 'closed'
      const assetsValue =
        affected.has('assets') && monthKey >= assetStartMonth && !closed ?
          buildPositionMonth(config.assets?.categories || {}, assets, 'currentValue') :
          canonicalSection(previous.assets)
      const liabilitiesValue =
        affected.has('liabilities') && monthKey >= liabilityStartMonth && !closed ?
          buildPositionMonth(config.liabilities?.categories || {}, liabilities, 'balance') :
          canonicalSection(previous.liabilities)
      const expensesValue = affected.has('expenses') && !closed ?
        buildExpenseMonth(
            config.expenses?.categories || {},
            expenses,
            trackingMonths[`${year}-${monthKey}`],
            monthName,
            liabilities,
            year,
            monthIndex,
          ) :
        canonicalSection(previous.expenses)
      const incomeValue = affected.has('income') && !closed ?
        buildIncomeMonth(config.income?.categories || {}, income, monthIndex) :
        canonicalSection(previous.income)
      return [
        monthKey,
        {
          ...positionMetadata(previous),
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

/**
 * Reports whether position value is present or meaningful.
 */
function hasPositionValue(config, items) {
  if (items.some((item) => config?.categories?.[item.categoryId]?.enabled)) return true
  return Object.values(config?.categories || {}).some(
    (category) => category?.enabled && Number(category.manualValue) > 0,
  )
}

/**
 * Builds one position month grouped by category, subcategory, item, and ownership.
 */
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

/**
 * Builds one expense month and reconciles modeled values with tracked values.
 */
function buildExpenseMonth(
  categoryConfig,
  expenses,
  trackingMonth,
  monthName,
  liabilities = [],
  year = null,
  monthIndex = 0,
) {
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
      const source = tracked.source
      const items = Object.fromEntries(
        modelItems.map((expense) => {
          const estimated = effectiveExpenseMonth(
            expense,
            monthName,
            liabilities,
            year,
            monthIndex,
          )
          const actual = tracked.items[expense.id]
          const estimatedMemberValues = allocate(estimated, expense.ownership)
          return [
            expense.id,
            {
              itemName: expense.itemName,
              notes: expense.notes || '',
              estimated,
              actual: actual?.total ?? null,
              effective: reconciledExpenseValue(estimated, actual?.total || 0, source),
              source,
              necessity: expense.necessity ?? null,
              memberValues: reconciledMemberValues(
                estimatedMemberValues,
                actual?.memberValues || {},
                source,
              ),
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
        effective: reconciledExpenseValue(estimated, tracked.total, source),
        source,
        necessity: null,
        memberValues: reconciledMemberValues(estimatedMemberValues, tracked.memberValues, source),
        estimatedMemberValues,
        actualMemberValues: tracked.actualMemberValues,
        items,
      }
    }
    categories[categoryId] = { subcategories }
  }
  return { categories }
}

/**
 * Returns effective expense month after model and fallback rules.
 */
function effectiveExpenseMonth(expense, monthName, liabilities, year, monthIndex) {
  const estimated = expenseMonth(expense, monthName)
  if (!expense.liabilityId || !year) return estimated

  const liability = liabilities.find(({ id }) => id === expense.liabilityId)
  if (
    liability?.categoryId !== 'mortgage' ||
    liability?.detail?.mortgage?.schemaVersion !== 2
  ) {
    return estimated
  }

  try {
    return isLiabilityPaymentDueInMonth(liability, year, monthIndex) ? estimated : 0
  } catch {
    return estimated
  }
}

/**
 * Builds one income month with disposable percentages and ownership allocations.
 */
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

/**
 * Returns a valid disposable-income percentage with the projection fallback.
 */
function disposablePercentage(value) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : 100
}

/**
 * Returns one expense model’s value for a named month.
 */
function expenseMonth(expense, monthName) {
  return calculateExpenseAmountForMonth(expense, monthName)
}

/**
 * Returns one income model’s value for a month index.
 */
function incomeMonth(calculation, monthIndex) {
  return calculateIncomeAmountForMonth(calculation, monthIndex)
}

/**
 * Returns tracked value, member allocation, and reconciliation source for a subcategory.
 */
function trackedValue(month, id) {
  const category = month?.categories?.[id]
  const decision = month?.reconciliation?.[id]?.decision
  const source = ['tracked', 'combined'].includes(decision) ? decision : 'model'
  const applied = source !== 'model'
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
    source,
    actual: hasActual ? total : null,
    total,
    memberValues,
    actualMemberValues: hasActual ? memberValues : {},
    items: itemValues,
  }
}

/**
 * Returns expense value after the selected reconciliation decision.
 */
function reconciledExpenseValue(estimated, actual, source) {
  return reconcileModeledAndTrackedExpense(estimated, actual, source).effective
}

/**
 * Returns member values after the selected reconciliation decision.
 */
function reconciledMemberValues(estimated, actual, source) {
  return reconcileExpenseMemberValues(estimated, actual, source)
}

/**
 * Reconciles one tracking period into an existing financial-year expense month.
 */
function applyTrackingMonth(financialYear, monthKey, trackingMonth) {
  const previous = financialYear?.months?.[monthKey]
  if (!previous) return financialYear
  const categories = {}
  for (const [categoryId, category] of Object.entries(previous.expenses?.categories || {})) {
    const subcategories = {}
    for (const [id, item] of Object.entries(category.subcategories || {})) {
      const tracked = trackedValue(trackingMonth, id)
      const source = tracked.source
      const items = Object.fromEntries(
        Object.entries(item.items || {}).map(([itemId, modelItem]) => {
          const actual = tracked.items[itemId]
          return [
            itemId,
            {
              ...modelItem,
              actual: actual?.total ?? null,
              effective: reconciledExpenseValue(
                modelItem.estimated,
                actual?.total || 0,
                source,
              ),
              source,
              memberValues: reconciledMemberValues(
                modelItem.estimatedMemberValues || modelItem.memberValues,
                actual?.memberValues || {},
                source,
              ),
              actualMemberValues: actual?.memberValues || {},
            },
          ]
        }),
      )
      subcategories[id] = {
        ...item,
        actual: tracked.actual,
        effective: reconciledExpenseValue(item.estimated, tracked.total, source),
        source,
        memberValues: reconciledMemberValues(
          item.estimatedMemberValues || item.memberValues,
          tracked.memberValues,
          source,
        ),
        actualMemberValues: tracked.actualMemberValues,
        items,
      }
    }
    categories[categoryId] = { subcategories }
  }
  const expenses = { categories }
  const month = {
    ...positionMetadata(previous),
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

/**
 * Retains only persisted position metadata while rebuilding a month.
 */
function positionMetadata(month) {
  return Object.fromEntries(
    ['positionStatus', 'positionAsOf', 'positionCalculatedAt']
      .filter((field) => month?.[field] != null)
      .map((field) => [field, month[field]]),
  )
}

/**
 * Retains non-derived year metadata while rebuilding projections.
 */
function financialYearMetadata(financialYear) {
  return Object.fromEntries(
    ['schemaVersion', 'status', 'generatedAt', 'updatedAt']
      .filter((field) => financialYear?.[field] != null)
      .map((field) => [field, financialYear[field]]),
  )
}

/**
 * Returns canonical section derived from the supplied input.
 */
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

/**
 * Allocates a value with canonical ownership rules, or returns an empty map for invalid ownership.
 */
function allocate(value, ownership) {
  return allocateMoneyByOwnership(value, ownership)
}

/**
 * Groups source items by the requested field.
 */
function groupBy(items, field) {
  return items.reduce((groups, item) => {
    groups[item[field]] = [...(groups[item[field]] || []), item]
    return groups
  }, {})
}

/**
 * Adds two member-value maps key by key at money precision.
 */
function addMaps(first = {}, second = {}) {
  const keys = new Set([...Object.keys(first), ...Object.keys(second)])
  return Object.fromEntries(
    [...keys].map((key) => [
      key,
      moneyOrZero((Number(first[key]) || 0) + (Number(second[key]) || 0)),
    ]),
  )
}

/**
 * Validates year and throws a descriptive error when its contract is not satisfied.
 */
function assertYear(year) {
  if (!Number.isInteger(year) || year < 2000 || year > 9999) {
    throw new Error('A valid financial year is required')
  }
}

/**
 * Validates month and throws a descriptive error when its contract is not satisfied.
 */
function assertMonth(month) {
  if (!/^(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error('A valid projection month is required')
  }
}

export {
  applyTrackingMonth,
  buildPositionMonth,
  buildFinancialYear,
  updateFinancialYearProjection,
}
