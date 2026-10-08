import { describe, expect, it } from 'vitest'
import historyService from '../../functions/services/financial-history.js'

const { captureMonthlyFinancialSnapshot } = historyService

function createFirestore(existingHistory = null) {
  const state = existingHistory ? structuredClone(existingHistory) : null
  const reads = []
  const writes = []

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
    }
  }

  function documentSnapshot(data) {
    return {
      exists: data !== null,
      data: () => data ?? undefined,
    }
  }

  function querySnapshot(documents = []) {
    return {
      docs: documents.map(({ id, data }) => ({ id, data: () => data })),
    }
  }

  const transaction = {
    async get(target) {
      reads.push(target.path)
      if (target.path.endsWith('/history/2026')) return documentSnapshot(state)
      if (target.path.endsWith('/financialPosition/assetsSummary')) {
        return documentSnapshot({ categories: { cash: { enabled: true, manualValue: 100 } } })
      }
      if (target.path.endsWith('/financialPosition/liabilitiesSummary')) {
        return documentSnapshot(null)
      }
      if (target.path.endsWith('/assets')) return querySnapshot()
      if (target.path.endsWith('/liabilities')) return querySnapshot()
      throw new Error(`Unexpected read: ${target.path}`)
    },
    create(target, data) {
      writes.push({ operation: 'create', path: target.path, data })
    },
    update(target, ...fieldsAndValues) {
      writes.push({ operation: 'update', path: target.path, fieldsAndValues })
    },
  }

  return {
    firestore: {
      collection(name) {
        return reference(name, 'collection')
      },
      runTransaction(callback) {
        return callback(transaction)
      },
    },
    reads,
    writes,
  }
}

describe('financial history persistence', () => {
  it('creates a new annual document with the requested month', async () => {
    const { firestore, writes } = createFirestore()

    const result = await captureMonthlyFinancialSnapshot(firestore, 'workspace-a', 2026, '03')

    expect(result.status).toBe('created')
    expect(writes).toHaveLength(1)
    expect(writes[0].operation).toBe('create')
    expect(writes[0].data).toMatchObject({
      year: 2026,
      schemaVersion: 1,
      months: { '03': { netWorth: 100 } },
    })
  })

  it('does not read or write financial data when the month already exists', async () => {
    const january = { netWorth: 10 }
    const { firestore, reads, writes } = createFirestore({ months: { '01': january } })

    const result = await captureMonthlyFinancialSnapshot(firestore, 'workspace-a', 2026, '01')

    expect(result.status).toBe('skipped')
    expect(reads).toEqual(['workspaces/workspace-a/history/2026'])
    expect(writes).toEqual([])
  })

  it('updates only the requested month and retains old labels', async () => {
    const january = { netWorth: 10 }
    const { firestore, writes } = createFirestore({
      months: { '01': january },
      itemLabels: { assets: { deletedAsset: 'Old asset' }, liabilities: {} },
    })

    await captureMonthlyFinancialSnapshot(firestore, 'workspace-a', 2026, '02')

    expect(writes).toHaveLength(1)
    expect(writes[0].operation).toBe('update')
    const fields = writes[0].fieldsAndValues
    const monthPath = fields.find((field) => field?.segments?.[0] === 'months')
    const assetLabelsPathIndex = fields.findIndex(
      (field) => field?.segments?.join('.') === 'itemLabels.assets',
    )

    expect(monthPath.segments).toEqual(['months', '02'])
    expect(fields.some((field) => field?.segments?.join('.') === 'months.01')).toBe(false)
    expect(fields[assetLabelsPathIndex + 1]).toEqual({ deletedAsset: 'Old asset' })
  })

  it('only replaces an existing month when explicitly requested', async () => {
    const { firestore, writes } = createFirestore({ months: { '03': { netWorth: 10 } } })

    const result = await captureMonthlyFinancialSnapshot(firestore, 'workspace-a', 2026, '03', {
      replace: true,
    })

    expect(result.status).toBe('replaced')
    expect(writes).toHaveLength(1)
  })
})
