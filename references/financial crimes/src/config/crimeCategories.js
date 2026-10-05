export const crimeCategories = [
  {
    id: 'coffee',
    label: 'Coffee',
    shortLabel: 'Coffee',
    emoji: '☕',
    crimeName: 'Aggravated Coffee Purchase',
    quickAmounts: [4, 5, 6],
  },
  {
    id: 'delivery',
    label: 'Delivery',
    shortLabel: 'Delivery',
    emoji: '🍔',
    crimeName: 'First Degree Delivery',
    quickAmounts: [15, 20, 25],
  },
  {
    id: 'restaurants',
    label: 'Restaurants',
    shortLabel: 'Dining',
    emoji: '🍽️',
    crimeName: 'Dining Misconduct',
    quickAmounts: [20, 30, 50],
  },
  {
    id: 'going-out',
    label: 'Going Out',
    shortLabel: 'Going Out',
    emoji: '🍺',
    crimeName: 'Felony Night Out',
    quickAmounts: [20, 40, 60],
  },
  {
    id: 'taxi',
    label: 'Taxi',
    shortLabel: 'Taxi',
    emoji: '🚕',
    crimeName: 'Premeditated Transportation Fraud',
    quickAmounts: [10, 15, 20],
  },
  {
    id: 'clothes',
    label: 'Clothes',
    shortLabel: 'Clothes',
    emoji: '👕',
    crimeName: 'Wardrobe Laundering',
    quickAmounts: [30, 50, 100],
  },
  {
    id: 'travel',
    label: 'Travel',
    shortLabel: 'Travel',
    emoji: '✈️',
    crimeName: 'First-Class Financial Misconduct',
    quickAmounts: [100, 250, 500],
  },
  {
    id: 'online-shopping',
    label: 'Online Shopping',
    shortLabel: 'Shopping',
    emoji: '📦',
    crimeName: 'Commerce Misconduct',
    quickAmounts: [20, 40, 75],
  },
  {
    id: 'tech',
    label: 'Tech',
    shortLabel: 'Tech',
    emoji: '💻',
    crimeName: 'Aggravated Gadget Acquisition',
    quickAmounts: [50, 100, 250],
  },
  {
    id: 'gaming',
    label: 'Gaming',
    shortLabel: 'Gaming',
    emoji: '🎮',
    crimeName: 'Digital Asset Misconduct',
    quickAmounts: [10, 20, 50],
  },
  {
    id: 'subscriptions',
    label: 'Subscriptions',
    shortLabel: 'Subs',
    emoji: '💳',
    crimeName: 'Subscription Negligence',
    quickAmounts: [5, 10, 20],
  },
  {
    id: 'impulse-purchase',
    label: 'Impulse Purchase',
    shortLabel: 'Impulse',
    emoji: '⚡',
    crimeName: 'Premeditated Spending',
    quickAmounts: [10, 25, 50],
  },
  {
    id: 'other',
    label: 'Other',
    shortLabel: 'Other',
    emoji: '💸',
    crimeName: 'Unclassified Financial Misconduct',
    quickAmounts: [10, 20, 50],
  },
]

export function getCategory(categoryId) {
  return crimeCategories.find((category) => category.id === categoryId) || crimeCategories.at(-1)
}

export const defaultCategoryIds = crimeCategories
  .filter((category) => category.id !== 'other')
  .map((category) => category.id)
