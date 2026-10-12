import { expenseCategories, getExpenseCategory } from './expense-categories'

const trackingIcons = {
  groceries: 'shopping_cart',
  restaurants_takeaway: 'restaurant',
  fuel_charging: 'local_gas_station',
  public_transport: 'directions_bus',
  clothes_shoes: 'checkroom',
  entertainment: 'movie',
  gym_fitness: 'fitness_center',
  home_repairs: 'home_repair_service',
}

export const expenseTrackingCategories = expenseCategories.flatMap((category) =>
  category.suggestions.map(({ id }) => ({
    id,
    categoryId: category.id,
    icon: trackingIcons[id] || category.icon,
    nameKey: `expenses.suggestions.${id}`,
    quickAmounts: quickAmountsFor(id),
  })),
)

export const expenseTrackingCategoryIds = expenseTrackingCategories.map(({ id }) => id)

export const defaultExpenseTrackingCategoryIds = [
  'groceries',
  'restaurants_takeaway',
  'fuel_charging',
  'public_transport',
  'clothes_shoes',
  'entertainment',
  'home_repairs',
]

export function groupedExpenseTrackingCategories(subcategories = expenseTrackingCategories) {
  return subcategories.reduce((groups, subcategory) => {
    const category = getExpenseCategory(subcategory.categoryId)
    if (!category) return groups
    const group = groups.find(({ id }) => id === category.id)
    if (group) group.subcategories.push(subcategory)
    else groups.push({ ...category, subcategories: [subcategory] })
    return groups
  }, [])
}

function quickAmountsFor(id) {
  return (
    {
      groceries: [20, 50, 100],
      restaurants_takeaway: [10, 20, 40],
      fuel_charging: [20, 50, 80],
      public_transport: [2, 10, 25],
      clothes_shoes: [20, 50, 100],
      entertainment: [10, 25, 50],
      gym_fitness: [10, 30, 50],
      home_repairs: [25, 75, 150],
    }[id] || [10, 25, 50]
  )
}
