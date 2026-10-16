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
    return money(
      financialYearValue(financialYear, 'assets', memberId) -
        financialYearValue(financialYear, 'liabilities', memberId),
    )
  }
  if (section === 'savings') {
    return money(
      financialYearValue(financialYear, 'income', memberId) -
        financialYearValue(financialYear, 'expenses', memberId),
    )
  }
  if (POSITION_SECTIONS.has(section)) {
    return financialYearMonthValue(financialYear, '12', section, memberId)
  }
  return money(
    Object.keys(financialYear.months || {}).reduce(
      (sum, month) => sum + financialYearMonthValue(financialYear, month, section, memberId),
      0,
    ),
  )
}

export function financialYearMonthValue(financialYear, month, section, memberId = 'all') {
  if (section === 'netWorth') {
    return money(
      financialYearMonthValue(financialYear, month, 'assets', memberId) -
        financialYearMonthValue(financialYear, month, 'liabilities', memberId),
    )
  }
  if (section === 'savings') {
    return money(
      financialYearMonthValue(financialYear, month, 'income', memberId) -
        financialYearMonthValue(financialYear, month, 'expenses', memberId),
    )
  }
  return money(
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
  return money(
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
  return Object.keys(category?.subcategories || {}).filter((id) => id !== categoryId).length
}

export function financialYearCategoryMemberIds(financialYear, section, categoryId, month = null) {
  const category = month
    ? financialYear?.months?.[month]?.[section]?.categories?.[categoryId]
    : annualCategory(financialYear, section, categoryId)
  const memberIds = new Set()
  for (const item of Object.values(category?.subcategories || {})) {
    for (const [memberId, value] of Object.entries(item.memberValues || {})) {
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
  return money(
    Object.values(financialYear?.months || {}).reduce((sum, month) => {
      const item = month?.[section]?.categories?.[categoryId]?.subcategories?.[subcategoryId]
      return sum + itemValue(item, section, memberId)
    }, 0),
  )
}

export function financialYearExpenseItemValue(item, modelValue) {
  if (item?.source === 'tracked') return money(item.effective)
  return modelValue === undefined ? money(item?.effective) : money(modelValue)
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
        target.memberValues[memberId] = money(
          (Number(target.memberValues[memberId]) || 0) + (Number(value) || 0),
        )
      }
    }
  }
  return { subcategories }
}

function categoryValue(category, section, memberId) {
  return money(
    Object.values(category?.subcategories || {}).reduce(
      (sum, item) => sum + itemValue(item, section, memberId),
      0,
    ),
  )
}

function itemValue(item, section, memberId) {
  if (!item) return 0
  if (memberId && memberId !== 'all') return money(item.memberValues?.[memberId])
  return section === 'expenses' ? financialYearExpenseItemValue(item) : money(item.total)
}

function money(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.round((number + Number.EPSILON) * 100) / 100 : 0
}
