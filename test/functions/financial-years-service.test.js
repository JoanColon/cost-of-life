import { describe, expect, it } from 'vitest'
import financialYearsService from '../../functions/services/financial-years.js'
import { financialYearMonthValue } from '../../src/domain/financial/financial-year.js'

const { rebuildFinancialYear, refreshModeledPositions } = financialYearsService

function documentSnapshot(data) {
  return { exists: data != null, data: () => data ?? undefined }
}

function createFirestore({ workspace = {}, financialYear = null, configs = {}, models = {} } = {}) {
  const writes = []

  function reference(path, type = 'document') {
    const value = {
      path,
      type,
      collection(name) {
        return reference(`${path}/${name}`, 'collection')
      },
      doc(id) {
        return reference(`${path}/${id}`, 'document')
      },
      where() {
        return value
      },
      async get() {
        if (path === 'workspaces/workspace-a') return documentSnapshot(workspace)
        if (path.endsWith('/financialYears/2026')) return documentSnapshot(financialYear)
        if (path.includes('/modelConfig/')) {
          return documentSnapshot(configs[path.split('/').at(-1)] || { categories: {} })
        }
        if (path.endsWith('/modelAssets')) return querySnapshot(models.assets)
        if (path.endsWith('/modelLiabilities')) return querySnapshot(models.liabilities)
        if (path.endsWith('/modelExpenses')) return querySnapshot(models.expenses)
        if (path.endsWith('/modelIncome')) return querySnapshot(models.income)
        if (path.endsWith('/expenseTracking')) return { docs: [] }
        throw new Error(`Unexpected read: ${path}`)
      },
    }
    return value
  }

  const firestore = {
    collection(name) {
      return reference(name, 'collection')
    },
    async runTransaction(callback) {
      return callback({
        get: (target) => target.get(),
        set(target, data) {
          writes.push({ path: target.path, data })
        },
      })
    },
  }

  return { firestore, writes }
}

function querySnapshot(documents = []) {
  return {
    docs: documents.map(({ id, ...data }) => ({ id, data: () => data })),
  }
}

function createPositionRefreshFirestore({ assets = [], mortgages = [], expenses = [] } = {}) {
  const updates = []
  const queries = {}
  const firestore = {
    collection: () => ({
      doc: () => ({
        collection: (name) => ({
          name,
          where: () => (queries[name] ||= { name }),
        }),
      }),
    }),
    runTransaction: async (callback) =>
      callback({
        get: async (query) => {
          const items =
            query.name === 'modelAssets'
              ? assets
              : query.name === 'modelExpenses'
                ? expenses
                : mortgages
          return {
            docs: items.map(({ id, ...data }) => ({
              id,
              ref: { path: `${query.name}/${id}` },
              data: () => data,
            })),
          }
        },
        update: (reference, data) => updates.push({ reference, data }),
      }),
  }
  return { firestore, updates }
}

