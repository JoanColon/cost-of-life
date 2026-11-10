import { calculateAnnualSavingsCapacity, calculateNetWorth } from './metrics.js'
import { roundMoneyOrZero as moneyOrZero } from '../core/money.js'

export const FINANCIAL_YEAR_TIME_ZONE = 'Europe/Madrid'

const POSITION_SECTIONS = new Set(['assets', 'liabilities'])

/** Returns the calendar year in the configured financial time zone. */
export function currentFinancialYear(date = new Date(), timeZone = FINANCIAL_YEAR_TIME_ZONE) {
  return Number(
    new Intl.DateTimeFormat('en', {
      year: 'numeric',
      timeZone,
    }).format(date),
  )
}

/** Returns the two-digit calendar month in the configured financial time zone. */
export function currentFinancialMonth(date = new Date(), timeZone = FINANCIAL_YEAR_TIME_ZONE) {
  return new Intl.DateTimeFormat('en', {
    month: '2-digit',
    timeZone,
  }).format(date)
}

/** Returns YYYY-MM-DD in the configured financial time zone. */
export function currentFinancialDate(date = new Date(), timeZone = FINANCIAL_YEAR_TIME_ZONE) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone,
    })
      .formatToParts(date)
      .map(({ type, value }) => [type, value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}

/** Reads an annual position, flow, net-worth, or savings value from an annual projection. */
export function financialYearValue(financialYear, section, memberId = 'all') {
  if (!financialYear) return 0
  if (section === 'netWorth') {
    return calculateNetWorth(
      financialYearPositionValue(financialYear, '12', 'assets', memberId),
      financialYearPositionValue(financialYear, '12', 'liabilities', memberId),
    )
  }
  if (section === 'savings') {
    return calculateAnnualSavingsCapacity(
      financialYearAvailableIncomeValue(financialYear, memberId),
      financialYearFlowValue(financialYear, 'expenses', memberId),
    )
  }
  if (POSITION_SECTIONS.has(section)) {
    return financialYearPositionValue(financialYear, '12', section, memberId)
  }
  return financialYearFlowValue(financialYear, section, memberId)
}

/** Reads a position value for a specific month. */
export function financialYearPositionValue(financialYear, month, section, memberId = 'all') {
  if (!POSITION_SECTIONS.has(section) && section !== 'netWorth') return 0
  return financialYearMonthValue(financialYear, month, section, memberId)
}

/** Sums a flow section across all projected months. */
export function financialYearFlowValue(financialYear, section, memberId = 'all') {
  if (POSITION_SECTIONS.has(section) || section === 'netWorth') return 0
  return moneyOrZero(
    Object.keys(financialYear.months || {}).reduce(
      (sum, month) => sum + financialYearMonthValue(financialYear, month, section, memberId),
      0,
    ),
  )
}

/** Sums disposable income across all projected months. */
export function financialYearAvailableIncomeValue(financialYear, memberId = 'all') {
  return moneyOrZero(
    Object.values(financialYear?.months || {}).reduce(
      (annualTotal, month) => annualTotal + monthAvailableIncomeValue(month, memberId),
      0,
    ),
  )
}

/** Reads disposable income for one projected month. */
export function financialYearMonthAvailableIncomeValue(financialYear, month, memberId = 'all') {
  return moneyOrZero(monthAvailableIncomeValue(financialYear?.months?.[month], memberId))
}

/** Sums annual expenses carrying a specific necessity classification. */
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
                      item?.necessity === necessity ?
                        itemTotal + itemValue(item, 'expenses', memberId) :
                        itemTotal,
                    0,
                  )
                )
              }
              return subcategory?.necessity === necessity ?
                subcategoryTotal + itemValue(subcategory, 'expenses', memberId) :
                subcategoryTotal
            }, 0),
          0,
        ),
      0,
    ),
  )
}

/** Sums annual expenses that have no necessity classification. */
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
                      item?.necessity == null ?
                        itemTotal + itemValue(item, 'expenses', memberId) :
                        itemTotal,
                    0,
                  )
                )
              }
              return subcategory?.necessity == null ?
                subcategoryTotal + itemValue(subcategory, 'expenses', memberId) :
                subcategoryTotal
            }, 0),
          0,
        ),
      0,
    ),
  )
}

