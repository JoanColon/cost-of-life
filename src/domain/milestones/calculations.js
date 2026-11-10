import {
  currentFinancialMonth,
  financialYearFlowValue,
  financialYearMonthCategoryValue,
  financialYearMonthValue,
} from '../../../functions/shared/positions/annual-projection.js'
import { positionHistoryDocuments } from '@/domain/financial/history'
import { investableWealthAt } from '@/domain/financial/investable-wealth'
import { moneyForOwnershipScope } from '../../../functions/shared/core/ownership.js'
import {
  calculateFundedYears,
  calculateSafetyCoverageMonths,
} from '../../../functions/shared/positions/metrics.js'
import {
  calculateDebtReductionProgress,
  calculatePositiveNetWorthProgress,
  calculateTargetProgress,
} from '../../../functions/shared/progress/metrics.js'
import { roundMoneyOrZero as money } from '../../../functions/shared/core/money.js'
import { milestoneDefinitions } from './definitions'

export function calculateMilestoneProgress({
  financialYear,
  financialHistory = [],
  achievements = [],
  liabilities = [],
  excludedLiabilityIds = new Set(),
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
  const currentYear = Number(financialYear?.year || financialYear?.id)
  const history = positionHistoryDocuments(
    withCurrentFinancialYear(financialHistory, financialYear, month),
    {
      throughPeriod: Number.isInteger(currentYear) ? `${currentYear}-${month}` : null,
    },
  )
  const annualCostOfLife = financialYearFlowValue(financialYear, 'expenses', memberId)
  const cash = financialYearMonthCategoryValue(financialYear, month, 'assets', 'cash', memberId)
  const freedomAssets = investableWealthAt(financialYear, month, {
    memberId,
    excludedLiabilityIds,
  })
  const netWorth = financialYearMonthValue(financialYear, month, 'netWorth', memberId)
  const safetyMonths = calculateSafetyCoverageMonths(cash, annualCostOfLife)
  const fundedYears = calculateFundedYears(freedomAssets, annualCostOfLife)

  return milestoneDefinitions.map((definition) => {
    const result = calculateDefinition(definition, {
      annualCostOfLife,
      financialYear,
      fundedYears,
      history,
      liabilities,
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
      achieved: result.reached && achievedIds.has(definition.id),
      pending: pendingById.has(definition.id),
      qualifiedAt: pendingById.get(definition.id)?.qualifiedAt || null,
      relevant: result.relevant,
    }
  })
}

function calculateDefinition(definition, context) {
  if (definition.family === 'safety') {
    return calculateTargetProgress(
      context.safetyMonths,
      definition.target,
      context.annualCostOfLife > 0,
    )
  }
  if (definition.family === 'freedom') {
    return calculateTargetProgress(
      context.fundedYears,
      definition.target,
      context.annualCostOfLife > 0,
    )
  }
  if (definition.family === 'netWorth') {
    return definition.positive
      ? calculatePositiveNetWorthProgress(context.netWorth)
      : calculateTargetProgress(context.netWorth, definition.target)
  }

  return calculateLiabilityProgress({
    categoryIds: definition.liabilityCategoryIds,
    financialYear: context.financialYear,
    history: context.history,
    liabilities: context.liabilities,
    memberId: context.memberId,
    month: context.month,
  })
}

export function calculateLiabilityProgress({
  categoryIds = [],
  financialYear,
  history = [],
  liabilities = [],
  memberId = 'all',
  month,
} = {}) {
  const currentBalances = liabilityBalancesById(financialYear, month, categoryIds, memberId)
  const historicalMaximums = historicalLiabilityMaximums(history, categoryIds, memberId)
  const modeledInitialValues = modeledLiabilityInitialValues(liabilities, categoryIds, memberId)
  const liabilityIds = new Set([
    ...currentBalances.keys(),
    ...historicalMaximums.keys(),
    ...modeledInitialValues.keys(),
  ])
  let currentValue = 0
  let startingValue = 0

  for (const id of liabilityIds) {
    const currentBalance = currentBalances.get(id) || 0
    const initialValue = modeledInitialValues.has(id)
      ? modeledInitialValues.get(id)
      : historicalMaximums.get(id) || currentBalance
    currentValue += currentBalance
    startingValue += Math.max(0, Number(initialValue) || 0)
  }

  const result = calculateDebtReductionProgress(currentValue, startingValue)
  return {
    ...result,
    currentValue: money(result.currentValue),
    startingValue: money(result.startingValue),
  }
}

function historicalLiabilityMaximums(financialHistory, categoryIds, memberId) {
  const maximums = new Map()
  for (const financialYear of financialHistory) {
    for (const month of Object.keys(financialYear?.months || {})) {
      for (const [id, balance] of liabilityBalancesById(
        financialYear,
        month,
        categoryIds,
        memberId,
      )) {
        maximums.set(id, Math.max(maximums.get(id) || 0, balance))
      }
    }
  }
  return maximums
}

function modeledLiabilityInitialValues(liabilities, categoryIds, memberId) {
  const allowedCategories = new Set(categoryIds)
  return new Map(
    liabilities
      .filter(({ id, categoryId }) => id && allowedCategories.has(categoryId))
      .map((liability) => {
        const originalPrincipal = Number(liability.detail?.mortgage?.originalPrincipal)
        if (!(originalPrincipal > 0)) return null
        return [
          liability.id,
          moneyForOwnershipScope(originalPrincipal, liability.ownership, memberId),
        ]
      })
      .filter(Boolean),
  )
}

function liabilityBalancesById(financialYear, month, categoryIds, memberId) {
  const balances = new Map()
  for (const categoryId of categoryIds) {
    const subcategories =
      financialYear?.months?.[month]?.liabilities?.categories?.[categoryId]?.subcategories || {}
    for (const [subcategoryId, subcategory] of Object.entries(subcategories)) {
      const items = Object.entries(subcategory?.items || {})
      if (items.length) {
        for (const [id, item] of items) balances.set(id, scopedPositionValue(item, memberId))
      } else {
        balances.set(`${categoryId}:${subcategoryId}`, scopedPositionValue(subcategory, memberId))
      }
    }
  }
  return balances
}

function scopedPositionValue(item, memberId) {
  return Math.max(0, Number(memberId !== 'all' ? item?.memberValues?.[memberId] : item?.total) || 0)
}

function withCurrentFinancialYear(financialHistory, financialYear, month) {
  if (!financialYear) return financialHistory.filter(Boolean)
  const year = Number(financialYear.year || financialYear.id)
  const existing = financialHistory.find(
    (candidate) => Number(candidate?.year || candidate?.id) === year,
  )
  return [
    ...financialHistory.filter((candidate) => Number(candidate?.year || candidate?.id) !== year),
    {
      id: String(year),
      year,
      months: {
        ...(existing?.months || {}),
        ...(financialYear.months?.[month] ? { [month]: financialYear.months[month] } : {}),
      },
    },
  ]
}
