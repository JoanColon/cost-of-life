import {
  buildFrenchAmortizationSchedule,
  calculateMortgageProjection,
  mortgageDetailFromLiability,
} from './mortgage-amortization'

export function calculateDebtPayoffImpact({
  liability,
  extraMonthlyPayment = 0,
  asOfDate = new Date(),
} = {}) {
  const mortgage = mortgageDetailFromLiability(liability)
  if (!mortgage) return null

  try {
    const historySchedule = mortgageHistorySchedule(mortgage, asOfDate)
    const projection = calculateMortgageProjection({
      currentBalance: mortgage.currentBalance,
      annualInterestRate: mortgage.annualInterestRate,
      monthlyPayment: mortgage.monthlyPayment,
      extraMonthlyPayment,
      asOfDate,
      startDate: mortgage.startDate,
    })
    return {
      modelType: 'mortgage',
      annualInterestRate: mortgage.annualInterestRate,
      originalPrincipal: mortgage.originalPrincipal,
      startDate: mortgage.startDate,
      currentDate: dateString(asOfDate),
      historySchedule,
      principalPaid: Math.max(0, mortgage.originalPrincipal - mortgage.currentBalance),
      progress:
        mortgage.originalPrincipal > 0
          ? Math.min(
              1,
              Math.max(
                0,
                (mortgage.originalPrincipal - mortgage.currentBalance) / mortgage.originalPrincipal,
              ),
            )
          : Number(mortgage.currentBalance <= 0),
      ...projection,
    }
  } catch {
    return null
  }
}

function dateString(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value || '').slice(0, 10)
}

function mortgageHistorySchedule(mortgage, asOfDate) {
  try {
    return buildFrenchAmortizationSchedule({
      currentBalance: mortgage.originalPrincipal,
      annualInterestRate: mortgage.annualInterestRate,
      monthlyPayment: mortgage.monthlyPayment,
      asOfDate: mortgage.startDate,
      startDate: mortgage.startDate,
    }).filter(({ date }) => date < dateString(asOfDate))
  } catch {
    return []
  }
}

export function highestInterestModeledDebt(liabilities = []) {
  return (
    liabilities
      .filter((liability) => mortgageDetailFromLiability(liability))
      .sort(
        (left, right) =>
          Number(right.detail.mortgage.annualInterestRate) -
          Number(left.detail.mortgage.annualInterestRate),
      )[0] || null
  )
}
