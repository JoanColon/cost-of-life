// ------------------------ Grahams Valuation Model --------------------------
export function grahamsValuationModel(data) {
  const eps = data.eps
  const g = data.g // growth rate projections
  const y = data.y // current yield of AAA bonds

  const valuation = (eps * (7 + 1 * g) * 4.4) / y

  return valuation
}

// ------------------------ Dicsount Cashflow  Model --------------------------
export function discountCashFlowModel(data) {
  // const sumFCF = data.sumFCF
  // const cash = data.cash
  // const debt = data.totalDebt
  // const shares = data.sharesOutstanding
  const sumFCF = 2632437
  const cash = 104757
  const debt = 61270
  const shares = 7460

  const valuation = (sumFCF + cash - debt) / shares

  return valuation
}

// ------------------------ dividend discount  Model --------------------------
export function dividendDiscountModel(data) {
  // d = value of next year dividend
  // r = constant cost of equity capital
  // g =constant growth rate in peretuity
  const d = 2.678
  const r = 0.09
  const g = 0.08

  const valuation = d / (r - g)
  return valuation
}

// ------------------------ Multiples Valuation  Model --------------------------
export function multiplesValuationModel(data) {
  //   const eps = data.eps
  //   let sumPER = 0
  //   let sumCompanies = 0
  //   data.per.forEach(item => {
  //     sumPER = sumPER + item.PER
  //     sumCompanies = sumCompanies + 1
  //   })
  //   const averagePER = sumPER / sumCompanies

  const eps = 9.65
  const averagePER = 26.58
  const valuation = eps * averagePER
  return valuation
}
