import { currentFinancialMonth, financialYearMonthCategoryValue } from './financial-year'
import { buildFrenchAmortizationSchedule } from './mortgage-amortization'
import { annualRealEstateValue } from './real-estate-valuation'
import { effectiveGrowthFactor, effectiveMonthlyRate } from './rates'
import { investmentTypeDefinitions, normalizeStrategyForOptions } from './what-if'

const INVESTMENT_ASSET_TYPES = Object.freeze({
  brokerage: 'stockMarket',
  pension: 'stockMarket',
  bonds: 'fixedIncome',
  crypto: 'crypto',
  precious_metals: 'other',
  investment_other: 'other',
})

const REAL_ESTATE_ASSET_TYPES = Object.freeze({
  rental_property: 'realEstate',
  land: 'realEstate',
  real_estate_other: 'realEstate',
})

const BUSINESS_ASSET_TYPES = Object.freeze({
  private_business: 'businessEquity',
  business_other: 'businessEquity',
})

const FREEDOM_INVESTMENT_TYPES = Object.freeze([
  'stockMarket',
  'realEstate',
  'fixedIncome',
  'crypto',
  'other',
])

export function latestPositionMonth(financialYear, preferredMonth = currentFinancialMonth()) {
  const months = financialYear?.months || {}
  if (months[preferredMonth]) return preferredMonth
  const available = Object.keys(months)
    .filter((month) => /^\d{2}$/.test(month) && Number(month) <= Number(preferredMonth))
    .sort()
  return available.at(-1) || Object.keys(months).sort().at(-1) || preferredMonth
}

export function strategyStartingPosition(
  financialYear,
  month = latestPositionMonth(financialYear),
  memberId = 'all',
) {
  const investmentBalances = {
    stockMarket: 0,
    realEstate: 0,
    fixedIncome: 0,
    crypto: 0,
    businessEquity: 0,
    other: 0,
  }
  addMappedCategory(
    financialYear,
    month,
    'investment',
    INVESTMENT_ASSET_TYPES,
    investmentBalances,
    memberId,
  )
  addMappedCategory(
    financialYear,
    month,
    'real_estate',
    REAL_ESTATE_ASSET_TYPES,
    investmentBalances,
    memberId,
  )
  addMappedCategory(
    financialYear,
    month,
    'business',
    BUSINESS_ASSET_TYPES,
    investmentBalances,
    memberId,
  )
  return {
    month,
    cash: financialYearMonthCategoryValue(financialYear, month, 'assets', 'cash', memberId),
    investmentBalances,
    investmentTotal: money(
      Object.values(investmentBalances).reduce((sum, value) => sum + value, 0),
    ),
  }
}

export function simulateStrategy({
  startingPosition,
  scenario,
  simulatedMonthlySavings = 0,
  simulatedMonthlyCost = 0,
  debtAvailable = true,
} = {}) {
  const allocation = normalizeStrategyForOptions(scenario?.allocation, {
    cash: true,
    debt: debtAvailable,
  })
  const shared = {
    startingPosition,
    allocation,
    investmentMix: scenario?.investmentMix || {},
    cashAnnualReturnPercent: scenario?.cashAnnualReturnPercent || 0,
    inflationAnnualPercent: scenario?.inflationAnnualPercent ?? 2,
    horizonYears: scenario?.horizonYears || 20,
    cashTargetMonths: scenario?.cashTargetMonths || 12,
  }
  const strategy = projectPath({
    ...shared,
    monthlySavings: simulatedMonthlySavings,
    monthlyCost: simulatedMonthlyCost,
  })
  return {
    strategy,
    allocation,
  }
}

