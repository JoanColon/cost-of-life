import { describe, expect, it, vi } from 'vitest'

const { createFinancialModelItem } = vi.hoisted(() => ({
  createFinancialModelItem: vi.fn(async (_workspaceId, _section, item) => ({ expense: item })),
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
  createFinancialModelItem,
  deleteFinancialModelCategory: vi.fn(),
  deleteFinancialModelItem: vi.fn(),
  updateFinancialModelItem: vi.fn(),
}))

import { createExpense } from '../../src/services/firebase/expenses.service.js'

describe('expenses service', () => {
  it('keeps ownership in the normalized expense sent to the callable function', async () => {
    const ownership = {
      mode: 'single',
      shares: [{ memberId: 'member-a', percentage: 100 }],
    }

    await createExpense(
      'workspace-a',
      {
        category: 'housing',
        type: 'mortgage_rent',
        name: '',
        estimate: { amount: 900, frequency: 'monthly' },
        monthlyAmounts: Object.fromEntries(
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
          ].map((month) => [month, 900]),
        ),
        variability: 'fixed',
        recurrence: 'recurring',
        necessity: 'essential',
        ownership,
      },
      ['member-a'],
    )

    expect(createFinancialModelItem).toHaveBeenCalledWith(
      'workspace-a',
      'expenses',
      expect.objectContaining({ ownership }),
    )
  })
})
