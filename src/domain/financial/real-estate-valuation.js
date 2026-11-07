import { annualRealEstateValue as calculateAnnualRealEstateValue } from '../../../functions/shared/financial-core.js'

export function annualRealEstateValue(model, asOfDate = localToday()) {
  return calculateAnnualRealEstateValue(model, asOfDate)
}

export function effectiveRealEstateValue(asset, asOfDate = localToday()) {
  if (asset?.detail?.realEstate?.schemaVersion !== 2) return Number(asset?.currentValue || 0)
  return annualRealEstateValue(asset.detail.realEstate, asOfDate)
}

function localToday() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
