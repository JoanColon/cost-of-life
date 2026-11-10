import { calculateAnniversaryRealEstateValuation } from '../../../functions/shared/assets/real-estate.js'
import { dateInFinancialTimeZone } from '../../../functions/shared/core/dates.js'

export function annualRealEstateValue(model, asOfDate = dateInFinancialTimeZone()) {
  return calculateAnniversaryRealEstateValuation(model, asOfDate)
}

export function effectiveRealEstateValue(asset, asOfDate = dateInFinancialTimeZone()) {
  if (asset?.detail?.realEstate?.schemaVersion !== 2) return Number(asset?.currentValue || 0)
  return annualRealEstateValue(asset.detail.realEstate, asOfDate)
}
