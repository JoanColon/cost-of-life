import { normalizeMoney } from './money'

export const FINANCIAL_YEAR_TIME_ZONE = 'Europe/Madrid'

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
  if (!memberId || memberId === 'all') return money(financialYear.totals?.[section])
  if (section === 'savings') return money(financialYear.totals?.memberSavings?.[memberId])
  if (section === 'netWorth') return money(financialYear.totals?.memberNetWorth?.[memberId])
  return money(financialYear.totals?.[`${section}MemberValues`]?.[memberId])
}

export function financialYearMonthValue(financialYear, month, section, memberId = 'all') {
  const value = financialYear?.months?.[month]
  if (!value) return 0
  if (!memberId || memberId === 'all') {
    if (section === 'netWorth' || section === 'savings') return money(value[section])
    return money(value[section]?.total)
  }
  if (section === 'netWorth') return money(value.memberNetWorth?.[memberId])
  if (section === 'savings') return money(value.memberSavings?.[memberId])
  return money(value[section]?.memberValues?.[memberId])
}

export function financialYearCategoryValue(financialYear, section, categoryId, memberId = 'all') {
  const category = financialYear?.totals?.[`${section}Categories`]?.[categoryId]
  return memberId === 'all' ? money(category?.total) : money(category?.memberValues?.[memberId])
}

export function financialYearMonthCategoryValue(
  financialYear,
  month,
  section,
  categoryId,
  memberId = 'all',
) {
  const category = financialYear?.months?.[month]?.[section]?.categories?.[categoryId]
  return memberId === 'all' ? money(category?.total) : money(category?.memberValues?.[memberId])
}

export function financialYearCategoryItemCount(financialYear, section, categoryId, month = null) {
  const category = month
    ? financialYear?.months?.[month]?.[section]?.categories?.[categoryId]
    : financialYear?.totals?.[`${section}Categories`]?.[categoryId]
  return Object.keys(category?.subcategories || {}).filter((id) => id !== categoryId).length
}

export function financialYearCategoryMemberIds(financialYear, section, categoryId, month = null) {
  const category = month
    ? financialYear?.months?.[month]?.[section]?.categories?.[categoryId]
    : financialYear?.totals?.[`${section}Categories`]?.[categoryId]
  return Object.keys(category?.memberValues || {}).filter(
    (memberId) => Number(category.memberValues[memberId]) !== 0,
  )
}

export function financialYearSubcategoryValue(
  financialYear,
  section,
  categoryId,
  subcategoryId,
  memberId = 'all',
) {
  const item =
    financialYear?.totals?.[`${section}Categories`]?.[categoryId]?.subcategories?.[subcategoryId]
  const total = section === 'expenses' ? item?.effective : item?.total
  return memberId === 'all' ? money(total) : money(item?.memberValues?.[memberId])
}

function money(value) {
  return normalizeMoney(value) || 0
}