/** Reads a section total for one projected month. */
export function financialYearMonthValue(financialYear, month, section, memberId = 'all') {
  if (section === 'netWorth') {
    return calculateNetWorth(
      financialYearMonthValue(financialYear, month, 'assets', memberId),
      financialYearMonthValue(financialYear, month, 'liabilities', memberId),
    )
  }
  if (section === 'savings') {
    return calculateAnnualSavingsCapacity(
      financialYearMonthAvailableIncomeValue(financialYear, month, memberId),
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

/** Reads an annual category value, using year-end for positions and annual sums for flows. */
export function financialYearCategoryValue(financialYear, section, categoryId, memberId = 'all') {
  if (POSITION_SECTIONS.has(section)) {
    return financialYearMonthCategoryValue(financialYear, '12', section, categoryId, memberId)
  }
  return financialYearFlowCategoryValue(financialYear, section, categoryId, memberId)
}

/** Sums one flow category across all projected months. */
export function financialYearFlowCategoryValue(
  financialYear,
  section,
  categoryId,
  memberId = 'all',
) {
  if (POSITION_SECTIONS.has(section)) return 0
  return moneyOrZero(
    Object.keys(financialYear?.months || {}).reduce(
      (sum, month) =>
        sum + financialYearMonthCategoryValue(financialYear, month, section, categoryId, memberId),
      0,
    ),
  )
}

/** Reads one category total in a projected month. */
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

/** Reads one subcategory total in a projected month. */
export function financialYearMonthSubcategoryValue(
  financialYear,
  month,
  section,
  categoryId,
  subcategoryId,
  memberId = 'all',
) {
  const item =
    financialYear?.months?.[month]?.[section]?.categories?.[categoryId]?.subcategories?.[
      subcategoryId
    ]
  return itemValue(item, section, memberId)
}

/** Finds and sums one item ID across all categories in a projected month. */
export function financialYearMonthItemValue(
  financialYear,
  month,
  section,
  itemId,
  memberId = 'all',
) {
  return moneyOrZero(
    Object.values(financialYear?.months?.[month]?.[section]?.categories || {}).reduce(
      (categoryTotal, category) =>
        categoryTotal +
        Object.values(category?.subcategories || {}).reduce(
          (subcategoryTotal, subcategory) =>
            subcategoryTotal + itemValue(subcategory?.items?.[itemId], section, memberId),
          0,
        ),
      0,
    ),
  )
}

/** Counts modeled items in a category at a month or across the annual projection. */
export function financialYearCategoryItemCount(financialYear, section, categoryId, month = null) {
  const category = month ?
    financialYear?.months?.[month]?.[section]?.categories?.[categoryId] :
    annualCategory(financialYear, section, categoryId)
  return Object.values(category?.subcategories || {}).reduce(
    (count, subcategory) => count + Object.keys(subcategory?.items || {}).length,
    0,
  )
}

/** Lists members with non-zero values in a category. */
export function financialYearCategoryMemberIds(financialYear, section, categoryId, month = null) {
  const category = month ?
    financialYear?.months?.[month]?.[section]?.categories?.[categoryId] :
    annualCategory(financialYear, section, categoryId)
  const memberIds = new Set()
  for (const subcategory of Object.values(category?.subcategories || {})) {
    for (const [memberId, value] of Object.entries(subcategory.memberValues || {})) {
      if (Number(value) !== 0) memberIds.add(memberId)
    }
  }
  return [...memberIds]
}

/** Reads an annual subcategory value. */
export function financialYearSubcategoryValue(
  financialYear,
  section,
  categoryId,
  subcategoryId,
  memberId = 'all',
) {
  if (POSITION_SECTIONS.has(section)) {
    return financialYearMonthSubcategoryValue(
      financialYear,
      '12',
      section,
      categoryId,
      subcategoryId,
      memberId,
    )
  }
  return moneyOrZero(
    Object.values(financialYear?.months || {}).reduce((sum, month) => {
      const item = month?.[section]?.categories?.[categoryId]?.subcategories?.[subcategoryId]
      return sum + itemValue(item, section, memberId)
    }, 0),
  )
}

/** Resolves the effective value of a modeled or tracked expense item. */
export function financialYearExpenseItemValue(item, modelValue) {
  if (item?.source === 'tracked' || item?.source === 'combined') {
    return moneyOrZero(item.effective)
  }
  return modelValue === undefined ? moneyOrZero(item?.effective) : moneyOrZero(modelValue)
}

/** Sums one modeled expense item across all projected months. */
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

/** Sums one modeled income item across all projected months. */
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

function percentageOrDefault(value) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : 100
}
