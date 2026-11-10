import {
  calculateMortgageBalanceFromAnchor,
  isMortgagePaymentDueInCalendarMonth,
} from '../../shared/liabilities/mortgage.js'
import { calculateAnniversaryRealEstateValuation } from '../../shared/assets/real-estate.js'

// Converts the persisted asset document into its effective value on the requested date.
// Assets without a versioned real-estate model retain their manually recorded value.
function effectiveRealEstateValue(asset, asOfDate) {
  if (asset?.detail?.realEstate?.schemaVersion !== 2) return Number(asset?.currentValue || 0)
  return calculateAnniversaryRealEstateValuation(asset.detail.realEstate, asOfDate)
}

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
  return calculateMortgageBalanceFromAnchor(mortgage, asOfDate)
}

function isLiabilityPaymentDueInMonth(liability, year, monthIndex) {
  const mortgage = liability?.detail?.mortgage
  if (liability?.categoryId !== 'mortgage' || mortgage?.schemaVersion !== 2) return null
  return isMortgagePaymentDueInCalendarMonth(mortgage, year, monthIndex)
}

export { calculatePositionsAt, effectiveLiabilityBalance, isLiabilityPaymentDueInMonth }