export function strategyNetWorthPoints({
  currentNetWorth = 0,
  currentAssets = null,
  currentLiabilities = 0,
  currentRealEstate = 0,
  strategy,
  monthlyDebtContribution = 0,
  selectedDebtId = null,
  realEstateAssets = [],
  mortgages = [],
  asOfDate = new Date(),
} = {}) {
  const startingValue = Number(strategy?.startingValue) || 0
  const monthlyDebt = Math.max(0, Number(monthlyDebtContribution) || 0)
  if (currentAssets == null) {
    return (strategy?.points || []).map((point) => {
      const assetChange = (Number(point.value) || 0) - startingValue
      return {
        month: Number(point.month || 0),
        value: money(Number(currentNetWorth || 0) + assetChange),
      }
    })
  }

  const points = strategy?.points || []
  const initialPoint = points[0] || {}
  const initialCash = Number(initialPoint.cash) || 0
  const initialInvestmentValue = Number(initialPoint.investmentValue) || 0
  const initialStrategyRealEstate = Number(initialPoint.investmentBalances?.realEstate) || 0
  const startingInvestments = initialInvestmentValue - initialStrategyRealEstate
  const frozenOtherAssets =
    Number(currentAssets || 0) - initialCash - startingInvestments - Number(currentRealEstate || 0)
  const mortgageSchedules = mortgages.map((mortgage) => ({
    ...mortgage,
    schedule: mortgageSchedule(
      mortgage,
      mortgage.id === selectedDebtId ? monthlyDebt : 0,
      asOfDate,
    ),
  }))
  return points.map((point) => {
    const month = Number(point.month || 0)
    const cash = Number(point.cash) || 0
    const strategyRealEstate = Number(point.investmentBalances?.realEstate) || 0
    const contributedRealEstate = Number(point.investmentContributionBalances?.realEstate) || 0
    const investments =
      (Number(point.investmentValue) || 0) - strategyRealEstate + contributedRealEstate
    const realEstate =
      Number(currentRealEstate || 0) +
      realEstateAssets.reduce(
        (sum, asset) => sum + projectedRealEstateChange(asset, month, asOfDate),
        0,
      )
    const modeledDebtReduction = mortgageSchedules.reduce(
      (sum, mortgage) => sum + mortgageReductionAtMonth(mortgage, month),
      0,
    )
    const liabilities = Math.max(0, Number(currentLiabilities || 0) - modeledDebtReduction)
    const otherAssets = frozenOtherAssets
    const value = cash + investments + realEstate + otherAssets - liabilities
    return {
      month,
      value: money(value),
      breakdown: {
        cash: money(cash),
        investments: money(investments),
        realEstate: money(realEstate),
        otherAssets: money(otherAssets),
        liabilities: money(-liabilities),
      },
    }
  })
}

