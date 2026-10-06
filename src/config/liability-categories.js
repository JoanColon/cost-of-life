export const liabilityCategories = [
  {
    id: 'mortgage',
    icon: 'house_siding',
    nameKey: 'liabilities.categories.mortgage.name',
    descriptionKey: 'liabilities.categories.mortgage.description',
    itemNameKey: 'liabilities.categories.mortgage.itemName',
    itemNamePluralKey: 'liabilities.categories.mortgage.itemNamePlural',
    addLabelKey: 'liabilities.categories.mortgage.addLabel',
  },
  {
    id: 'car_loan',
    icon: 'directions_car',
    nameKey: 'liabilities.categories.car_loan.name',
    descriptionKey: 'liabilities.categories.car_loan.description',
    itemNameKey: 'liabilities.categories.car_loan.itemName',
    itemNamePluralKey: 'liabilities.categories.car_loan.itemNamePlural',
    addLabelKey: 'liabilities.categories.car_loan.addLabel',
  },
  {
    id: 'student_loan',
    icon: 'school',
    nameKey: 'liabilities.categories.student_loan.name',
    descriptionKey: 'liabilities.categories.student_loan.description',
    itemNameKey: 'liabilities.categories.student_loan.itemName',
    itemNamePluralKey: 'liabilities.categories.student_loan.itemNamePlural',
    addLabelKey: 'liabilities.categories.student_loan.addLabel',
  },
  {
    id: 'personal_loan',
    icon: 'request_quote',
    nameKey: 'liabilities.categories.personal_loan.name',
    descriptionKey: 'liabilities.categories.personal_loan.description',
    itemNameKey: 'liabilities.categories.personal_loan.itemName',
    itemNamePluralKey: 'liabilities.categories.personal_loan.itemNamePlural',
    addLabelKey: 'liabilities.categories.personal_loan.addLabel',
  },
  {
    id: 'credit_card_debt',
    icon: 'credit_card',
    nameKey: 'liabilities.categories.credit_card_debt.name',
    descriptionKey: 'liabilities.categories.credit_card_debt.description',
    itemNameKey: 'liabilities.categories.credit_card_debt.itemName',
    itemNamePluralKey: 'liabilities.categories.credit_card_debt.itemNamePlural',
    addLabelKey: 'liabilities.categories.credit_card_debt.addLabel',
  },
  {
    id: 'other_debt',
    icon: 'account_balance_wallet',
    nameKey: 'liabilities.categories.other_debt.name',
    descriptionKey: 'liabilities.categories.other_debt.description',
    itemNameKey: 'liabilities.categories.other_debt.itemName',
    itemNamePluralKey: 'liabilities.categories.other_debt.itemNamePlural',
    addLabelKey: 'liabilities.categories.other_debt.addLabel',
  },
]

export const liabilityCategoryIds = liabilityCategories.map((category) => category.id)

export function getLiabilityCategory(categoryId) {
  return liabilityCategories.find((category) => category.id === categoryId) || null
}
