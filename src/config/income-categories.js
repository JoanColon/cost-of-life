export const incomeCategories = [
  {
    id: 'employment',
    icon: 'work',
    nameKey: 'income.categories.employment.name',
    descriptionKey: 'income.categories.employment.description',
    itemNameKey: 'income.categories.employment.itemName',
    itemNamePluralKey: 'income.categories.employment.itemNamePlural',
    addLabelKey: 'income.categories.employment.addLabel',
    subtypes: ['salary', 'bonus', 'side_job', 'other_employment'],
    calculationModes: ['annual_salary', 'monthly_schedule'],
  },
  {
    id: 'business',
    icon: 'business_center',
    nameKey: 'income.categories.business.name',
    descriptionKey: 'income.categories.business.description',
    itemNameKey: 'income.categories.business.itemName',
    itemNamePluralKey: 'income.categories.business.itemNamePlural',
    addLabelKey: 'income.categories.business.addLabel',
    subtypes: ['self_employment', 'business_income', 'freelance', 'other_business'],
    calculationModes: ['recurring', 'one_time'],
  },
  {
    id: 'rental',
    icon: 'apartment',
    nameKey: 'income.categories.rental.name',
    descriptionKey: 'income.categories.rental.description',
    itemNameKey: 'income.categories.rental.itemName',
    itemNamePluralKey: 'income.categories.rental.itemNamePlural',
    addLabelKey: 'income.categories.rental.addLabel',
    subtypes: ['residential_rent', 'commercial_rent', 'other_rental'],
    calculationModes: ['recurring', 'one_time'],
  },
  {
    id: 'investments',
    icon: 'trending_up',
    nameKey: 'income.categories.investments.name',
    descriptionKey: 'income.categories.investments.description',
    itemNameKey: 'income.categories.investments.itemName',
    itemNamePluralKey: 'income.categories.investments.itemNamePlural',
    addLabelKey: 'income.categories.investments.addLabel',
    subtypes: ['dividends', 'interest', 'bond_income', 'distributions', 'other_investment'],
    calculationModes: ['recurring', 'one_time'],
  },
  {
    id: 'pensions_benefits',
    icon: 'elderly',
    nameKey: 'income.categories.pensions_benefits.name',
    descriptionKey: 'income.categories.pensions_benefits.description',
    itemNameKey: 'income.categories.pensions_benefits.itemName',
    itemNamePluralKey: 'income.categories.pensions_benefits.itemNamePlural',
    addLabelKey: 'income.categories.pensions_benefits.addLabel',
    subtypes: ['pension', 'benefits', 'other_pension_benefit'],
    calculationModes: ['annual_salary', 'monthly_schedule', 'recurring'],
  },
  {
    id: 'other',
    icon: 'payments',
    nameKey: 'income.categories.other.name',
    descriptionKey: 'income.categories.other.description',
    itemNameKey: 'income.categories.other.itemName',
    itemNamePluralKey: 'income.categories.other.itemNamePlural',
    addLabelKey: 'income.categories.other.addLabel',
    subtypes: ['other'],
    calculationModes: ['recurring', 'one_time'],
  },
]

export const incomeCategoryIds = incomeCategories.map((category) => category.id)

export function getIncomeCategory(categoryId) {
  return incomeCategories.find((category) => category.id === categoryId) || null
}
