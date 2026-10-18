import { describe, expect, it } from 'vitest'
import financialModelService from '../../functions/services/financial-model.js'
import financialYearDomain from '../../functions/domain/financial-year.js'
import financialYearsService from '../../functions/services/financial-years.js'
import { financialYearValue } from '../../src/domain/financial/financial-year.js'

const { mutateFinancialModel } = financialModelService
const { buildFinancialYear } = financialYearDomain
const { currentYear } = financialYearsService

const ownership = {
  mode: 'single',
  shares: [{ memberId: 'member-a', percentage: 100 }],
}

describe('atomic financial model mutations', () => {
  it.each([
    {
      section: 'assets',
      collection: 'modelAssets',
      result: 'asset',
      item: {
        categoryId: 'cash',
        subcategoryId: 'current_account',
        itemName: 'Savings',
        notes: '',
        currentValue: 100,
        ownership,
        detail: {},
        valueSource: 'manual',
      },
      expected: { assets: 100, netWorth: 100 },
    },
    {
      section: 'liabilities',
      collection: 'modelLiabilities',
      result: 'liability',
      item: {
        categoryId: 'loan',
        subcategoryId: 'loan',
        itemName: 'Loan',
        notes: '',
        balance: 40,
        ownership,
      },
      expected: { liabilities: 40, netWorth: -40 },
    },
    {
      section: 'income',
      collection: 'modelIncome',
      result: 'income',
      item: {
        categoryId: 'employment',
        subcategoryId: 'salary',
        itemName: 'Main salary',
        notes: '',
        calculation: { mode: 'annual_salary', annualAmount: 1200, paymentsPerYear: 12 },
        ownership,
      },
      expected: { income: 1200, savings: 1200 },
    },
    {
      section: 'expenses',
      collection: 'modelExpenses',
      result: 'expense',
      item: {
        categoryId: 'housing',
        subcategoryId: 'mortgage_rent',
        itemName: 'Main home',
        notes: '',
        estimate: { amount: 10, frequency: 'monthly' },
        variability: 'fixed',
        recurrence: 'recurring',
        necessity: 'essential',
        monthlyAmounts: monthlyAmounts(10),
        ownership,
      },
      expected: { expenses: 120, savings: -120 },
    },
  ])('writes a $section item and its financial year together', async (testCase) => {
    const { firestore, writes } = createFirestore({
      section: testCase.section,
      collection: testCase.collection,
      category: testCase.item.categoryId,
      configCategory:
        testCase.section === 'expenses'
          ? { enabled: true }
          : undefined,
    })

    const result = await mutateFinancialModel(firestore, {
      workspaceId: 'workspace-a',
      userId: 'member-a',
      section: testCase.section,
      operation: 'create',
      item: testCase.item,
    })

    expect(result[testCase.result]).toMatchObject(testCase.item)
    expect(writes.map(({ path }) => path)).toContain(
      `workspaces/workspace-a/${testCase.collection}/${result[testCase.result].id}`,
    )
    const financialYearWrite = writes.find(({ path }) => path.endsWith(`/financialYears/${currentYear()}`))
    expect(financialYearWrite.data.totals).toBeUndefined()
    for (const [section, value] of Object.entries(testCase.expected)) {
      expect(financialYearValue(financialYearWrite.data, section)).toBe(value)
    }
  })

  it('rejects ownership that references someone outside the workspace', async () => {
    const { firestore, writes } = createFirestore({
      section: 'assets',
      collection: 'modelAssets',
      category: 'cash',
    })

    await expect(
      mutateFinancialModel(firestore, {
        workspaceId: 'workspace-a',
        userId: 'member-a',
        section: 'assets',
        operation: 'create',
        item: {
          categoryId: 'cash',
          subcategoryId: 'current_account',
          itemName: 'Savings',
          notes: '',
          currentValue: 100,
          detail: {},
          valueSource: 'manual',
          ownership: {
            mode: 'single',
            shares: [{ memberId: 'intruder', percentage: 100 }],
          },
        },
      }),
    ).rejects.toThrow('Ownership must reference workspace members')
    expect(writes).toEqual([])
  })

  it('rejects money that the client has not canonicalized', async () => {
    const { firestore, writes } = createFirestore({
      section: 'assets',
      collection: 'modelAssets',
      category: 'cash',
    })

    await expect(
      mutateFinancialModel(firestore, {
        workspaceId: 'workspace-a',
        userId: 'member-a',
        section: 'assets',
        operation: 'create',
        item: {
          categoryId: 'cash',
          subcategoryId: 'current_account',
          itemName: 'Savings',
          notes: '',
          currentValue: 100.126,
          detail: {},
          valueSource: 'manual',
          ownership,
        },
      }),
    ).rejects.toThrow('A non-negative numeric value is required')
    expect(writes).toEqual([])
  })

  it('updates an existing item and its monthly projection in the same transaction', async () => {
    const existing = {
      id: 'mortgage-a',
      categoryId: 'housing',
      subcategoryId: 'mortgage_rent',
      itemName: 'Main home',
      notes: '',
      estimate: { amount: 10, frequency: 'monthly' },
      variability: 'fixed',
      recurrence: 'recurring',
      necessity: 'essential',
      monthlyAmounts: monthlyAmounts(10),
      ownership,
    }
    const { firestore, writes } = createFirestore({
      section: 'expenses',
      collection: 'modelExpenses',
      category: 'housing',
      items: [existing],
      configCategory: { enabled: true },
    })

    const result = await mutateFinancialModel(firestore, {
      workspaceId: 'workspace-a',
      userId: 'member-a',
      section: 'expenses',
      operation: 'update',
      itemId: existing.id,
      item: {
        ...existing,
        subcategoryId: 'utilities',
        estimate: { amount: 20, frequency: 'monthly' },
        monthlyAmounts: monthlyAmounts(20),
      },
    })

    expect(result.expense.estimate.amount).toBe(20)
    expect(result.expense.subcategoryId).toBe('mortgage_rent')
    const financialYear = writes.find(({ path }) =>
      path.endsWith(`/financialYears/${currentYear()}`),
    ).data
    expect(financialYearValue(financialYear, 'expenses')).toBe(240)
    expect(financialYearValue(financialYear, 'savings')).toBe(-240)
  })

  it('allows multiple named items in the same expense subcategory', async () => {
    const first = {
      id: 'subscription-a',
      categoryId: 'leisure',
      subcategoryId: 'streaming',
      itemName: 'Netflix',
      notes: '',
      estimate: { amount: 18, frequency: 'monthly' },
      monthlyAmounts: monthlyAmounts(18),
      variability: 'fixed',
      recurrence: 'recurring',
      necessity: 'lifestyle',
      ownership,
    }
    const { firestore, writes } = createFirestore({
      section: 'expenses',
      collection: 'modelExpenses',
      category: 'leisure',
      items: [first],
      configCategory: { enabled: true },
    })

    const result = await mutateFinancialModel(firestore, {
      workspaceId: 'workspace-a',
      userId: 'member-a',
      section: 'expenses',
      operation: 'create',
      item: {
        ...first,
        id: undefined,
        itemName: 'Spotify',
        estimate: { amount: 12, frequency: 'monthly' },
        monthlyAmounts: monthlyAmounts(12),
      },
    })

    expect(result.expense.itemName).toBe('Spotify')
    expect(result.expense.id).not.toBe(first.id)
    const financialYear = writes.find(({ path }) =>
      path.endsWith(`/financialYears/${currentYear()}`),
    ).data
    expect(financialYearValue(financialYear, 'expenses')).toBe(360)
  })

  it('allows multiple named items in the same income subcategory', async () => {
    const first = {
      id: 'salary-a',
      categoryId: 'employment',
      subcategoryId: 'salary',
      itemName: 'Company salary',
      notes: '',
      calculation: { mode: 'annual_salary', annualAmount: 1200, paymentsPerYear: 12 },
      disposablePercentage: 100,
      ownership,
    }
    const { firestore, writes } = createFirestore({
      section: 'income',
      collection: 'modelIncome',
      category: 'employment',
      items: [first],
      configCategory: { enabled: true },
    })

    const result = await mutateFinancialModel(firestore, {
      workspaceId: 'workspace-a',
      userId: 'member-a',
      section: 'income',
      operation: 'create',
      item: {
        ...first,
        id: undefined,
        itemName: 'Consulting salary',
        calculation: { mode: 'annual_salary', annualAmount: 600, paymentsPerYear: 12 },
      },
    })

    expect(result.income.itemName).toBe('Consulting salary')
    expect(result.income.id).not.toBe(first.id)
    const financialYear = writes.find(({ path }) =>
      path.endsWith(`/financialYears/${currentYear()}`),
    ).data
    expect(financialYearValue(financialYear, 'income')).toBe(1800)
  })
})

