import { describe, expect, it } from 'vitest'
import { expenseCategories } from '../../../src/config/expense-categories'
import {
  defaultExpenseTrackingCategoryIds,
  expenseTrackingCategoryIds,
  reviewExpenseTrackingCategories,
  trackingSubcategoryIdsForModelExpenses,
} from '../../../src/config/expense-tracking-categories'
import {
  addTrackedItem,
  deleteTrackedItem,
  emptyExpenseTrackingMonth,
  normalizeTrackingMonth,
  resolveExpenseTrackingValue,
  setTrackingDecision,
  setTrackingDecisions,
  updateTrackedItem,
} from '../../../src/domain/financial/expense-tracking'

const item = (id, amount) => ({ id, amount, notes: '', ownership: { mode: 'single', shares: [] } })

describe('expense tracking month', () => {
  it('makes every configured expense suggestion available for tracking', () => {
    const suggestionIds = expenseCategories.flatMap(({ suggestions }) =>
      suggestions.map(({ id }) => id),
    )

    expect(expenseTrackingCategoryIds).toEqual(suggestionIds)
  })

  it('keeps the focused variable categories as defaults without gym and fitness', () => {
    expect(defaultExpenseTrackingCategoryIds).toEqual([
      'groceries',
      'restaurants_takeaway',
      'fuel_charging',
      'public_transport',
      'clothes_shoes',
      'entertainment',
      'home_repairs',
    ])
    expect(defaultExpenseTrackingCategoryIds).not.toContain('gym_fitness')
  })

  it('offers only tracking-eligible subcategories backed by matching model expenses', () => {
    expect(
      trackingSubcategoryIdsForModelExpenses([
        { category: 'food', type: 'groceries', trackingEligible: true },
        { category: 'food', type: 'restaurants_takeaway', trackingEligible: false },
        { category: 'housing', type: 'fuel_charging', trackingEligible: true },
        { category: 'other', type: 'other', trackingEligible: true },
      ]),
    ).toEqual(['groceries'])
  })

  it('keeps stored historical categories visible after they leave the current model', () => {
    const categories = reviewExpenseTrackingCategories(['groceries'], {
      categories: {
        health_insurance: { items: [item('historical', 80)] },
      },
    })

    expect(categories.map(({ id }) => id)).toEqual(['groceries', 'health_insurance'])
  })

  it('keeps an archived explicit tracked zero visible without entries', () => {
    const categories = reviewExpenseTrackingCategories([], {
      reconciliation: {
        health_insurance: { decision: 'tracked' },
      },
    })

    expect(categories.map(({ id }) => id)).toEqual(['health_insurance'])
  })

  it('adds items and keeps category and month totals synchronized', () => {
    let month = emptyExpenseTrackingMonth('2026-10')
    month = addTrackedItem(month, 'groceries', item('a', 10.2))
    month = addTrackedItem(month, 'groceries', item('b', 4.35))
    month = addTrackedItem(month, 'entertainment', item('c', 12))

    expect(month.categories.groceries.total).toBe(14.55)
    expect(month.categories.entertainment.total).toBe(12)
    expect(month.total).toBe(26.55)
  })

  it('recalculates totals when an item is edited', () => {
    const initial = addTrackedItem(
      addTrackedItem(emptyExpenseTrackingMonth('2026-10'), 'groceries', item('a', 10)),
      'groceries',
      item('b', 5),
    )
    const updated = updateTrackedItem(initial, 'groceries', 'a', { amount: 7.25 })

    expect(updated.categories.groceries.total).toBe(12.25)
    expect(updated.total).toBe(12.25)
    expect(updated.categories.groceries.items.find(({ id }) => id === 'a').amount).toBe(7.25)
  })

  it('removes empty categories and updates the month total', () => {
    const initial = addTrackedItem(
      addTrackedItem(emptyExpenseTrackingMonth('2026-10'), 'groceries', item('a', 10)),
      'entertainment',
      item('b', 8),
    )
    const withoutGroceries = deleteTrackedItem(initial, 'groceries', 'a')

    expect(withoutGroceries.categories.groceries).toBeUndefined()
    expect(withoutGroceries.total).toBe(8)
  })

  it('repairs stale stored totals when a month is loaded', () => {
    const normalized = normalizeTrackingMonth(
      {
        year: 2026,
        month: 10,
        total: 999,
        categories: { groceries: { total: 999, items: [item('a', 2.5), item('b', 3)] } },
      },
      '2026-10',
    )

    expect(normalized.categories.groceries.total).toBe(5.5)
    expect(normalized.total).toBe(5.5)
  })

  it('normalizes tracked decisions without model snapshots', () => {
    const month = normalizeTrackingMonth(
      {
        categories: { groceries: { items: [item('a', 450)] } },
        reconciliation: {
          groceries: { decision: 'tracked', modelTotal: 500 },
          invalid: { decision: 'model', modelTotal: 20 },
        },
      },
      '2026-10',
    )

    expect(month.reconciliation).toEqual({
      groceries: { decision: 'tracked' },
    })
  })

  it('sets and clears a decision without changing tracked totals', () => {
    const initial = addTrackedItem(
      emptyExpenseTrackingMonth('2026-10'),
      'groceries',
      item('a', 450),
    )
    const tracked = setTrackingDecision(initial, 'groceries', 'tracked')
    const restored = setTrackingDecision(tracked, 'groceries', 'model')

    expect(tracked.reconciliation.groceries).toEqual({ decision: 'tracked' })
    expect(tracked.total).toBe(450)
    expect(restored.reconciliation).toEqual({})
    expect(restored.total).toBe(450)
  })

  it('allows an explicit tracked actual of zero', () => {
    const tracked = setTrackingDecision(
      emptyExpenseTrackingMonth('2026-10'),
      'groceries',
      'tracked',
    )

    expect(tracked.reconciliation.groceries).toEqual({ decision: 'tracked' })
    expect(normalizeTrackingMonth(tracked, '2026-10').reconciliation.groceries).toEqual({
      decision: 'tracked',
    })
  })

  it('updates multiple decisions together in the monthly document', () => {
    let month = addTrackedItem(emptyExpenseTrackingMonth('2026-10'), 'groceries', item('a', 10))
    month = addTrackedItem(month, 'entertainment', item('b', 20))

    const tracked = setTrackingDecisions(month, ['groceries', 'entertainment'], 'tracked')
    expect(tracked.reconciliation).toEqual({
      groceries: { decision: 'tracked' },
      entertainment: { decision: 'tracked' },
    })
  })

  it('rejects edits and deletes for missing items', () => {
    const month = emptyExpenseTrackingMonth('2026-10')
    expect(() => updateTrackedItem(month, 'groceries', 'missing', { amount: 1 })).toThrow()
    expect(() => deleteTrackedItem(month, 'groceries', 'missing')).toThrow()
  })

  it('clears a tracked decision when its last entry is deleted', () => {
    const initial = setTrackingDecision(
      addTrackedItem(emptyExpenseTrackingMonth('2026-10'), 'groceries', item('a', 10)),
      'groceries',
      'tracked',
    )

    expect(deleteTrackedItem(initial, 'groceries', 'a').reconciliation).toEqual({})
  })

  it('resolves effective values from the monthly decision', () => {
    expect(resolveExpenseTrackingValue(500, 472, 'tracked')).toEqual({
      model: 500,
      actual: 472,
      effective: 472,
      source: 'tracked',
    })
    expect(resolveExpenseTrackingValue(600, 472, 'model')).toEqual({
      model: 600,
      actual: 472,
      effective: 600,
      source: 'model',
    })
    expect(resolveExpenseTrackingValue(600, null, 'tracked')).toEqual({
      model: 600,
      actual: null,
      effective: 600,
      source: 'model',
    })
  })
})
