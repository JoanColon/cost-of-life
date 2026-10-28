import { calculateMortgageProjection, mortgageDetailFromLiability } from './mortgage-amortization'

export function calculateDebtPayoffImpact({
  liability,
  extraMonthlyPayment = 0,
  asOfDate = new Date(),
} = {}) {
  const mortgage = mortgageDetailFromLiability(liability)
  if (!mortgage) return null

  try {
    const projection = calculateMortgageProjection({
      currentBalance: mortgage.currentBalance,
      annualInterestRate: mortgage.annualInterestRate,
      monthlyPayment: mortgage.monthlyPayment,
      extraMonthlyPayment,
      asOfDate,
    })
    return {
      modelType: 'mortgage',
      annualInterestRate: mortgage.annualInterestRate,
      ...projection,
    }
  } catch {
    return null
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
