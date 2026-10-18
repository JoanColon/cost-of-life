export const FINANCIAL_YEAR_TIME_ZONE = 'Europe/Madrid'

const POSITION_SECTIONS = new Set(['assets', 'liabilities'])

export function currentFinancialYear(date = new Date()) {
  return Number(
    new Intl.DateTimeFormat('en', {
      year: 'numeric',
      timeZone: FINANCIAL_YEAR_TIME_ZONE,
    }).format(date),
  )
}

export function currentFinancialMonth(date = new Date()) {
  return new Intl.DateTimeFormat('en', {
    month: '2-digit',
    timeZone: FINANCIAL_YEAR_TIME_ZONE,
  }).format(date)
}

export function financialYearValue(financialYear, section, memberId = 'all') {
  if (!financialYear) return 0
  if (section === 'netWorth') {
    return moneyOrZero(
      financialYearValue(financialYear, 'assets', memberId) -
        financialYearValue(financialYear, 'liabilities', memberId),
    )
  }
  if (section === 'savings') {
    return moneyOrZero(
      financialYearAvailableIncomeValue(financialYear, memberId) -
        financialYearValue(financialYear, 'expenses', memberId),
    )
  }
  if (POSITION_SECTIONS.has(section)) {
    return financialYearMonthValue(financialYear, '12', section, memberId)
  }
  return moneyOrZero(
    Object.keys(financialYear.months || {}).reduce(
      (sum, month) => sum + financialYearMonthValue(financialYear, month, section, memberId),
      0,
    ),
  )
}

export function financialYearAvailableIncomeValue(financialYear, memberId = 'all') {
  return moneyOrZero(
    Object.values(financialYear?.months || {}).reduce(
      (annualTotal, month) => annualTotal + monthAvailableIncomeValue(month, memberId),
      0,
    ),
  )
}

export function financialYearMonthAvailableIncomeValue(financialYear, month, memberId = 'all') {
  return moneyOrZero(monthAvailableIncomeValue(financialYear?.months?.[month], memberId))
}

export function financialYearExpenseNecessityValue(financialYear, necessity, memberId = 'all') {
  return moneyOrZero(
    Object.values(financialYear?.months || {}).reduce(
      (annualTotal, month) =>
        annualTotal +
        Object.values(month?.expenses?.categories || {}).reduce(
          (monthTotal, category) =>
            monthTotal +
            Object.values(category?.subcategories || {}).reduce((subcategoryTotal, subcategory) => {
              const items = Object.values(subcategory?.items || {})
              if (items.length) {
                return (
                  subcategoryTotal +
                  items.reduce(
                    (itemTotal, item) =>
                      item?.necessity === necessity
                        ? itemTotal + itemValue(item, 'expenses', memberId)
                        : itemTotal,
                    0,
                  )
                )
              }
              return subcategory?.necessity === necessity
                ? subcategoryTotal + itemValue(subcategory, 'expenses', memberId)
                : subcategoryTotal
            }, 0),
          0,
        ),
      0,
    ),
  )
}

export function financialYearUnclassifiedExpenseValue(financialYear, memberId = 'all') {
  return moneyOrZero(
    Object.values(financialYear?.months || {}).reduce(
      (annualTotal, month) =>
        annualTotal +
        Object.values(month?.expenses?.categories || {}).reduce(
          (monthTotal, category) =>
            monthTotal +
            Object.values(category?.subcategories || {}).reduce((subcategoryTotal, subcategory) => {
              const items = Object.values(subcategory?.items || {})
              if (items.length) {
                return (
                  subcategoryTotal +
                  items.reduce(
                    (itemTotal, item) =>
                      item?.necessity == null
                        ? itemTotal + itemValue(item, 'expenses', memberId)
                        : itemTotal,
                    0,
                  )
                )
              }
              return subcategory?.necessity == null
                ? subcategoryTotal + itemValue(subcategory, 'expenses', memberId)
                : subcategoryTotal
            }, 0),
          0,
        ),
      0,
    ),
  )
}

export function financialYearMonthValue(financialYear, month, section, memberId = 'all') {
  if (section === 'netWorth') {
    return moneyOrZero(
      financialYearMonthValue(financialYear, month, 'assets', memberId) -
        financialYearMonthValue(financialYear, month, 'liabilities', memberId),
    )
  }
  if (section === 'savings') {
    return moneyOrZero(
      financialYearMonthAvailableIncomeValue(financialYear, month, memberId) -
        financialYearMonthValue(financialYear, month, 'expenses', memberId),
    )
  }
  return moneyOrZero(
    Object.values(financialYear?.months?.[month]?.[section]?.categories || {}).reduce(
      (sum, category) => sum + categoryValue(category, section, memberId),
      0,
    ),
  )
}

export function financialYearCategoryValue(financialYear, section, categoryId, memberId = 'all') {
  if (POSITION_SECTIONS.has(section)) {
    return financialYearMonthCategoryValue(financialYear, '12', section, categoryId, memberId)
  }
  return moneyOrZero(
    Object.keys(financialYear?.months || {}).reduce(
      (sum, month) =>
        sum + financialYearMonthCategoryValue(financialYear, month, section, categoryId, memberId),
      0,
    ),
  )
}

