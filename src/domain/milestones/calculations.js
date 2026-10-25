import {
  currentFinancialMonth,
  financialYearMonthCategoryValue,
  financialYearMonthSubcategoryValue,
  financialYearMonthValue,
  financialYearValue,
} from '@/domain/financial/financial-year'
import {
  FREEDOM_REAL_ESTATE_SUBCATEGORY_IDS,
  INVESTABLE_ASSET_CATEGORY_IDS,
  milestoneDefinitions,
} from './definitions'

export function calculateMilestoneProgress({
  financialYear,
  financialHistory = [],
  achievements = [],
  month = currentFinancialMonth(),
  memberId = 'all',
} = {}) {
  const achievedIds = new Set(
    achievements
      .filter(({ status }) => !status || status === 'achieved')
      .map(({ milestoneId }) => milestoneId),
  )
  const pendingById = new Map(
    achievements
      .filter(({ status }) => status === 'pending')
      .map((achievement) => [achievement.milestoneId, achievement]),
  )
  const history = withCurrentFinancialYear(financialHistory, financialYear)
  const annualCostOfLife = financialYearValue(financialYear, 'expenses', memberId)
  const cash = financialYearMonthCategoryValue(financialYear, month, 'assets', 'cash', memberId)
  const freedomAssets =
    categoryTotal(financialYear, month, 'assets', INVESTABLE_ASSET_CATEGORY_IDS, memberId) +
    FREEDOM_REAL_ESTATE_SUBCATEGORY_IDS.reduce(
      (total, subcategoryId) =>
        total +
        financialYearMonthSubcategoryValue(
          financialYear,
          month,
          'assets',
          'real_estate',
          subcategoryId,
          memberId,
        ),
      0,
    )
  const netWorth = financialYearMonthValue(financialYear, month, 'netWorth', memberId)
  const safetyMonths = annualCostOfLife > 0 ? cash / (annualCostOfLife / 12) : 0
  const fundedYears = annualCostOfLife > 0 ? freedomAssets / annualCostOfLife : 0

  return milestoneDefinitions.map((definition) => {
    const result = calculateDefinition(definition, {
      annualCostOfLife,
      financialYear,
      fundedYears,
      history,
      memberId,
      month,
      netWorth,
      safetyMonths,
    })
    return {
      id: definition.id,
      family: definition.family,
      target: definition.target,
      currentValue: result.currentValue,
      progress: result.progress,
      reached: result.reached,
      previouslyAchieved: achievedIds.has(definition.id),
      pending: pendingById.has(definition.id),
      qualifiedAt: pendingById.get(definition.id)?.qualifiedAt || null,
      relevant: result.relevant,
    }
  })
}

function calculateDefinition(definition, context) {
  if (definition.family === 'safety') {
    return targetProgress(context.safetyMonths, definition.target, context.annualCostOfLife > 0)
  }
  if (definition.family === 'freedom') {
    return targetProgress(context.fundedYears, definition.target, context.annualCostOfLife > 0)
  }
  if (definition.family === 'netWorth') {
    const reached = definition.positive
      ? context.netWorth > 0
      : context.netWorth >= definition.target
    return {
      currentValue: context.netWorth,
      progress: definition.positive ? Number(reached) : ratio(context.netWorth, definition.target),
      reached,
      relevant: true,
    }
  }

  const currentValue = categoryTotal(
    context.financialYear,
    context.month,
    'liabilities',
    definition.liabilityCategoryIds,
    context.memberId,
  )
  const relevant = hasHistoricalDebt(
    context.history,
    definition.liabilityCategoryIds,
    context.memberId,
  )
  const reached = relevant && currentValue <= 0
  const startingValue = historicalDebtMaximum(
    context.history,
    definition.liabilityCategoryIds,
    context.memberId,
  )
  const progress =
    relevant && startingValue > 0 ? ratio(startingValue - currentValue, startingValue) : 0
  return { currentValue, progress, reached, relevant }
}

function targetProgress(currentValue, target, relevant) {
  const reached = relevant && currentValue >= target
  return {
    currentValue,
    progress: relevant ? ratio(currentValue, target) : 0,
    reached,
    relevant,
  }
}

function categoryTotal(financialYear, month, section, categoryIds, memberId = 'all') {
  return categoryIds.reduce(
    (total, categoryId) =>
      total + financialYearMonthCategoryValue(financialYear, month, section, categoryId, memberId),
    0,
  )
}

function hasHistoricalDebt(financialHistory, categoryIds, memberId) {
  return historicalDebtMaximum(financialHistory, categoryIds, memberId) > 0
}

function historicalDebtMaximum(financialHistory, categoryIds, memberId) {
  return financialHistory.reduce(
    (maximum, financialYear) =>
      Math.max(
        maximum,
        ...Object.keys(financialYear?.months || {}).map((month) =>
          categoryTotal(financialYear, month, 'liabilities', categoryIds, memberId),
        ),
      ),
    0,
  )
}

function withCurrentFinancialYear(financialHistory, financialYear) {
  if (!financialYear) return financialHistory.filter(Boolean)
  const year = Number(financialYear.year || financialYear.id)
  return [
    ...financialHistory.filter((candidate) => Number(candidate?.year || candidate?.id) !== year),
    financialYear,
  ]
}

function ratio(value, target) {
  if (!(target > 0)) return 0
  return Math.min(1, Math.max(0, Number(value || 0) / target))
}
