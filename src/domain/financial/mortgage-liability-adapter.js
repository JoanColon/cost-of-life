/**
 * Adapts persisted liability documents to the explicit input expected by shared mortgage formulas.
 */
/** Returns a supported fixed-rate French mortgage model extracted from a liability document. */
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
