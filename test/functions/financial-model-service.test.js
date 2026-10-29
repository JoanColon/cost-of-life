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

  it('stores mortgage Layer 3 details while projecting the root balance', async () => {
    const item = {
      categoryId: 'mortgage',
      subcategoryId: 'mortgage',
      itemName: 'Home mortgage',
      notes: '',
      balance: 146_230,
      ownership,
      detail: {
        mortgage: {
          schemaVersion: 1,
          originalPrincipal: 220_000,
          annualInterestRate: 2.41,
          monthlyPayment: 812,
          startDate: '2013-03-01',
          termMonths: 360,
          amortizationType: 'french',
          fixedRate: true,
        },
      },
    }
    const { firestore, writes } = createFirestore({
      section: 'liabilities',
      collection: 'modelLiabilities',
      category: 'mortgage',
    })

    const result = await mutateFinancialModel(firestore, {
      workspaceId: 'workspace-a',
      userId: 'member-a',
      section: 'liabilities',
      operation: 'create',
      item,
    })

    expect(result.liability.detail.mortgage).toMatchObject({
      originalPrincipal: 220_000,
      amortizationType: 'french',
    })
    const financialYearWrite = writes.find(({ path }) =>
      path.endsWith(`/financialYears/${currentYear()}`),
    )
    expect(financialYearValue(financialYearWrite.data, 'liabilities')).toBe(146_230)
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

  it('preserves a simple income entry while rebuilding the financial year', async () => {
    const { firestore, writes } = createFirestore({
      section: 'income',
      collection: 'modelIncome',
      category: 'employment',
      configCategory: { enabled: true },
    })

    const result = await mutateFinancialModel(firestore, {
      workspaceId: 'workspace-a',
      userId: 'member-a',
      section: 'income',
      operation: 'create',
      item: {
        categoryId: 'employment',
        subcategoryId: 'salary',
        itemName: 'Employment',
        notes: '',
        calculation: { mode: 'annual_salary', annualAmount: 42000, paymentsPerYear: 12 },
        disposablePercentage: 100,
        entryMode: 'simple',
        ownership,
      },
    })

    expect(result.income.entryMode).toBe('simple')
    const financialYear = writes.find(({ path }) =>
      path.endsWith(`/financialYears/${currentYear()}`),
    ).data
    expect(financialYearValue(financialYear, 'income')).toBe(42000)
  })

  it('prevents two dividend income sources from linking to the same portfolio', async () => {
    const existing = {
      id: 'dividends-a',
      categoryId: 'investments',
      subcategoryId: 'dividends',
      itemName: 'Existing dividends',
      notes: '',
      calculation: { mode: 'recurring', amount: 600, frequency: 'yearly' },
      portfolioAssetId: 'portfolio-a',
      disposablePercentage: 100,
      ownership,
    }
    const { firestore, writes } = createFirestore({
      section: 'income',
      collection: 'modelIncome',
      category: 'investments',
      items: [existing],
    })

    await expect(
      mutateFinancialModel(firestore, {
        workspaceId: 'workspace-a',
        userId: 'member-a',
        section: 'income',
        operation: 'create',
        item: { ...existing, id: undefined, itemName: 'Duplicate dividends' },
      }),
    ).rejects.toThrow('already linked')
    expect(writes).toEqual([])
  })

  it('uses the available percentage of dividend income in the financial year', async () => {
    const { firestore, writes } = createFirestore({
      section: 'income',
      collection: 'modelIncome',
      category: 'investments',
      configCategory: { enabled: true },
    })

    const result = await mutateFinancialModel(firestore, {
      workspaceId: 'workspace-a',
      userId: 'member-a',
      section: 'income',
      operation: 'create',
      item: {
        categoryId: 'investments',
        subcategoryId: 'dividends',
        itemName: 'Broker dividends',
        notes: '',
        calculation: { mode: 'recurring', amount: 1000, frequency: 'yearly' },
        disposablePercentage: 60,
        portfolioAssetId: null,
        ownership,
      },
    })

    expect(result.income.disposablePercentage).toBe(60)
    const financialYear = writes.find(({ path }) =>
      path.endsWith(`/financialYears/${currentYear()}`),
    ).data
    expect(financialYearValue(financialYear, 'income')).toBe(1000)
    expect(financialYearValue(financialYear, 'savings')).toBe(600)
  })

  it('preserves a simple expense entry while rebuilding the financial year', async () => {
    const { firestore, writes } = createFirestore({
      section: 'expenses',
      collection: 'modelExpenses',
      category: 'housing',
      configCategory: { enabled: true },
    })

    const result = await mutateFinancialModel(firestore, {
      workspaceId: 'workspace-a',
      userId: 'member-a',
      section: 'expenses',
      operation: 'create',
      item: {
        categoryId: 'housing',
        subcategoryId: 'mortgage_rent',
        itemName: 'Housing',
        notes: '',
        estimate: { amount: 1000, frequency: 'monthly' },
        monthlyAmounts: monthlyAmounts(1000),
        variability: 'variable',
        recurrence: 'recurring',
        necessity: null,
        entryMode: 'simple',
        ownership,
      },
    })

    expect(result.expense.entryMode).toBe('simple')
    const financialYear = writes.find(({ path }) =>
      path.endsWith(`/financialYears/${currentYear()}`),
    ).data
    expect(financialYearValue(financialYear, 'expenses')).toBe(12000)
    expect(financialYearValue(financialYear, 'savings')).toBe(-12000)
  })

  it('turns linked dividend income into a manual value when deleting its portfolio asset', async () => {
    const { firestore, writes } = createFirestore({
      section: 'assets',
      collection: 'modelAssets',
      category: 'investment',
      items: [{ id: 'investment-a', categoryId: 'investment', currentValue: 1000, ownership }],
      linkedIncome: [
        {
          id: 'dividends-a',
          portfolioAssetId: 'investment-a',
          calculation: { mode: 'recurring', amount: 100, frequency: 'yearly' },
        },
      ],
    })

    await mutateFinancialModel(firestore, {
      workspaceId: 'workspace-a',
      userId: 'member-a',
      section: 'assets',
      operation: 'delete',
      itemId: 'investment-a',
    })

    expect(writes).toContainEqual(
      expect.objectContaining({
        path: 'workspaces/workspace-a/modelIncome/dividends-a',
        data: expect.objectContaining({ portfolioAssetId: null }),
      }),
    )
  })

  it('rejects an expense category deletion when related writes exceed the transaction limit', async () => {
    const items = Array.from({ length: 498 }, (_, index) => ({
      id: `expense-${index}`,
      categoryId: 'housing',
      subcategoryId: 'utilities',
    }))
    const { firestore, writes } = createFirestore({
      section: 'expenses',
      collection: 'modelExpenses',
      category: 'housing',
      items,
    })

    await expect(
      mutateFinancialModel(firestore, {
        workspaceId: 'workspace-a',
        userId: 'member-a',
        section: 'expenses',
        operation: 'deleteCategory',
        categoryId: 'housing',
      }),
    ).rejects.toThrow('too many related items')
    expect(writes).toEqual([])
  })

  it('includes linked income writes when validating an asset category deletion', async () => {
    const items = Array.from({ length: 250 }, (_, index) => ({
      id: `investment-${index}`,
      categoryId: 'investment',
    }))
    const linkedIncome = items.map((item, index) => ({
      id: `income-${index}`,
      portfolioAssetId: item.id,
    }))
    const { firestore, writes } = createFirestore({
      section: 'assets',
      collection: 'modelAssets',
      category: 'investment',
      items,
      linkedIncome,
    })

    await expect(
      mutateFinancialModel(firestore, {
        workspaceId: 'workspace-a',
        userId: 'member-a',
        section: 'assets',
        operation: 'deleteCategory',
        categoryId: 'investment',
      }),
    ).rejects.toThrow('too many related items')
    expect(writes).toEqual([])
  })
})

function createFirestore({
  section,
  collection,
  category,
  items = [],
  configCategory = { enabled: true, ownership },
  memberIds = ['member-a'],
  linkedIncome = [],
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
    if (target.path === 'workspaces/workspace-a/modelIncome') {
      return {
        docs: linkedIncome.map(({ id, ...data }) => ({
          id,
          data: () => data,
          ref: reference(`workspaces/workspace-a/modelIncome/${id}`),
        })),
      }
    }
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
        update(target, data) {
          writes.push({ path: target.path, data })
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
