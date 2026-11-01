const { effectiveMortgageBalance } = require('./mortgage')
const { effectiveRealEstateValue } = require('./real-estate')

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

module.exports = { calculatePositionsAt, effectiveLiabilityBalance }
