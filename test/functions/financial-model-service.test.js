import { describe, expect, it } from 'vitest'
import financialModelService from '../../functions/services/financial-model.js'
import financialYearDomain from '../../functions/domain/financial-year.js'
import financialYearsService from '../../functions/services/financial-years.js'

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
      item: { category: 'cash', name: 'Account', currentValue: 100, ownership },
      expected: { assets: 100, netWorth: 100 },
    },
    {
      section: 'liabilities',
      collection: 'modelLiabilities',
      result: 'liability',
      item: { category: 'loan', name: 'Loan', balance: 40, ownership },
      expected: { liabilities: 40, netWorth: -40 },
    },
    {
      section: 'income',
      collection: 'modelIncome',
      result: 'income',
      item: {
        category: 'employment',
        subtype: 'salary',
        name: '',
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
        category: 'housing',
        type: 'mortgage_rent',
        name: '',
        estimate: { amount: 10, frequency: 'monthly' },
        variability: 'fixed',
        recurrence: 'recurring',
        necessity: 'essential',
        ownership,
      },
      expected: { expenses: 120, savings: -120 },
    },
  ])('writes a $section item and its financial year together', async (testCase) => {
    const { firestore, writes } = createFirestore({
      section: testCase.section,
      collection: testCase.collection,
      category: testCase.item.category,
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
    expect(financialYearWrite.data.totals).toMatchObject(testCase.expected)
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
          category: 'cash',
          currentValue: 100,
          ownership: {
            mode: 'single',
            shares: [{ memberId: 'intruder', percentage: 100 }],
          },
        },
      }),
    ).rejects.toThrow('Ownership must reference workspace members')
    expect(writes).toEqual([])
  })

  it('updates an existing item and its projected totals in the same transaction', async () => {
    const existing = {
      id: 'housing--mortgage_rent',
      category: 'housing',
      type: 'mortgage_rent',
      name: '',
      estimate: { amount: 10, frequency: 'monthly' },
      variability: 'fixed',
      recurrence: 'recurring',
      necessity: 'essential',
      ownership,
    }
    const { firestore, writes } = createFirestore({
      section: 'expenses',
      collection: 'modelExpenses',
      category: 'housing',
      items: [existing],
    })

    const result = await mutateFinancialModel(firestore, {
      workspaceId: 'workspace-a',
      userId: 'member-a',
      section: 'expenses',
      operation: 'update',
      itemId: existing.id,
      item: { ...existing, estimate: { amount: 20, frequency: 'monthly' } },
    })

    expect(result.expense.estimate.amount).toBe(20)
    expect(writes.find(({ path }) => path.endsWith(`/financialYears/${currentYear()}`)).data.totals)
      .toMatchObject({ expenses: 240, savings: -240 })
  })
})

function createFirestore({ section, collection, category, items = [] }) {
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
      return documentSnapshot({ memberIds: ['member-a'] })
    }
    if (target.path === `workspaces/workspace-a/modelConfig/${section}`) {
      return documentSnapshot({ categories: { [category]: { enabled: true, ownership } } })
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