export function financialYearMonthCategoryValue(
  financialYear,
  month,
  section,
  categoryId,
  memberId = 'all',
) {
  const category = financialYear?.months?.[month]?.[section]?.categories?.[categoryId]
  return categoryValue(category, section, memberId)
}

export function financialYearCategoryItemCount(financialYear, section, categoryId, month = null) {
  const category = month
    ? financialYear?.months?.[month]?.[section]?.categories?.[categoryId]
    : annualCategory(financialYear, section, categoryId)
  if (['expenses', 'income'].includes(section)) {
    return Object.values(category?.subcategories || {}).reduce(
      (count, subcategory) => count + Object.keys(subcategory?.items || {}).length,
      0,
    )
  }
  const ids = Object.keys(category?.subcategories || {})
  return ids.filter((id) => id !== categoryId).length
}

export function financialYearCategoryMemberIds(financialYear, section, categoryId, month = null) {
  const category = month
    ? financialYear?.months?.[month]?.[section]?.categories?.[categoryId]
    : annualCategory(financialYear, section, categoryId)
  const memberIds = new Set()
  for (const subcategory of Object.values(category?.subcategories || {})) {
    for (const [memberId, value] of Object.entries(subcategory.memberValues || {})) {
      if (Number(value) !== 0) memberIds.add(memberId)
    }
  }
  return [...memberIds]
}

export function financialYearSubcategoryValue(
  financialYear,
  section,
  categoryId,
  subcategoryId,
  memberId = 'all',
) {
  if (POSITION_SECTIONS.has(section)) {
    const item =
      financialYear?.months?.['12']?.[section]?.categories?.[categoryId]?.subcategories?.[
        subcategoryId
      ]
    return itemValue(item, section, memberId)
  }
  return moneyOrZero(
    Object.values(financialYear?.months || {}).reduce((sum, month) => {
      const item = month?.[section]?.categories?.[categoryId]?.subcategories?.[subcategoryId]
      return sum + itemValue(item, section, memberId)
    }, 0),
  )
}

export function financialYearExpenseItemValue(item, modelValue) {
  if (item?.source === 'tracked') return moneyOrZero(item.effective)
  return modelValue === undefined ? moneyOrZero(item?.effective) : moneyOrZero(modelValue)
}

export function financialYearExpenseModelItemValue(
  financialYear,
  categoryId,
  subcategoryId,
  itemId,
  memberId = 'all',
) {
  return moneyOrZero(
    Object.values(financialYear?.months || {}).reduce((sum, month) => {
      const item =
        month?.expenses?.categories?.[categoryId]?.subcategories?.[subcategoryId]?.items?.[itemId]
      return sum + itemValue(item, 'expenses', memberId)
    }, 0),
  )
}

export function financialYearIncomeModelItemValue(
  financialYear,
  categoryId,
  subcategoryId,
  itemId,
  memberId = 'all',
) {
  return moneyOrZero(
    Object.values(financialYear?.months || {}).reduce((sum, month) => {
      const item =
        month?.income?.categories?.[categoryId]?.subcategories?.[subcategoryId]?.items?.[itemId]
      return sum + itemValue(item, 'income', memberId)
    }, 0),
  )
}

function annualCategory(financialYear, section, categoryId) {
  if (POSITION_SECTIONS.has(section)) {
    return financialYear?.months?.['12']?.[section]?.categories?.[categoryId]
  }
  const subcategories = {}
  for (const month of Object.values(financialYear?.months || {})) {
    const category = month?.[section]?.categories?.[categoryId]
    for (const [id, item] of Object.entries(category?.subcategories || {})) {
      const target = (subcategories[id] ||= { memberValues: {} })
      for (const [memberId, value] of Object.entries(item.memberValues || {})) {
        target.memberValues[memberId] = moneyOrZero(
          (Number(target.memberValues[memberId]) || 0) + (Number(value) || 0),
        )
      }
    }
  }
  return { subcategories }
}

function categoryValue(category, section, memberId) {
  return moneyOrZero(
    Object.values(category?.subcategories || {}).reduce(
      (sum, item) => sum + itemValue(item, section, memberId),
      0,
    ),
  )
}

function itemValue(item, section, memberId) {
  if (!item) return 0
  if (memberId && memberId !== 'all') return moneyOrZero(item.memberValues?.[memberId])
  return section === 'expenses' ? financialYearExpenseItemValue(item) : moneyOrZero(item.total)
}

function monthAvailableIncomeValue(month, memberId) {
  return Object.values(month?.income?.categories || {}).reduce(
    (monthTotal, category) =>
      monthTotal +
      Object.values(category?.subcategories || {}).reduce((subcategoryTotal, subcategory) => {
        return (
          subcategoryTotal +
          Object.values(subcategory?.items || {}).reduce((itemTotal, item) => {
            const percentage = percentageOrDefault(item?.disposablePercentage)
            return itemTotal + (itemValue(item, 'income', memberId) * percentage) / 100
          }, 0)
        )
      }, 0),
    0,
  )
}

function moneyOrZero(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.round((number + Number.EPSILON) * 100) / 100 : 0
}

function percentageOrDefault(value) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : 100
}
