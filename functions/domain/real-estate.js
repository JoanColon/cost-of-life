import { annualRealEstateValue } from '../shared/financial-core.js'

function effectiveRealEstateValue(asset, asOfDate) {
  if (asset?.detail?.realEstate?.schemaVersion !== 2) return Number(asset?.currentValue || 0)
  return annualRealEstateValue(asset.detail.realEstate, asOfDate)
}

export { annualRealEstateValue, effectiveRealEstateValue }
export default { annualRealEstateValue, effectiveRealEstateValue }