function createFirestore({
  section,
  collection,
  category,
  items = [],
  configCategory = { enabled: true, ownership },
  memberIds = ['member-a'],
}) {
  const writes = []
  let generatedId = 0
  const year = currentYear()
  const financialYear = buildFinancialYear({ year })

  function reference(path, kind = 'document') {
    const value = {
      path,
      id: path.split('/').at(-1),
      kind,
      collection(name) {
        return reference(`${path}/${name}`, 'collection')
      },
      doc(id = `generated-${++generatedId}`) {
        return reference(`${path}/${id}`, 'document')
      },
      where() {
        value.kind = 'query'
        return value
      },
    }
    return value
  }

  function snapshotFor(target) {
    if (target.path === 'workspaces/workspace-a') {
      return documentSnapshot({ memberIds })
    }
    if (target.path === `workspaces/workspace-a/modelConfig/${section}`) {
      return documentSnapshot({ categories: { [category]: configCategory } })
    }
    if (target.path === `workspaces/workspace-a/financialYears/${year}`) {
      return documentSnapshot(financialYear)
    }
    if (target.path === `workspaces/workspace-a/${collection}`) return querySnapshot(items)
    if (target.path === 'workspaces/workspace-a/expenseTracking') return querySnapshot([])
    if (target.path.startsWith(`workspaces/workspace-a/${collection}/`)) {
      const id = target.path.split('/').at(-1)
      return documentSnapshot(items.find((item) => item.id === id) || null)
    }
    throw new Error(`Unexpected read: ${target.path}`)
  }

  const firestore = {
    collection(name) {
      return reference(name, 'collection')
    },
    async runTransaction(callback) {
      return callback({
        get: async (target) => snapshotFor(target),
        set(target, data) {
          writes.push({ path: target.path, data })
        },
        delete(target) {
          writes.push({ path: target.path, deleted: true })
        },
      })
    },
  }

  return { firestore, writes }
}

function documentSnapshot(data) {
  return { exists: data != null, data: () => data ?? undefined }
}

function querySnapshot(documents) {
  return {
    docs: documents.map(({ id, ...data }) => ({ id, data: () => data })),
  }
}

function monthlyAmounts(amount) {
  return Object.fromEntries(
    [
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
    ].map((month) => [month, amount]),
  )
}
