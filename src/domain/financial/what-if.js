import { normalizeDisposablePercentage } from './income-calculations'
import { milestoneDefinitions } from '@/domain/milestones/definitions'

export const emergencyFundMonths = Object.freeze(
  milestoneDefinitions
    .filter(({ family }) => family === 'safety')
    .map(({ target }) => target)
    .sort((left, right) => left - right),
)
export const investmentHorizons = Object.freeze([10, 20, 30])

export const defaultWhatIfConfig = Object.freeze({
  discretionaryReductionPercent: 0,
  expectedAnnualReturnPercent: 7,
  selectedLiabilityId: null,
  strategy: Object.freeze({ cash: 20, invest: 60, debt: 20 }),
})

export function normalizeWhatIfConfig(config = {}) {
  const reduction = normalizeDisposablePercentage(config.discretionaryReductionPercent, 0)
  const annualReturn = normalizeReturn(config.expectedAnnualReturnPercent)
  const strategy = normalizeStrategy(config.strategy)
  return {
    discretionaryReductionPercent: reduction ?? 0,
    expectedAnnualReturnPercent: annualReturn ?? 7,
    selectedLiabilityId:
      typeof config.selectedLiabilityId === 'string' && config.selectedLiabilityId
        ? config.selectedLiabilityId
        : null,
    strategy: strategy || { ...defaultWhatIfConfig.strategy },
  }
}

export function calculateWhatIf({
  availableIncome = 0,
  costOfLife = 0,
  discretionary = 0,
  reductionPercent = 0,
} = {}) {
  const reduction = normalizeDisposablePercentage(reductionPercent, 0) ?? 0
  const monthlyAvailableIncome = money(availableIncome / 12)
  const monthlyCostOfLife = money(costOfLife / 12)
  const monthlyDiscretionary = money(discretionary / 12)
  const currentSavingsCapacity = money(monthlyAvailableIncome - monthlyCostOfLife)
  const extraSavings = money((monthlyDiscretionary * reduction) / 100)
  const simulatedSavingsCapacity = money(currentSavingsCapacity + extraSavings)
  return {
    monthlyAvailableIncome,
    monthlyCostOfLife,
    monthlyDiscretionary,
    currentSavingsCapacity,
    extraSavings,
    simulatedCostOfLife: money(monthlyCostOfLife - extraSavings),
    simulatedSavingsCapacity,
    breakEvenReductionPercent: breakEvenReduction(currentSavingsCapacity, monthlyDiscretionary),
  }
}

export function calculateCashScenario({
  cash = 0,
  currentMonthlyCost = 0,
  simulatedMonthlyCost = 0,
  currentMonthlySavings = 0,
  simulatedMonthlySavings = 0,
} = {}) {
  if (!(currentMonthlyCost > 0) || cash >= currentMonthlyCost * 12) return null
  const targetMonths =
    emergencyFundMonths.find((months) => cash < currentMonthlyCost * months) || 12
  const currentTarget = money(currentMonthlyCost * targetMonths)
  const simulatedTarget = money(simulatedMonthlyCost * targetMonths)
  const currentMonths = monthsToTarget(cash, currentTarget, currentMonthlySavings)
  const simulatedMonths = monthsToTarget(cash, simulatedTarget, simulatedMonthlySavings)
  return {
    targetMonths,
    currentTarget,
    simulatedTarget,
    currentMonths,
    simulatedMonths,
    monthsSooner:
      currentMonths == null || simulatedMonths == null
        ? null
        : Math.max(0, currentMonths - simulatedMonths),
  }
}

export function calculateInvestmentScenario({
  monthlyContribution = 0,
  currentMonthlyContribution = 0,
  annualReturnPercent = 7,
} = {}) {
  const rate = normalizeReturn(annualReturnPercent) ?? 7
  return investmentHorizons.map((years) => {
    const projectedValue = futureValueOfMonthlyContributions(monthlyContribution, rate, years)
    const currentPathValue = futureValueOfMonthlyContributions(
      Math.max(0, currentMonthlyContribution),
      rate,
      years,
    )
    return {
      years,
      projectedValue,
      currentPathValue,
      difference: money(projectedValue - currentPathValue),
    }
  })
}

export function futureValueOfMonthlyContributions(monthlyContribution, annualReturnPercent, years) {
  const contribution = Math.max(0, Number(monthlyContribution) || 0)
  const months = Math.max(0, Math.round(Number(years) * 12))
  const monthlyRate = (Number(annualReturnPercent) || 0) / 100 / 12
  if (!months || !contribution) return 0
  if (!monthlyRate) return money(contribution * months)
  return money(contribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate))
}

export function calculateDebtScenario(monthlyAmount = 0) {
  const monthly = money(Math.max(0, Number(monthlyAmount) || 0))
  return { monthly, annual: money(monthly * 12) }
}

export function normalizeStrategyForOptions(strategy, { cash = true, debt = true } = {}) {
  const normalized = normalizeStrategy(strategy) || { ...defaultWhatIfConfig.strategy }
  const result = {
    cash: cash ? normalized.cash : 0,
    invest: normalized.invest,
    debt: debt ? normalized.debt : 0,
  }
  const unavailable = 100 - result.cash - result.invest - result.debt
  result.invest = money(result.invest + unavailable)
  return result
}

export function normalizeStrategy(strategy) {
  if (!strategy || typeof strategy !== 'object') return null
  const values = ['cash', 'invest', 'debt'].map((key) => Number(strategy[key]))
  if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) return null
  if (Math.abs(values.reduce((sum, value) => sum + value, 0) - 100) >= 0.001) return null
  return { cash: money(values[0]), invest: money(values[1]), debt: money(values[2]) }
}

function breakEvenReduction(currentSavings, discretionary) {
  if (currentSavings >= 0) return 0
  if (!(discretionary > 0)) return null
  return Math.ceil(((-currentSavings / discretionary) * 100 + Number.EPSILON) * 10) / 10
}

function monthsToTarget(current, target, monthlyContribution) {
  if (current >= target) return 0
  if (!(monthlyContribution > 0)) return null
  return Math.ceil((target - current) / monthlyContribution)
}

function normalizeReturn(value) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : null
}

function money(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.round((number + Number.EPSILON) * 100) / 100 : 0
}