describe('financial year persistence', () => {
  it('materializes a changed annual property value for Layer 2', async () => {
    const updates = []
    const assetReference = { path: 'workspaces/workspace-a/modelAssets/property-a' }
    const assetsQuery = { type: 'assets-query' }
    const mortgagesQuery = { type: 'mortgages-query' }
    const firestore = {
      collection: () => ({
        doc: () => ({
          collection: (name) => ({
            where: () => (name === 'modelAssets' ? assetsQuery : mortgagesQuery),
          }),
        }),
      }),
      runTransaction: async (callback) =>
        callback({
          get: async (query) =>
            query === assetsQuery
              ? {
                  docs: [
                    {
                      ref: assetReference,
                      data: () => ({
                        categoryId: 'real_estate',
                        currentValue: 100_000,
                        valueSource: 'model',
                        detail: {
                          realEstate: {
                            schemaVersion: 2,
                            purchasePrice: 100_000,
                            purchaseDate: '2020-04-01',
                            annualAppreciationRate: 2.5,
                          },
                        },
                      }),
                    },
                  ],
                }
              : { docs: [] },
          update: (reference, data) => updates.push({ reference, data }),
        }),
    }

    const result = await refreshModeledPositions(
      firestore,
      'workspace-a',
      'member-a',
      '2024-04-01',
    )

    expect(result).toEqual({
      assetsUpdated: 1,
      liabilitiesUpdated: 0,
      expensesUpdated: 0,
      mortgagesMigrated: 0,
    })
    expect(updates[0].reference).toBe(assetReference)
    expect(updates[0].data).toMatchObject({ currentValue: 110_381.29, valueSource: 'model' })
  })

  it('materializes the mortgage balance from its anchor and completed payments', async () => {
    const { firestore, updates } = createPositionRefreshFirestore({
      mortgages: [
        {
          id: 'mortgage-a',
          categoryId: 'mortgage',
          balance: 10_000,
          detail: {
            mortgage: {
              schemaVersion: 2,
              annualInterestRate: 12,
              monthlyPayment: 1_000,
              startDate: '2025-12-15',
              balanceAnchor: { amount: 10_000, date: '2026-01-15' },
            },
          },
        },
      ],
    })

    const result = await refreshModeledPositions(
      firestore,
      'workspace-a',
      'member-a',
      '2026-03-15',
    )

    expect(result.liabilitiesUpdated).toBe(1)
    expect(updates[0].data.balance).toBe(8_191)
  })

  it('anchors an existing mortgage without changing its balance during migration', async () => {
    const { firestore, updates } = createPositionRefreshFirestore({
      mortgages: [
        {
          id: 'mortgage-a',
          categoryId: 'mortgage',
          balance: 104_000,
          detail: {
            mortgage: {
              schemaVersion: 1,
              originalPrincipal: 120_000,
              annualInterestRate: 0.95,
              monthlyPayment: 386,
              startDate: '2022-04-01',
              termMonths: 360,
              amortizationType: 'french',
              fixedRate: true,
            },
          },
        },
      ],
    })

    const result = await refreshModeledPositions(
      firestore,
      'workspace-a',
      'member-a',
      '2026-11-01',
    )

    expect(result).toMatchObject({ liabilitiesUpdated: 0, mortgagesMigrated: 1 })
    expect(updates[0].data['detail.mortgage'].balanceAnchor).toEqual({
      amount: 104_000,
      date: '2026-11-01',
    })
    expect(updates[0].data.balance).toBeUndefined()
  })

  it('stops a linked mortgage expense when the modeled balance reaches zero', async () => {
    const { firestore, updates } = createPositionRefreshFirestore({
      mortgages: [
        {
          id: 'mortgage-a',
          categoryId: 'mortgage',
          balance: 500,
          detail: {
            mortgage: {
              schemaVersion: 2,
              annualInterestRate: 0,
              monthlyPayment: 500,
              startDate: '2026-01-01',
              balanceAnchor: { amount: 500, date: '2026-01-01' },
            },
          },
        },
      ],
      expenses: [{ id: 'expense-a', liabilityId: 'mortgage-a' }],
    })

    const result = await refreshModeledPositions(
      firestore,
      'workspace-a',
      'member-a',
      '2026-02-01',
    )

    expect(result).toMatchObject({ liabilitiesUpdated: 1, expensesUpdated: 1 })
    expect(updates.find(({ reference }) => reference.path === 'modelExpenses/expense-a').data)
      .toMatchObject({ estimate: { amount: 0, frequency: 'monthly' } })
  })

  it('does not rebuild data for a workspace being deleted', async () => {
    const { firestore, writes } = createFirestore({
      workspace: { deletionPendingAt: { seconds: 1 } },
    })

    const result = await rebuildFinancialYear(firestore, 'workspace-a', 2026)

    expect(result.status).toBe('skipped')
    expect(writes).toEqual([])
  })

  it('persists all four model sections inside each projected month', async () => {
    const { firestore, writes } = createFirestore()

    const result = await rebuildFinancialYear(firestore, 'workspace-a', 2026)

    expect(result.status).toBe('rebuilt')
    expect(writes).toHaveLength(1)
    expect(Object.keys(writes[0].data.months)).toHaveLength(12)
    expect(writes[0].data.months['01'].assets).toBeDefined()
    expect(writes[0].data.months['01'].liabilities).toBeDefined()
    expect(writes[0].data.months['01'].income).toBeDefined()
    expect(writes[0].data.months['01'].expenses).toBeDefined()
    expect(writes[0].data.totals).toBeUndefined()
    expect(writes[0].data.schemaVersion).toBe(1)
  })

  it('backfills the first known asset value, then preserves closed months', async () => {
    const ownership = { mode: 'single', shares: [{ memberId: 'member-a', percentage: 100 }] }
    const initial = createFirestore()
    await rebuildFinancialYear(initial.firestore, 'workspace-a', 2026)

    const firstValue = createFirestore({
      financialYear: initial.writes[0].data,
      configs: { assets: { categories: { cash: { enabled: true } } } },
      models: {
        assets: [asset('account', 'current_account', 'Account', 1200, ownership)],
      },
    })
    await rebuildFinancialYear(firstValue.firestore, 'workspace-a', 2026, {
      sections: ['assets'],
      positionMonth: '10',
    })

    expect(financialYearMonthValue(firstValue.writes[0].data, '01', 'assets')).toBe(1200)
    expect(financialYearMonthValue(firstValue.writes[0].data, '10', 'assets')).toBe(1200)
    expect(firstValue.writes[0].data.projectionState.assetsInitializedMonth).toBe('10')

    const sameMonthValue = createFirestore({
      financialYear: firstValue.writes[0].data,
      configs: { assets: { categories: { cash: { enabled: true } } } },
      models: {
        assets: [
          asset('account', 'current_account', 'Account', 1200, ownership),
          asset('portfolio', 'investment_account', 'Portfolio', 500, ownership),
        ],
      },
    })
    await rebuildFinancialYear(sameMonthValue.firestore, 'workspace-a', 2026, {
      sections: ['assets'],
      positionMonth: '10',
    })

    expect(financialYearMonthValue(sameMonthValue.writes[0].data, '01', 'assets')).toBe(1700)

    const nextValue = createFirestore({
      financialYear: sameMonthValue.writes[0].data,
      configs: { assets: { categories: { cash: { enabled: true } } } },
      models: {
        assets: [
          asset('account', 'current_account', 'Account', 1300, ownership),
          asset('portfolio', 'investment_account', 'Portfolio', 500, ownership),
        ],
      },
    })
    await rebuildFinancialYear(nextValue.firestore, 'workspace-a', 2026, {
      sections: ['assets'],
      positionMonth: '12',
    })

    expect(financialYearMonthValue(nextValue.writes[0].data, '01', 'assets')).toBe(1700)
    expect(financialYearMonthValue(nextValue.writes[0].data, '11', 'assets')).toBe(1700)
    expect(financialYearMonthValue(nextValue.writes[0].data, '12', 'assets')).toBe(1800)
  })

  it('treats a zero-valued item as an observed position', async () => {
    const ownership = { mode: 'single', shares: [{ memberId: 'member-a', percentage: 100 }] }
    const initial = createFirestore()
    await rebuildFinancialYear(initial.firestore, 'workspace-a', 2026)

    const zeroValue = createFirestore({
      financialYear: initial.writes[0].data,
      configs: { assets: { categories: { cash: { enabled: true } } } },
      models: {
        assets: [asset('account', 'current_account', 'Account', 0, ownership)],
      },
    })
    await rebuildFinancialYear(zeroValue.firestore, 'workspace-a', 2026, {
      sections: ['assets'],
      positionMonth: '10',
    })

    expect(zeroValue.writes[0].data.projectionState.assetsInitializedMonth).toBe('10')

    const laterValue = createFirestore({
      financialYear: zeroValue.writes[0].data,
      configs: { assets: { categories: { cash: { enabled: true } } } },
      models: {
        assets: [asset('account', 'current_account', 'Account', 1000, ownership)],
      },
    })
    await rebuildFinancialYear(laterValue.firestore, 'workspace-a', 2026, {
      sections: ['assets'],
      positionMonth: '12',
    })

    expect(financialYearMonthValue(laterValue.writes[0].data, '11', 'assets')).toBe(0)
    expect(financialYearMonthValue(laterValue.writes[0].data, '12', 'assets')).toBe(1000)
  })
})

function asset(id, subcategoryId, itemName, currentValue, ownership) {
  return {
    id,
    categoryId: 'cash',
    subcategoryId,
    itemName,
    notes: '',
    currentValue,
    ownership,
  }
}
