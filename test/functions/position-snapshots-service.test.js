import { describe, expect, it } from 'vitest'
import positionSnapshotsService from '../../functions/services/position-snapshots.js'

const { synchronizePositionSnapshots } = positionSnapshotsService

function createFirestore() {
  const writes = []
  const existingSnapshots = [
    {
      id: '2026-01',
      period: '2026-01',
      status: 'current',
      asOfDate: '2026-01-15',
    },
  ]
  const ownership = { mode: 'single', shares: [{ memberId: 'member-a', percentage: 100 }] }
  const assets = [
    {
      id: 'property-a',
      categoryId: 'real_estate',
      subcategoryId: 'primary_home',
      itemName: 'Home',
      currentValue: 100_000,
      ownership,
      detail: {
        realEstate: {
          schemaVersion: 2,
          purchasePrice: 100_000,
          purchaseDate: '2026-01-01',
          annualAppreciationRate: 2.5,
        },
      },
    },
  ]
  const liabilities = [
    {
      id: 'mortgage-a',
      categoryId: 'mortgage',
      subcategoryId: 'fixed_mortgage',
      itemName: 'Mortgage',
      balance: 10_000,
      ownership,
      detail: {
        mortgage: {
          schemaVersion: 2,
          startDate: '2025-12-01',
          annualInterestRate: 0,
          monthlyPayment: 1_000,
          balanceAnchor: { amount: 10_000, date: '2026-01-01' },
        },
      },
    },
  ]

  function reference(path, type = 'document') {
    return {
      path,
      type,
      collection(name) {
        return reference(`${path}/${name}`, 'collection')
      },
      doc(id) {
        return reference(`${path}/${id}`, 'document')
      },
      async get() {
        if (path === 'workspaces/workspace-a/positionSnapshots') {
          return querySnapshot(existingSnapshots, path)
        }
        throw new Error(`Unexpected direct read: ${path}`)
      },
    }
  }

  const firestore = {
    collection(name) {
      return reference(name, 'collection')
    },
    runTransaction: async (callback) =>
      callback({
        get: async (target) => {
          if (target.path === 'workspaces/workspace-a') return documentSnapshot({ memberIds: [] })
          if (target.path.includes('/positionSnapshots/')) {
            const period = target.path.split('/').at(-1)
            return documentSnapshot(existingSnapshots.find((item) => item.period === period))
          }
          if (target.path.endsWith('/modelConfig/assets')) {
            return documentSnapshot({ categories: { real_estate: { enabled: true } } })
          }
          if (target.path.endsWith('/modelConfig/liabilities')) {
            return documentSnapshot({ categories: { mortgage: { enabled: true } } })
          }
          if (target.path.endsWith('/modelAssets')) return querySnapshot(assets, target.path)
          if (target.path.endsWith('/modelLiabilities')) {
            return querySnapshot(liabilities, target.path)
          }
          throw new Error(`Unexpected transaction read: ${target.path}`)
        },
        set: (target, data) => writes.push({ path: target.path, data }),
      }),
  }
  return { firestore, writes }
}

function documentSnapshot(data) {
  return { exists: data != null, data: () => data }
}

function querySnapshot(items, path) {
  return {
    docs: items.map(({ id, ...data }) => ({
      id,
      ref: { path: `${path}/${id}` },
      data: () => data,
    })),
  }
}

describe('position snapshot persistence', () => {
  it('closes every inactive month and writes the current position without gaps', async () => {
    const { firestore, writes } = createFirestore()

    await synchronizePositionSnapshots(firestore, 'workspace-a', '2026-04-15')

    expect(writes.map(({ data }) => [data.period, data.status])).toEqual([
      ['2026-01', 'closed'],
      ['2026-02', 'closed'],
      ['2026-03', 'closed'],
      ['2026-04', 'current'],
    ])
    expect(
      writes[1].data.liabilities.categories.mortgage.subcategories.fixed_mortgage.items[
        'mortgage-a'
      ].total,
    ).toBe(9_000)
    expect(
      writes[2].data.liabilities.categories.mortgage.subcategories.fixed_mortgage.items[
        'mortgage-a'
      ].total,
    ).toBe(8_000)
    expect(writes[2].data.totals).toEqual({
      assets: 100_000,
      liabilities: 8_000,
      netWorth: 92_000,
    })
  })
})
