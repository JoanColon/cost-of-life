import { describe, expect, it } from 'vitest'
import financialYearsService from '../../functions/services/financial-years.js'

const { rebuildFinancialYear } = financialYearsService

function documentSnapshot(data) {
  return { exists: data != null, data: () => data ?? undefined }
}

function createFirestore({ financialYear = null, configs = {}, models = {} } = {}) {
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

describe('financial year persistence', () => {
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
    expect(writes[0].data.totals).toMatchObject({
      assets: 0,
      liabilities: 0,
      netWorth: 0,
      income: 0,
      expenses: 0,
      savings: 0,
    })
  })

  it('backfills the first known asset value, then preserves closed months', async () => {
    const ownership = { mode: 'single', shares: [{ memberId: 'member-a', percentage: 100 }] }
    const initial = createFirestore()
    await rebuildFinancialYear(initial.firestore, 'workspace-a', 2026)

    const firstValue = createFirestore({
      financialYear: initial.writes[0].data,
      configs: { assets: { categories: { cash: { enabled: true } } } },
      models: {
        assets: [{ id: 'account', category: 'cash', currentValue: 1200, ownership }],
      },
    })
    await rebuildFinancialYear(firstValue.firestore, 'workspace-a', 2026, {
      sections: ['assets'],
      positionMonth: '10',
    })

    expect(firstValue.writes[0].data.months['01'].assets.total).toBe(1200)
    expect(firstValue.writes[0].data.months['10'].assets.total).toBe(1200)
    expect(firstValue.writes[0].data.projectionState.assetsInitializedMonth).toBe('10')

    const sameMonthValue = createFirestore({
      financialYear: firstValue.writes[0].data,
      configs: { assets: { categories: { cash: { enabled: true } } } },
      models: {
        assets: [
          { id: 'account', category: 'cash', currentValue: 1200, ownership },
          { id: 'portfolio', category: 'cash', currentValue: 500, ownership },
        ],
      },
    })
    await rebuildFinancialYear(sameMonthValue.firestore, 'workspace-a', 2026, {
      sections: ['assets'],
      positionMonth: '10',
    })

    expect(sameMonthValue.writes[0].data.months['01'].assets.total).toBe(1700)

    const nextValue = createFirestore({
      financialYear: sameMonthValue.writes[0].data,
      configs: { assets: { categories: { cash: { enabled: true } } } },
      models: {
        assets: [
          { id: 'account', category: 'cash', currentValue: 1300, ownership },
          { id: 'portfolio', category: 'cash', currentValue: 500, ownership },
        ],
      },
    })
    await rebuildFinancialYear(nextValue.firestore, 'workspace-a', 2026, {
      sections: ['assets'],
      positionMonth: '12',
    })

    expect(nextValue.writes[0].data.months['01'].assets.total).toBe(1700)
    expect(nextValue.writes[0].data.months['11'].assets.total).toBe(1700)
    expect(nextValue.writes[0].data.months['12'].assets.total).toBe(1800)
  })
})