export function projectPath({
  startingPosition = {},
  allocation = { cash: 0, invest: 100, debt: 0 },
  investmentMix = {},
  cashAnnualReturnPercent = 0,
  inflationAnnualPercent = 0,
  horizonYears = 20,
  cashTargetMonths = 12,
  monthlySavings = 0,
  monthlyCost = 0,
} = {}) {
  const months = Math.max(1, Math.round(Number(horizonYears) * 12))
  const savings = Math.max(0, Number(monthlySavings) || 0)
  const monthlyCashReturn = effectiveMonthlyRate(cashAnnualReturnPercent)
  const nominalMonthlyCost = Math.max(0, Number(monthlyCost) || 0)
  const initialCashTarget = money(nominalMonthlyCost * cashTargetMonths)
  let cash = Math.max(0, Number(startingPosition.cash) || 0)
  const balances = normalizedStartingBalances(startingPosition.investmentBalances)
  const investmentContributionBalances = normalizedStartingBalances()
  const startingValue = money(cash + Object.values(balances).reduce((sum, value) => sum + value, 0))
  let cashContributions = 0
  let cashGrowth = 0
  let investmentContributions = 0
  let debtContributions = 0
  let cashTargetMonth = initialCashTarget > 0 && cash >= initialCashTarget ? 0 : null
  const points = [
    projectionPoint(0, cash, balances, investmentContributionBalances, {
      inflationFactor: 1,
      monthlyCost: nominalMonthlyCost,
      cashTarget: initialCashTarget,
    }),
  ]
  const monthlyPoints = [...points]

  for (let month = 1; month <= months; month += 1) {
    const cashBeforeGrowth = cash
    cash *= 1 + monthlyCashReturn
    cashGrowth += cash - cashBeforeGrowth

    for (const [type, balance] of Object.entries(balances)) {
      const defaultReturn =
        investmentTypeDefinitions.find((definition) => definition.id === type)?.returnPercent || 0
      const annualReturn = Number(investmentMix[type]?.annualReturnPercent ?? defaultReturn)
      const monthlyReturn = effectiveMonthlyRate(annualReturn)
      balances[type] = balance * (1 + monthlyReturn)
      investmentContributionBalances[type] *= 1 + monthlyReturn
    }

    const cashContribution = (savings * allocation.cash) / 100
    const investmentContribution = (savings * allocation.invest) / 100
    const debtContribution = (savings * allocation.debt) / 100
    const inflationFactor = inflationFactorAtMonth(inflationAnnualPercent, month)
    const cashTarget = nominalMonthlyCost * inflationFactor * cashTargetMonths
    cash += cashContribution
    distributeInvestmentContribution(balances, investmentMix, investmentContribution)
    distributeInvestmentContribution(
      investmentContributionBalances,
      investmentMix,
      investmentContribution,
    )
    cashContributions += cashContribution
    investmentContributions += investmentContribution
    debtContributions += debtContribution

    if (cashTargetMonth == null && cashTarget > 0 && cash >= cashTarget) cashTargetMonth = month
    const point = projectionPoint(month, cash, balances, investmentContributionBalances, {
      inflationFactor,
      monthlyCost: nominalMonthlyCost,
      cashTarget,
    })
    monthlyPoints.push(point)
    if (month % 12 === 0 || month === months) points.push(point)
  }

  const investmentValue = money(Object.values(balances).reduce((sum, value) => sum + value, 0))
  const finalValue = money(cash + investmentValue)
  const assetContributions = money(cashContributions + investmentContributions)
  return {
    startingValue,
    finalValue,
    cash: money(cash),
    investmentValue,
    cashContributions: money(cashContributions),
    cashGrowth: money(cashGrowth),
    investmentContributions: money(investmentContributions),
    contributions: assetContributions,
    growth: money(finalValue - startingValue - assetContributions),
    debtContributions: money(debtContributions),
    annualDebtContribution: money((savings * allocation.debt * 12) / 100),
    initialCashTarget,
    cashTarget: money(
      nominalMonthlyCost *
        inflationFactorAtMonth(inflationAnnualPercent, months) *
        cashTargetMonths,
    ),
    cashTargetMonth,
    points,
    monthlyPoints,
    investmentBalances: Object.fromEntries(
      Object.entries(balances).map(([type, value]) => [type, money(value)]),
    ),
  }
}

function projectionPoint(
  month,
  cash,
  balances,
  investmentContributionBalances,
  { inflationFactor, monthlyCost, cashTarget },
) {
  const investmentValue = Object.values(balances).reduce((sum, value) => sum + value, 0)
  const investableValue = FREEDOM_INVESTMENT_TYPES.reduce(
    (sum, type) => sum + (balances[type] || 0),
    0,
  )
  return {
    month,
    value: money(cash + investmentValue),
    cash: money(cash),
    investmentValue: money(investmentValue),
    investmentBalances: Object.fromEntries(
      Object.entries(balances).map(([type, value]) => [type, money(value)]),
    ),
    investmentContributionBalances: Object.fromEntries(
      Object.entries(investmentContributionBalances).map(([type, value]) => [type, money(value)]),
    ),
    investableValue: money(investableValue),
    inflationFactor: money(inflationFactor),
    monthlyCost: money(monthlyCost),
    annualCost: money(monthlyCost * 12),
    inflationAdjustedMonthlyCost: money(monthlyCost * inflationFactor),
    inflationAdjustedAnnualCost: money(monthlyCost * 12 * inflationFactor),
    cashTarget: money(cashTarget),
    realValue: presentValue(cash + investmentValue, inflationFactor),
    realCash: presentValue(cash, inflationFactor),
    realInvestmentValue: presentValue(investmentValue, inflationFactor),
    realInvestableValue: presentValue(investableValue, inflationFactor),
  }
}

