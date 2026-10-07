import { describe, expect, it } from 'vitest'
import {
  addItemToCategory,
  buildSummaryCategories,
  categoryEffectiveValue,
  removeItemFromCategory,
  totalCategories,
  updateItemInCategory,
} from '../../../src/domain/financial/category-summary'
import { createEqualOwnership } from '../../../src/domain/financial/ownership'

const members = ['a', 'b']
const equalOwnership = createEqualOwnership(members)
const ownerA = { mode: 'single', shares: [{ memberId: 'a', percentage: 100 }] }
const ownerB = { mode: 'single', shares: [{ memberId: 'b', percentage: 100 }] }

function simpleCategory(overrides = {}) {
  return {
    enabled: true,
    manualValue: 40,
    ownership: equalOwnership,
    itemCount: 0,
    itemizedValue: 0,
    memberValues: { a: 20, b: 20 },
    ...overrides,
  }
}

function expectMemberValuesToMatchTotal(category) {
  expect(Object.values(category.memberValues).reduce((sum, value) => sum + value, 0)).toBe(
    category.itemCount > 0 ? category.itemizedValue : category.manualValue,
  )
}

describe('summary category construction', () => {
  it('builds new categories and preserves existing category data', () => {
    const existing = simpleCategory({ manualValue: 75 })
    const categories = buildSummaryCategories(['one', 'two'], ['two'], { one: existing }, members)

    expect(categories.one).toEqual({ ...existing, enabled: false })
    expect(categories.two).toMatchObject({
      enabled: true,
      manualValue: 0,
      itemCount: 0,
      itemizedValue: 0,
      memberValues: { a: 0, b: 0 },
    })
  })
})

describe('itemized category calculations', () => {
  it('adds the first item and replaces stale itemized aggregates', () => {
    const category = addItemToCategory(
      simpleCategory({ itemizedValue: 999, memberValues: { a: 999 } }),
      100,
      equalOwnership,
    )

    expect(category).toMatchObject({ itemCount: 1, itemizedValue: 100 })
    expect(category.memberValues).toEqual({ a: 50, b: 50 })
    expectMemberValuesToMatchTotal(category)
  })

  it('adds multiple items', () => {
    const first = addItemToCategory(simpleCategory(), 100, ownerA)
    const second = addItemToCategory(first, 25.55, ownerB)

    expect(second).toMatchObject({ itemCount: 2, itemizedValue: 125.55 })
    expect(second.memberValues).toEqual({ a: 100, b: 25.55 })
    expectMemberValuesToMatchTotal(second)
  })

  it('updates an item value', () => {
    const category = addItemToCategory(simpleCategory(), 100, equalOwnership)
    const updated = updateItemInCategory(category, 100, equalOwnership, 120, equalOwnership)

    expect(updated.itemizedValue).toBe(120)
    expect(updated.memberValues).toEqual({ a: 60, b: 60 })
    expectMemberValuesToMatchTotal(updated)
  })

  it('updates an item ownership', () => {
    const category = addItemToCategory(simpleCategory(), 100, ownerA)
    const updated = updateItemInCategory(category, 100, ownerA, 100, ownerB)

    expect(updated.memberValues).toEqual({ a: 0, b: 100 })
    expectMemberValuesToMatchTotal(updated)
  })

  it('updates value and ownership together', () => {
    const category = addItemToCategory(simpleCategory(), 100, ownerA)
    const updated = updateItemInCategory(category, 100, ownerA, 80.25, equalOwnership)

    expect(updated.itemizedValue).toBe(80.25)
    expect(updated.memberValues).toEqual({ a: 40.13, b: 40.12 })
    expectMemberValuesToMatchTotal(updated)
  })

  it('removes one of multiple items', () => {
    const first = addItemToCategory(simpleCategory(), 100, ownerA)
    const second = addItemToCategory(first, 25, ownerB)
    const updated = removeItemFromCategory(second, 25, ownerB, equalOwnership, members)

    expect(updated).toMatchObject({ itemCount: 1, itemizedValue: 100 })
    expect(updated.memberValues).toEqual({ a: 100, b: 0 })
    expectMemberValuesToMatchTotal(updated)
  })

  it('removes the last item and restores default simple ownership', () => {
    const category = addItemToCategory(simpleCategory(), 100, ownerA)
    const updated = removeItemFromCategory(category, 100, ownerA, equalOwnership, members)

    expect(updated).toMatchObject({
      itemCount: 0,
      itemizedValue: 0,
      ownership: equalOwnership,
      memberValues: { a: 20, b: 20 },
    })
    expectMemberValuesToMatchTotal(updated)
  })
})

describe('effective values and totals', () => {
  it('uses the manual value and ownership for a simple category', () => {
    const category = simpleCategory()

    expect(categoryEffectiveValue(category)).toBe(40)
    expect(categoryEffectiveValue(category, 'a')).toBe(20)
  })

  it('uses item aggregates for an itemized category', () => {
    const category = addItemToCategory(simpleCategory(), 99.99, equalOwnership)

    expect(categoryEffectiveValue(category)).toBe(99.99)
    expect(categoryEffectiveValue(category, 'a')).toBe(50)
    expect(categoryEffectiveValue(category, 'b')).toBe(49.99)
  })

  it('totals enabled categories for all members and one member', () => {
    const summary = {
      categories: {
        one: simpleCategory(),
        two: simpleCategory({ manualValue: 10, ownership: ownerA }),
        disabled: simpleCategory({ enabled: false, manualValue: 500 }),
      },
    }

    expect(totalCategories(summary)).toBe(50)
    expect(totalCategories(summary, 'a')).toBe(30)
  })
})
