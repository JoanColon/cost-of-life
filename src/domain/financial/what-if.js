import { normalizeDisposablePercentage } from './income-calculations'
export const investmentHorizons = Object.freeze([10, 20, 30])

export const investmentTypeDefinitions = Object.freeze([
  { id: 'stockMarket', returnPercent: 7 },
  { id: 'realEstate', returnPercent: 5 },
  { id: 'fixedIncome', returnPercent: 3 },
  { id: 'crypto', returnPercent: 8 },
  { id: 'businessEquity', returnPercent: 6 },
  { id: 'other', returnPercent: 4 },
])

export const defaultStrategyScenario = Object.freeze({
  id: 'default',
  name: 'Balanced strategy',
  allocation: Object.freeze({ cash: 20, invest: 60, debt: 20 }),
  investmentMix: Object.freeze({
    stockMarket: Object.freeze({ allocation: 100, annualReturnPercent: 7 }),
  }),
  horizonYears: 20,
  cashTargetMonths: 12,
  selectedLiabilityId: null,
})

export const defaultWhatIfConfig = Object.freeze({
  discretionaryReductionPercent: 0,
  extraMonthlySavings: 0,
  activeScenarioId: defaultStrategyScenario.id,
  scenarios: Object.freeze([defaultStrategyScenario]),
})

export function normalizeWhatIfConfig(config = {}) {
  const reduction = normalizeDisposablePercentage(config.discretionaryReductionPercent, 0)
  const legacyScenario = {
    ...defaultStrategyScenario,
    allocation: normalizeStrategy(config.strategy) || defaultStrategyScenario.allocation,
    investmentMix: {
      stockMarket: {
        allocation: 100,
        annualReturnPercent: normalizeReturn(config.expectedAnnualReturnPercent) ?? 7,
      },
    },
    selectedLiabilityId:
      typeof config.selectedLiabilityId === 'string' ? config.selectedLiabilityId : null,
  }
  const sourceScenarios = Array.isArray(config.scenarios) ? config.scenarios : [legacyScenario]
  const scenarios = sourceScenarios.slice(0, 10).map(normalizeStrategyScenario).filter(Boolean)
  if (!scenarios.length) scenarios.push(normalizeStrategyScenario(defaultStrategyScenario))
  const activeScenarioId = scenarios.some(({ id }) => id === config.activeScenarioId)
    ? config.activeScenarioId
    : scenarios[0].id
  return {
    discretionaryReductionPercent: reduction ?? 0,
    extraMonthlySavings: normalizeMoneyInput(config.extraMonthlySavings),
    activeScenarioId,
    scenarios,
  }
}

export function normalizeStrategyScenario(scenario = {}) {
  if (!scenario || typeof scenario !== 'object') return null
  const id = String(scenario.id || '')
    .trim()
    .slice(0, 80)
  if (!id) return null
  const allocation = normalizeStrategy(scenario.allocation || scenario.strategy)
  const investmentMix = normalizeInvestmentMix(scenario.investmentMix)
  const horizon = Number(scenario.horizonYears)
  const cashTarget = Number(scenario.cashTargetMonths)
  return {
    id,
    name:
      String(scenario.name || 'Strategy')
        .trim()
        .slice(0, 80) || 'Strategy',
    allocation: allocation || { ...defaultStrategyScenario.allocation },
    investmentMix,
    horizonYears: Number.isFinite(horizon) ? Math.min(50, Math.max(1, Math.round(horizon))) : 20,
    cashTargetMonths: [3, 6, 12].includes(cashTarget) ? cashTarget : 12,
    selectedLiabilityId:
      typeof scenario.selectedLiabilityId === 'string' && scenario.selectedLiabilityId
        ? scenario.selectedLiabilityId
        : null,
  }
}

export function normalizeInvestmentMix(mix = {}) {
  const entries = investmentTypeDefinitions.map((definition) => {
    const input = mix?.[definition.id] || {}
    return [
      definition.id,
      {
        allocation: Number(input.allocation) || 0,
        annualReturnPercent: normalizeReturn(input.annualReturnPercent) ?? definition.returnPercent,
      },
    ]
  })
  const total = entries.reduce((sum, [, value]) => sum + value.allocation, 0)
  if (Math.abs(total - 100) >= 0.001 || entries.some(([, value]) => value.allocation < 0)) {
    return {
      stockMarket: { allocation: 100, annualReturnPercent: 7 },
    }
  }
  return Object.fromEntries(entries.filter(([, value]) => value.allocation > 0))
}