function projectedRealEstateChange(asset, month, asOfDate) {
  const currentValue = Math.max(0, Number(asset?.currentValue) || 0)
  const model = asset?.model || {}
  if (!month) return 0
  try {
    const projectedValue =
      model.schemaVersion === 2
        ? annualRealEstateValue(model, addMonths(asOfDate, month))
        : currentValue * Math.pow(1 + (Number(model.annualAppreciationRate) || 0) / 100, month / 12)
    const modeledCurrentValue =
      model.schemaVersion === 2 ? annualRealEstateValue(model, asOfDate) : currentValue
    return projectedValue - modeledCurrentValue
  } catch {
    return 0
  }
}

function mortgageSchedule(mortgage, extraMonthlyPayment, asOfDate) {
  try {
    return buildFrenchAmortizationSchedule({
      currentBalance: mortgage.currentBalance,
      annualInterestRate: mortgage.annualInterestRate,
      monthlyPayment: mortgage.monthlyPayment,
      extraMonthlyPayment,
      asOfDate,
      startDate: mortgage.startDate,
    })
  } catch {
    return []
  }
}

function mortgageReductionAtMonth(mortgage, month) {
  const currentBalance = Math.max(0, Number(mortgage.currentBalance) || 0)
  if (!month || !mortgage.schedule.length) return 0
  const payment = mortgage.schedule[Math.min(month, mortgage.schedule.length) - 1]
  const remainingBalance = month >= mortgage.schedule.length ? 0 : payment.remainingBalance
  return Math.max(0, currentBalance - remainingBalance)
}

function addMonths(value, months) {
  const date = value instanceof Date ? new Date(value) : new Date(`${value}T00:00:00`)
  const day = date.getDate()
  date.setDate(1)
  date.setMonth(date.getMonth() + months)
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  date.setDate(Math.min(day, lastDay))
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`
}

export function inflationFactorAtMonth(annualPercent = 0, month = 0) {
  return effectiveGrowthFactor(annualPercent, month)
}

export function presentValue(value, inflationFactor = 1) {
  const factor = Math.max(1, Number(inflationFactor) || 1)
  return money((Number(value) || 0) / factor)
}

export function inflationAdjustedCoverage({
  projectedValue = 0,
  currentPeriodCost = 0,
  annualInflationPercent = 0,
  month = 0,
} = {}) {
  const cost = Math.max(0, Number(currentPeriodCost) || 0)
  if (!(cost > 0)) return 0
  const realValue = presentValue(
    projectedValue,
    inflationFactorAtMonth(annualInflationPercent, month),
  )
  return money(realValue / cost)
}

function addMappedCategory(financialYear, month, categoryId, mapping, target, memberId) {
  const subcategories =
    financialYear?.months?.[month]?.assets?.categories?.[categoryId]?.subcategories || {}
  for (const [subcategoryId, subcategory] of Object.entries(subcategories)) {
    const type = mapping[subcategoryId]
    if (type) {
      const value =
        memberId && memberId !== 'all' ? subcategory?.memberValues?.[memberId] : subcategory?.total
      target[type] += Number(value) || 0
    }
  }
}

function normalizedStartingBalances(input = {}) {
  return Object.fromEntries(
    ['stockMarket', 'realEstate', 'fixedIncome', 'crypto', 'businessEquity', 'other'].map(
      (type) => [type, Math.max(0, Number(input?.[type]) || 0)],
    ),
  )
}

function distributeInvestmentContribution(balances, mix, amount) {
  const entries = Object.entries(mix).filter(([, value]) => Number(value?.allocation) > 0)
  const targetEntries = entries.length
    ? entries
    : [['stockMarket', { allocation: 100, annualReturnPercent: 7 }]]
  for (const [type, value] of targetEntries) {
    balances[type] = (balances[type] || 0) + (amount * Number(value.allocation)) / 100
  }
}

function money(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.round((number + Number.EPSILON) * 100) / 100 : 0
}
