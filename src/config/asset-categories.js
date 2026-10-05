export const assetCategories = [
  {
    id: 'real_estate',
    icon: 'home',
    nameKey: 'assets.categories.real_estate.name',
    descriptionKey: 'assets.categories.real_estate.description',
    itemNameKey: 'assets.categories.real_estate.itemName',
    addLabelKey: 'assets.categories.real_estate.addLabel',
    subtypes: ['primary_home', 'rental_property', 'land', 'real_estate_other'],
  },
  {
    id: 'investment',
    icon: 'show_chart',
    nameKey: 'assets.categories.investment.name',
    descriptionKey: 'assets.categories.investment.description',
    itemNameKey: 'assets.categories.investment.itemName',
    addLabelKey: 'assets.categories.investment.addLabel',
    subtypes: ['brokerage', 'pension', 'bonds', 'crypto', 'precious_metals', 'investment_other'],
  },
  {
    id: 'cash',
    icon: 'account_balance',
    nameKey: 'assets.categories.cash.name',
    descriptionKey: 'assets.categories.cash.description',
    itemNameKey: 'assets.categories.cash.itemName',
    addLabelKey: 'assets.categories.cash.addLabel',
    subtypes: [
      'current_account',
      'savings_account',
      'joint_account',
      'emergency_fund',
      'cash_other',
    ],
  },
  {
    id: 'business',
    icon: 'business_center',
    nameKey: 'assets.categories.business.name',
    descriptionKey: 'assets.categories.business.description',
    itemNameKey: 'assets.categories.business.itemName',
    addLabelKey: 'assets.categories.business.addLabel',
    subtypes: ['private_business', 'business_other'],
  },
  {
    id: 'vehicle_valuable',
    icon: 'directions_car',
    nameKey: 'assets.categories.vehicle_valuable.name',
    descriptionKey: 'assets.categories.vehicle_valuable.description',
    itemNameKey: 'assets.categories.vehicle_valuable.itemName',
    addLabelKey: 'assets.categories.vehicle_valuable.addLabel',
    subtypes: ['vehicle', 'collectible', 'valuable_property', 'vehicle_valuable_other'],
  },
  {
    id: 'other',
    icon: 'category',
    nameKey: 'assets.categories.other.name',
    descriptionKey: 'assets.categories.other.description',
    itemNameKey: 'assets.categories.other.itemName',
    addLabelKey: 'assets.categories.other.addLabel',
    subtypes: ['other'],
  },
]

export const assetCategoryIds = assetCategories.map((category) => category.id)

export function getAssetCategory(categoryId) {
  return assetCategories.find((category) => category.id === categoryId) || null
}
