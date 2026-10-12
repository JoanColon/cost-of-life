import { addItemToCategory, buildSummaryCategories } from './category-summary'
import { annualMonthlyExpenseValue } from './expense-calculations'
import { allocateValueByOwnership } from './ownership'

export function buildExpenseSummaryCategories(
  categoryIds,
  selectedCategoryIds,
  existingCategories,
  memberIds,
) {
  const categories = buildSummaryCategories(
    categoryIds,
    selectedCategoryIds,
    existingCategories,
    memberIds,
  )

  return Object.fromEntries(
    Object.entries(categories).map(([categoryId, category]) => [
      categoryId,
      {
        ...category,
        manualEstimate: category.manualEstimate || { amount: 0, frequency: 'monthly' },
        necessity: category.necessity ?? null,
      },
    ]),
  )
}

export function rebuildExpenseCategorySummary(category, expenses) {
  if (!expenses.length) {
    return {
      ...category,
      itemCount: 0,
      itemizedValue: 0,
      memberValues: allocateValueByOwnership(category.manualValue, category.ownership),
    }
  }

  return expenses.reduce(
    (current, expense) =>
      addItemToCategory(
        current,
        annualMonthlyExpenseValue(expense.monthlyAmounts, expense.estimate),
        expense.ownership,
      ),
    { ...category, itemCount: 0, itemizedValue: 0, memberValues: {} },
  )
}
