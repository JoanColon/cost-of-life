import { describe, expect, it, vi } from 'vitest'

const { createFinancialModelItem, updateFinancialModelItem } = vi.hoisted(() => ({
  createFinancialModelItem: vi.fn(async (_workspaceId, _section, item) => ({ expense: item })),
  updateFinancialModelItem: vi.fn(async (_workspaceId, _section, _itemId, item) => ({
    expense: item,
  })),
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => 'timestamp'),
  where: vi.fn(),
  writeBatch: vi.fn(),
}))

vi.mock('@/firebase/firebase', () => ({ db: {} }))

vi.mock('@/services/firebase/current-user', () => ({ currentUserId: () => 'user-a' }))

vi.mock('@/services/firebase/model-config.service', () => ({
  getModelConfig: vi.fn(),
  modelConfigRef: vi.fn(() => ({ id: 'expenses' })),
}))

vi.mock('@/services/firebase/financial-model-mutations.service', () => ({
  createFinancialModelItem,
  deleteFinancialModelCategory: vi.fn(),
  deleteFinancialModelItem: vi.fn(),
  updateFinancialModelItem,
}))

import { createExpense, updateExpense } from '../../src/services/firebase/expenses.service.js'

describe('expenses service', () => {
  it('keeps ownership in the normalized expense sent to the callable function', async () => {
    const ownership = {
      mode: 'single',
      shares: [{ memberId: 'member-a', percentage: 100 }],
    }

    await createExpense(
      'workspace-a',
      {
        categoryId: 'housing',
        subcategoryId: 'mortgage_rent',
        itemName: 'Main home',
        notes: '',
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

  it('canonicalizes expense updates before sending them to the callable function', async () => {
    const ownership = {
      mode: 'single',
      shares: [{ memberId: 'member-a', percentage: 100 }],
    }

    await updateExpense(
      'workspace-a',
      'expense-a',
      {
        categoryId: 'housing',
        subcategoryId: 'mortgage_rent',
        itemName: '  Home  ',
        notes: '  Primary residence  ',
        estimate: { amount: '950.126', frequency: 'monthly' },
        variability: 'fixed',
        recurrence: 'recurring',
        necessity: 'essential',
        ownership,
      },
      ['member-a'],
    )

    expect(updateFinancialModelItem).toHaveBeenCalledWith(
      'workspace-a',
      'expenses',
      'expense-a',
      expect.objectContaining({
        itemName: 'Home',
        notes: 'Primary residence',
        estimate: { amount: 950.13, frequency: 'monthly' },
        monthlyAmounts: expect.objectContaining({ january: 950.13, december: 950.13 }),
        ownership,
      }),
    )
  })
})