export function calculateWhatIf({
  availableIncome = 0,
  costOfLife = 0,
  discretionary = 0,
  reductionPercent = 0,
  extraMonthlySavings = 0,
} = {}) {
  const reduction = normalizeDisposablePercentage(reductionPercent, 0) ?? 0
  const monthlyAvailableIncome = money(availableIncome / 12)
  const monthlyCostOfLife = money(costOfLife / 12)
  const monthlyDiscretionary = money(discretionary / 12)
  const currentSavingsCapacity = money(monthlyAvailableIncome - monthlyCostOfLife)
  const spendingReductionSavings = money((monthlyDiscretionary * reduction) / 100)
  const directExtraSavings = normalizeMoneyInput(extraMonthlySavings)
  const extraSavings = money(spendingReductionSavings + directExtraSavings)
  const simulatedSavingsCapacity = money(currentSavingsCapacity + extraSavings)
  return {
    monthlyAvailableIncome,
    monthlyCostOfLife,
    monthlyDiscretionary,
    currentSavingsCapacity,
    spendingReductionSavings,
    directExtraSavings,
    extraSavings,
    simulatedCostOfLife: money(monthlyCostOfLife - spendingReductionSavings),
    simulatedSavingsCapacity,
    breakEvenReductionPercent: breakEvenReduction(
      money(currentSavingsCapacity + directExtraSavings),
      monthlyDiscretionary,
    ),
  }
}

export function calculateCashScenario({
  cash = 0,
  currentMonthlyCost = 0,
  simulatedMonthlyCost = 0,
  currentMonthlySavings = 0,
  simulatedMonthlySavings = 0,
} = {}) {
  if (!(currentMonthlyCost > 0)) return null
  const targetMonths = 12
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
    achieved: cash >= simulatedTarget,
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
  startingValue = 0,
} = {}) {
  const rate = normalizeReturn(annualReturnPercent) ?? 7
  return investmentHorizons.map((years) => {
    const startingValueAtHorizon = futureValueOfPrincipal(startingValue, rate, years)
    const projectedValue = money(
      startingValueAtHorizon + futureValueOfMonthlyContributions(monthlyContribution, rate, years),
    )
    const currentPathValue = money(
      startingValueAtHorizon +
        futureValueOfMonthlyContributions(Math.max(0, currentMonthlyContribution), rate, years),
    )
    return {
      years,
      projectedValue,
      currentPathValue,
      difference: calculateProjectionDelta(projectedValue, currentPathValue),
    }
  })
}

export function calculateSafetyImpact({
  cash = 0,
  currentMonthlyCost = 0,
  simulatedMonthlyCost = 0,
  currentMonthlySavings = 0,
  simulatedMonthlySavings = 0,
  horizonMonths = 12,
  targetMonths = 12,
} = {}) {
  const baselineCost = Math.max(0, Number(currentMonthlyCost) || 0)
  const scenarioCost = Math.max(0, Number(simulatedMonthlyCost) || 0)
  if (!(baselineCost > 0) || !(scenarioCost > 0)) return null
  const months = Math.max(0, Math.round(Number(horizonMonths) || 0))
  const startingCash = Math.max(0, Number(cash) || 0)
  const baselineCash = money(
    startingCash + Math.max(0, Number(currentMonthlySavings) || 0) * months,
  )
  const scenarioCash = money(
    startingCash + Math.max(0, Number(simulatedMonthlySavings) || 0) * months,
  )
  const baselineSafetyMonths = money(baselineCash / baselineCost)
  const scenarioSafetyMonths = money(scenarioCash / scenarioCost)
  return {
    horizonMonths: months,
    baselineSafetyMonths,
    scenarioSafetyMonths,
    additionalSafetyMonths: Math.max(
      0,
      calculateProjectionDelta(scenarioSafetyMonths, baselineSafetyMonths),
    ),
    alreadyFunded: startingCash / baselineCost >= targetMonths,
  }
}

export function calculateProjectionDelta(scenarioResult = 0, baselineResult = 0) {
  return money((Number(scenarioResult) || 0) - (Number(baselineResult) || 0))
}

export function futureValueOfMonthlyContributions(monthlyContribution, annualReturnPercent, years) {
  const contribution = Math.max(0, Number(monthlyContribution) || 0)
  const months = Math.max(0, Math.round(Number(years) * 12))
  const monthlyRate = (Number(annualReturnPercent) || 0) / 100 / 12
  if (!months || !contribution) return 0
  if (!monthlyRate) return money(contribution * months)
  return money(contribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate))
}

export function futureValueOfPrincipal(principal, annualReturnPercent, years) {
  const value = Math.max(0, Number(principal) || 0)
  const duration = Math.max(0, Number(years) || 0)
  const annualRate = (Number(annualReturnPercent) || 0) / 100
  return money(value * Math.pow(1 + annualRate, duration))
}

export function calculateDebtScenario(monthlyAmount = 0) {
  const monthly = money(Math.max(0, Number(monthlyAmount) || 0))
  return { monthly, annual: money(monthly * 12) }
}

export function normalizeStrategyForOptions(strategy, { cash = true, debt = true } = {}) {
  const normalized = normalizeStrategy(strategy) || { ...defaultStrategyScenario.allocation }
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

function normalizeMoneyInput(value) {
  const number = Number(value)
  return Number.isFinite(number) ? money(Math.min(100000, Math.max(0, number))) : 0
}

function money(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.round((number + Number.EPSILON) * 100) / 100 : 0
}
