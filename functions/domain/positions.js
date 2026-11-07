import { effectiveMortgageBalance, isMortgagePaymentDueInMonth } from './mortgage.js'
import { effectiveRealEstateValue } from './real-estate.js'

function calculatePositionsAt({ assets = [], liabilities = [], asOfDate }) {
  return {
    assets: assets.map((asset) => ({
      ...asset,
      currentValue: effectiveRealEstateValue(asset, asOfDate),
    })),
    liabilities: liabilities.map((liability) => ({
      ...liability,
      balance: effectiveLiabilityBalance(liability, asOfDate),
    })),
  }
}

function effectiveLiabilityBalance(liability, asOfDate) {
  const mortgage = liability?.detail?.mortgage
  if (liability?.categoryId !== 'mortgage' || mortgage?.schemaVersion !== 2) {
    return Number(liability?.balance || 0)
  }
  return effectiveMortgageBalance(mortgage, asOfDate)
}

function isLiabilityPaymentDueInMonth(liability, year, monthIndex) {
  const mortgage = liability?.detail?.mortgage
  if (liability?.categoryId !== 'mortgage' || mortgage?.schemaVersion !== 2) return null
  return isMortgagePaymentDueInMonth(mortgage, year, monthIndex)
}

export { calculatePositionsAt, effectiveLiabilityBalance, isLiabilityPaymentDueInMonth }
export default { calculatePositionsAt, effectiveLiabilityBalance, isLiabilityPaymentDueInMonth }
