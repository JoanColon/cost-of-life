const suggestion = (id, frequency, variability, recurrence, necessity) => ({
  id,
  nameKey: `expenses.suggestions.${id}`,
  defaults: { frequency, variability, recurrence, necessity },
})

export const expenseCategories = [
  {
    id: 'housing',
    icon: 'home',
    suggestions: [
      suggestion('mortgage_rent', 'monthly', 'fixed', 'recurring', 'essential'),
      suggestion('property_taxes', 'yearly', 'fixed', 'recurring', 'essential'),
      suggestion('home_insurance', 'yearly', 'fixed', 'recurring', 'essential'),
      suggestion('home_repairs', 'yearly', 'variable', 'occasional', 'essential'),
      suggestion('community_fees', 'monthly', 'fixed', 'recurring', 'essential'),
      suggestion('home_services', 'monthly', 'variable', 'recurring', null),
      suggestion('cleaning', 'monthly', 'variable', 'recurring', null),
    ],
  },
  {
    id: 'transportation',
    icon: 'directions_car',
    suggestions: [
      suggestion('vehicle_payment', 'monthly', 'fixed', 'recurring', 'essential'),
      suggestion('vehicle_insurance', 'yearly', 'fixed', 'recurring', 'essential'),
      suggestion('fuel_charging', 'monthly', 'variable', 'recurring', 'essential'),
      suggestion('vehicle_maintenance', 'yearly', 'variable', 'occasional', 'essential'),
      suggestion('parking', 'monthly', 'variable', 'recurring', null),
      suggestion('vehicle_taxes', 'yearly', 'fixed', 'recurring', 'essential'),
      suggestion('public_transport', 'monthly', 'variable', 'recurring', 'essential'),
      suggestion('taxi_ride_sharing', 'monthly', 'variable', 'recurring', null),
    ],
  },
  {
    id: 'food',
    icon: 'restaurant',
    suggestions: [
      suggestion('groceries', 'monthly', 'variable', 'recurring', 'essential'),
      suggestion('restaurants_takeaway', 'monthly', 'variable', 'recurring', 'lifestyle'),
      suggestion('coffee_snacks', 'monthly', 'variable', 'recurring', 'lifestyle'),
    ],
  },
  {
    id: 'utilities',
    icon: 'bolt',
    suggestions: [
      suggestion('electricity', 'monthly', 'variable', 'recurring', 'essential'),
      suggestion('water', 'every_two_months', 'variable', 'recurring', 'essential'),
      suggestion('gas_heating', 'monthly', 'variable', 'recurring', 'essential'),
      suggestion('phone', 'monthly', 'fixed', 'recurring', null),
      suggestion('internet', 'monthly', 'fixed', 'recurring', null),
    ],
  },
  {
    id: 'healthcare',
    icon: 'health_and_safety',
    suggestions: [
      suggestion('health_insurance', 'monthly', 'fixed', 'recurring', 'essential'),
      suggestion('life_insurance', 'yearly', 'fixed', 'recurring', 'essential'),
      suggestion('medical_care', 'yearly', 'variable', 'occasional', 'essential'),
      suggestion('dental_vision', 'yearly', 'variable', 'occasional', 'essential'),
      suggestion('medication', 'monthly', 'variable', 'recurring', 'essential'),
      suggestion('medical_supplies', 'yearly', 'variable', 'occasional', 'essential'),
    ],
  },
  {
    id: 'debt',
    icon: 'credit_score',
    suggestions: [
      suggestion('personal_loan', 'monthly', 'fixed', 'recurring', 'essential'),
      suggestion('student_loan', 'monthly', 'fixed', 'recurring', 'essential'),
      suggestion('credit_card', 'monthly', 'variable', 'recurring', 'essential'),
      suggestion('other_debt', 'monthly', 'fixed', 'recurring', 'essential'),
    ],
  },
  {
    id: 'personal',
    icon: 'person',
    suggestions: [
      suggestion('clothes_shoes', 'yearly', 'variable', 'occasional', null),
      suggestion('personal_care', 'monthly', 'variable', 'recurring', null),
      suggestion('gym_fitness', 'monthly', 'fixed', 'recurring', 'lifestyle'),
      suggestion('gifts', 'yearly', 'variable', 'occasional', 'lifestyle'),
      suggestion('subscriptions', 'monthly', 'fixed', 'recurring', 'lifestyle'),
      suggestion('pets', 'monthly', 'variable', 'recurring', 'essential'),
    ],
  },
  {
    id: 'leisure',
    icon: 'movie',
    suggestions: [
      suggestion('streaming', 'monthly', 'fixed', 'recurring', 'lifestyle'),
      suggestion('hobbies', 'monthly', 'variable', 'recurring', 'lifestyle'),
      suggestion('events', 'yearly', 'variable', 'occasional', 'lifestyle'),
      suggestion('entertainment', 'monthly', 'variable', 'recurring', 'lifestyle'),
    ],
  },
  {
    id: 'travel',
    icon: 'flight',
    suggestions: [
      suggestion('holidays', 'yearly', 'variable', 'recurring', 'lifestyle'),
      suggestion('accommodation', 'yearly', 'variable', 'occasional', 'lifestyle'),
      suggestion('flights_transport', 'yearly', 'variable', 'occasional', 'lifestyle'),
    ],
  },
  {
    id: 'education_childcare',
    icon: 'school',
    suggestions: [
      suggestion('school_education', 'monthly', 'fixed', 'recurring', 'essential'),
      suggestion('daycare', 'monthly', 'fixed', 'recurring', 'essential'),
      suggestion('babysitter', 'monthly', 'variable', 'recurring', null),
      suggestion('kids_clothes', 'yearly', 'variable', 'occasional', 'essential'),
      suggestion('activities', 'monthly', 'variable', 'recurring', null),
    ],
  },
  {
    id: 'other',
    icon: 'category',
    suggestions: [suggestion('other', 'monthly', 'variable', 'recurring', null)],
  },
].map((category) => ({
  ...category,
  nameKey: `expenses.categories.${category.id}.name`,
  descriptionKey: `expenses.categories.${category.id}.description`,
}))

export const expenseCategoryIds = expenseCategories.map((category) => category.id)

export function getExpenseCategory(categoryId) {
  return expenseCategories.find((category) => category.id === categoryId) || null
}

export function getExpenseSubcategory(subcategoryId) {
  for (const category of expenseCategories) {
    const subcategory = category.suggestions.find(({ id }) => id === subcategoryId)
    if (subcategory) return { ...subcategory, categoryId: category.id }
  }
  return null
}
