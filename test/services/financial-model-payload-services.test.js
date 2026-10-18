import { beforeEach, describe, expect, it, vi } from 'vitest'

const { updateFinancialModelItem } = vi.hoisted(() => ({
  updateFinancialModelItem: vi.fn(async (_workspaceId, _section, _itemId, item) => ({ item })),
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(),
  where: vi.fn(),
  writeBatch: vi.fn(),
}))

vi.mock('@/firebase/firebase', () => ({ db: {} }))

vi.mock('@/services/firebase/financial-model-mutations.service', () => ({
  createFinancialModelItem: vi.fn(),
  deleteFinancialModelCategory: vi.fn(),
  deleteFinancialModelItem: vi.fn(),
  updateFinancialModelItem,
}))

import { updateAsset } from '../../src/services/firebase/assets.service.js'
import { updateIncome } from '../../src/services/firebase/income.service.js'
import { updateLiability } from '../../src/services/firebase/liabilities.service.js'

const ownership = {
  mode: 'single',
  shares: [{ memberId: 'member-a', percentage: 100 }],
}

describe('financial model service payloads', () => {
  beforeEach(() => updateFinancialModelItem.mockClear())

  it('canonicalizes assets before updating them', async () => {
    await updateAsset(
      'workspace-a',
      'asset-a',
      {
        category: 'cash',
        subtype: 'current_account',
        name: '  Savings  ',
        currentValue: '100.126',
        ownership,
      },
      ['member-a'],
    )

    expect(updateFinancialModelItem).toHaveBeenCalledWith('workspace-a', 'assets', 'asset-a', {
      category: 'cash',
      subtype: 'current_account',
      name: 'Savings',
      currentValue: 100.13,
      ownership,
      valueSource: 'manual',
    })
  })

  it('canonicalizes liabilities before updating them', async () => {
    await updateLiability(
      'workspace-a',
      'liability-a',
      {
        category: 'mortgage',
        name: '  Home loan  ',
        balance: '999.999',
        ownership,
      },
      ['member-a'],
    )

    expect(updateFinancialModelItem).toHaveBeenCalledWith(
      'workspace-a',
      'liabilities',
      'liability-a',
      {
        category: 'mortgage',
        name: 'Home loan',
        balance: 1000,
        ownership,
      },
    )
  })

  it('canonicalizes income before updating it', async () => {
    await updateIncome(
      'workspace-a',
      'income-a',
      {
        categoryId: 'employment',
        subcategoryId: 'salary',
        itemName: '  Salary  ',
        notes: '  Main employment  ',
        calculation: {
          mode: 'annual_salary',
          annualAmount: '42000.126',
          paymentsPerYear: '12',
        },
        ownership,
      },
      ['member-a'],
    )

    expect(updateFinancialModelItem).toHaveBeenCalledWith('workspace-a', 'income', 'income-a', {
      categoryId: 'employment',
      subcategoryId: 'salary',
      itemName: 'Salary',
      notes: 'Main employment',
      calculation: { mode: 'annual_salary', annualAmount: 42000.13, paymentsPerYear: 12 },
      disposablePercentage: 100,
      ownership,
    })
  })
})
