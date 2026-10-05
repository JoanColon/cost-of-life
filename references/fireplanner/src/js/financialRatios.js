import { numberToPercentage } from 'src/js/helperFunctions'

// ----------------------- Debt ratios ----------------------------
export function currentRatioFunction(data) {
  let currentRatio = 0

  try {
    const currentAssets = data.currentAssets
    const currentLiabilities = data.currentLiabilities
    currentRatio = currentAssets / currentLiabilities
  } catch (e) {
    currentRatio = 'n.a'
  }

  return currentRatio
}

export function quickRatioFunction(data) {
  let quickRatio = 0

  try {
    const cash = data.cash
    const accountsReceivable = data.accountsReceivable
    const currentLiabilities = data.currentLiabilities
    const quickAssets = cash + accountsReceivable
    quickRatio = quickAssets / currentLiabilities
  } catch (e) {
    quickRatio = 'n.a'
  }

  return quickRatio
}

export function totalDebtToEquityFunction(data) {
  let debtToEquity = 0

  try {
    const totalLiabilities = data.totalLiabilities
    const equity = data.equity
    const debtToEquityCalc = totalLiabilities / equity
    debtToEquity = numberToPercentage(debtToEquityCalc, 1)
  } catch (e) {
    debtToEquity = 'n.a'
  }

  return debtToEquity
}

export function debtToEbitdaFunction(data) {
  let debtToEbitda = 0
  try {
    const shortTermDebt = data.shortTermDebt
    const longTermDebt = data.longTermDebt
    const netIncome = data.netIncome
    const interestExpense = data.interestExpense
    const taxProvision = data.taxProvision
    const depreciationAmortization = data.depreciationAmortization

    const debt = shortTermDebt + longTermDebt
    const ebitda = netIncome + interestExpense + taxProvision + depreciationAmortization

    debtToEbitda = debt / ebitda
  } catch (e) {
    debtToEbitda = 'n.a'
  }

  return debtToEbitda
}

export function netDebtToEbitdaFunction(data) {
  let debtToEbitda = 0
  try {
    const shortTermDebt = data.shortTermDebt
    const longTermDebt = data.longTermDebt
    const cash = data.cash
    const netIncome = data.netIncome
    const interestExpense = data.interestExpense
    const taxProvision = data.taxProvision
    const depreciationAmortization = data.depreciationAmortization

    const debt = shortTermDebt + longTermDebt - cash
    const ebitda = netIncome + interestExpense + taxProvision + depreciationAmortization

    debtToEbitda = debt / ebitda
  } catch (e) {
    debtToEbitda = 'n.a'
  }

  return debtToEbitda
}

// ----------------------- Financial performance ratios ----------------------------
export function grossMarginFunction(data) {
  let grossMargin = 0
  try {
    const totalRevenue = data.totalRevenue
    const costOfRevenue = data.costOfRevenue
    const grossMarginCalc = (totalRevenue - costOfRevenue) / totalRevenue

    grossMargin = numberToPercentage(grossMarginCalc, 1)
  } catch (e) {
    grossMargin = 'n.a'
  }

  return grossMargin
}

export function netMarginFunction(data) {
  let netMargin = 0
  try {
    const totalRevenue = data.totalRevenue
    const netIncome = data.netIncome
    const netMarginCalc = netIncome / totalRevenue

    netMargin = numberToPercentage(netMarginCalc, 1)
  } catch (e) {
    netMargin = 'n.a'
  }

  return netMargin
}

export function returnOnEquityFunction(data) {
  let returnOnEquity = 0

  try {
    const totalEquity = data.totalEquity
    const netIncome = data.netIncome
    const roa = netIncome / totalEquity
    returnOnEquity = numberToPercentage(roa, 1)
  } catch (e) {
    returnOnEquity = 'n.a'
  }

  return returnOnEquity
}

export function returnOnAssetsFunction(data) {
  let returnOnAssets = 0

  try {
    const totalAssets = data.totalAssets
    const netIncome = data.netIncome
    const roa = netIncome / totalAssets
    returnOnAssets = numberToPercentage(roa, 1)
  } catch (e) {
    returnOnAssets = 'n.a'
  }

  return returnOnAssets
}

// -------------------------- Dividends ratios -------------------------
export function payoutRatioFunction(data) {
  let payoutRatio = 0
  try {
    const netIncome = data.netIncome
    const dividendsPaid = data.dividendsPaid
    const payoutratioCalc = (dividendsPaid * -1) / netIncome

    payoutRatio = numberToPercentage(payoutratioCalc, 1)
  } catch (e) {
    payoutRatio = 'n.a'
  }

  return payoutRatio
}

export function freeCashflowPayoutRatioFunction(data) {
  let freeCashflowPayoutRatio = 0
  try {
    const cashflow = data.freeCashflow
    const dividendsPaid = data.dividendsPaid
    const payoutratioCalc = (dividendsPaid * -1) / cashflow

    freeCashflowPayoutRatio = numberToPercentage(payoutratioCalc, 1)
  } catch (e) {
    freeCashflowPayoutRatio = 'n.a'
  }

  return freeCashflowPayoutRatio
}

export function dividendsPerShareFunction(data) {
  let dps = 0
  try {
    const dividendsPaid = data.dividendsPaid
    const totalShares = data.totalShares
    dps = (dividendsPaid * -1) / totalShares
  } catch (e) {
    dps = 'n.a'
  }

  return dps
}
