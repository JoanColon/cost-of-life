import { currentFinancialMonth, financialYearMonthCategoryValue } from './financial-year'
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
  strategy,
  monthlyDebtContribution = 0,
  debtBalance = 0,
} = {}) {
  const startingValue = Number(strategy?.startingValue) || 0
  const monthlyDebt = Math.max(0, Number(monthlyDebtContribution) || 0)
  const maximumDebtReduction = Math.max(0, Number(debtBalance) || 0)

  return (strategy?.points || []).map((point) => {
    const assetChange = (Number(point.value) || 0) - startingValue
    const debtReduction = Math.min(maximumDebtReduction, monthlyDebt * Number(point.month || 0))
    return {
      month: Number(point.month || 0),
      value: money(Number(currentNetWorth || 0) + assetChange + debtReduction),
    }
  })
}

export function projectPath({
  startingPosition = {},
  allocation = { cash: 0, invest: 100, debt: 0 },
  investmentMix = {},
  horizonYears = 20,
  cashTargetMonths = 12,
  monthlySavings = 0,
  monthlyCost = 0,
} = {}) {
  const months = Math.max(1, Math.round(Number(horizonYears) * 12))
  const savings = Math.max(0, Number(monthlySavings) || 0)
  const cashTarget = money(Math.max(0, Number(monthlyCost) || 0) * cashTargetMonths)
  let cash = Math.max(0, Number(startingPosition.cash) || 0)
  const balances = normalizedStartingBalances(startingPosition.investmentBalances)
  const startingValue = money(cash + Object.values(balances).reduce((sum, value) => sum + value, 0))
  let cashContributions = 0
  let investmentContributions = 0
  let debtContributions = 0
  let cashTargetMonth = cashTarget > 0 && cash >= cashTarget ? 0 : null
  const points = [projectionPoint(0, cash, balances)]

  for (let month = 1; month <= months; month += 1) {
    for (const [type, balance] of Object.entries(balances)) {
      const defaultReturn =
        investmentTypeDefinitions.find((definition) => definition.id === type)?.returnPercent || 0
      const annualReturn = Number(investmentMix[type]?.annualReturnPercent ?? defaultReturn)
      balances[type] = balance * (1 + annualReturn / 100 / 12)
    }

    let cashContribution = (savings * allocation.cash) / 100
    let investmentContribution = (savings * allocation.invest) / 100
    const debtContribution = (savings * allocation.debt) / 100
    if (cashTarget > 0) {
      const room = Math.max(0, cashTarget - cash)
      const redirected = Math.max(0, cashContribution - room)
      cashContribution -= redirected
      investmentContribution += redirected
    }
    cash += cashContribution
    distributeInvestmentContribution(balances, investmentMix, investmentContribution)
    cashContributions += cashContribution
    investmentContributions += investmentContribution
    debtContributions += debtContribution

    if (cashTargetMonth == null && cashTarget > 0 && cash >= cashTarget) cashTargetMonth = month
    if (month % 12 === 0 || month === months) {
      points.push(projectionPoint(month, cash, balances))
    }
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
    investmentContributions: money(investmentContributions),
    contributions: assetContributions,
    growth: money(finalValue - startingValue - assetContributions),
    debtContributions: money(debtContributions),
    annualDebtContribution: money((savings * allocation.debt * 12) / 100),
    cashTarget,
    cashTargetMonth,
    points,
    investmentBalances: Object.fromEntries(
      Object.entries(balances).map(([type, value]) => [type, money(value)]),
    ),
  }
}

function projectionPoint(month, cash, balances) {
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
    investableValue: money(investableValue),
  }
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
