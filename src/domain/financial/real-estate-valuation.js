import {
  annualRealEstateValue as calculateAnnualRealEstateValue,
  financialDate,
} from '../../../functions/shared/financial-core.js'

export function annualRealEstateValue(model, asOfDate = financialDate()) {
  return calculateAnnualRealEstateValue(model, asOfDate)
}

export function effectiveRealEstateValue(asset, asOfDate = financialDate()) {
  if (asset?.detail?.realEstate?.schemaVersion !== 2) return Number(asset?.currentValue || 0)
  return annualRealEstateValue(asset.detail.realEstate, asOfDate)
}
