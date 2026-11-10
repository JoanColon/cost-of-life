import { nominalMonthlyRateFromAnnualPercent } from '../../../functions/shared/core/rates.js'
import {
  buildFrenchMortgageScheduleFromBalance,
  calculateFrenchMortgageMonthlyPayment,
  compareFrenchMortgagePayoffScenarios,
} from '../../../functions/shared/liabilities/mortgage.js'

export function monthlyInterestRate(annualInterestRate) {
  return nominalMonthlyRateFromAnnualPercent(annualInterestRate)
}

export function calculateFrenchMonthlyPayment({ principal, annualInterestRate, termMonths }) {
  return calculateFrenchMortgageMonthlyPayment({ principal, annualInterestRate, termMonths })
}

export function buildFrenchAmortizationSchedule({
  currentBalance,
  annualInterestRate,
  monthlyPayment,
  extraMonthlyPayment = 0,
  asOfDate = new Date(),
  startDate = null,
}) {
  return buildFrenchMortgageScheduleFromBalance({
    currentBalance,
    annualInterestRate,
    monthlyPayment,
    extraMonthlyPayment,
    asOfDate,
    startDate,
  })
}

export function calculateMortgageProjection({ extraMonthlyPayment = 0, ...mortgage }) {
  return compareFrenchMortgagePayoffScenarios({ ...mortgage, extraMonthlyPayment })
}

export function mortgageDetailFromLiability(liability) {
  const detail = liability?.detail?.mortgage
  if (!detail || detail.amortizationType !== 'french' || detail.fixedRate !== true) return null

  return {
    originalPrincipal: detail.originalPrincipal,
    currentBalance: liability.balance,
    annualInterestRate: detail.annualInterestRate,
    monthlyPayment: detail.monthlyPayment,
    startDate: detail.startDate,
    termMonths: detail.termMonths,
    amortizationType: detail.amortizationType,
    fixedRate: detail.fixedRate,
  }
}
