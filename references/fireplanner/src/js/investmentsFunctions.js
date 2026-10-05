/* eslint-disable no-unused-vars */
export function getSymbolOrders(categoryData) {
  try {
    // get categoryData = state.allOrderList.category as input and return an array with the follwoing schema:
    // groupedSymbolsArray = {symbol: {timestamp: {shareAmount, totalTransaction, date, buyOrSell, timestamp}}, {symbol: {...}}, {symbol: {...}}}
    // for each symbol creates an array of orders
    const groupedSymbolsArray = categoryData.map((element) => {
      const orderArray = []
      const orderKeys = Object.keys(element.orderInfo)

      orderKeys.forEach((order) => {
        const orderData = element.orderInfo[order]
        orderArray.push(orderData)
      })

      // returns an array of objects, each object is the symbol and the array of orders
      return { [element.generalInfo.symbol]: orderArray }
    })

    return groupedSymbolsArray
  } catch (error) {
    console.log('error in getSymbolOrders')
    return 'error'
  }
}

function getNumber(value, fallback = 0) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

export function calculateFifoPosition(orders) {
  const orderArray = Array.isArray(orders)
    ? orders
    : Object.keys(orders || {}).map((key) => orders[key])

  const sortedOrders = orderArray
    .filter((order) => order)
    .sort((a, b) => getNumber(a.timestamp) - getNumber(b.timestamp))

  const lots = []
  let totalBuys = 0
  let totalShareBuys = 0
  let totalSells = 0
  let totalShareSells = 0
  let realizedCapitalGains = 0

  sortedOrders.forEach((order) => {
    const shareAmount = getNumber(order.shareAmount)
    const totalTransaction = getNumber(order.totalTransaction)
    const sharePrice = getNumber(order.sharePrice, Math.abs(totalTransaction / shareAmount))
    const isSell = order.buyOrSell === 'Sell' || shareAmount < 0 || totalTransaction < 0

    if (!isSell) {
      const shares = Math.abs(shareAmount)
      const cost = Math.abs(totalTransaction)
      const price = sharePrice || (shares !== 0 ? cost / shares : 0)

      totalBuys += cost
      totalShareBuys += shares

      if (shares > 0) {
        lots.push({ shares, price })
      }
      return
    }

    let sharesToSell = Math.abs(shareAmount)
    const proceeds = Math.abs(totalTransaction)
    const sellPrice = sharePrice || (sharesToSell !== 0 ? proceeds / sharesToSell : 0)

    totalSells -= proceeds
    totalShareSells -= sharesToSell

    while (sharesToSell > 0 && lots.length > 0) {
      const lot = lots[0]
      const sharesSoldFromLot = Math.min(sharesToSell, lot.shares)

      realizedCapitalGains += sharesSoldFromLot * (sellPrice - lot.price)
      lot.shares -= sharesSoldFromLot
      sharesToSell -= sharesSoldFromLot

      if (lot.shares <= 0) {
        lots.shift()
      }
    }
  })

  const remainingShares = lots.reduce((acc, lot) => acc + lot.shares, 0)
  const remainingCostBasis = lots.reduce((acc, lot) => acc + lot.shares * lot.price, 0)
  const averagePrice = remainingShares !== 0 ? remainingCostBasis / remainingShares : NaN

  return {
    shareAmount: remainingShares,
    totalInvested: remainingCostBasis,
    averagePrice,
    realizedCapitalGains,
    totalBuys,
    totalShareBuys,
    totalSells,
    totalShareSells,
    remainingShares,
    remainingCostBasis,
  }
}

export function getOrderTotals(symbolOrders) {
  try {
    // empty array to store the reduced objects including each object.
    // {symbol: {shareAmount, totalInvested, averagePrice}}
    const arrayResult = []

    // loop at each symbol of the groupedSymbolArray
    // at the end of the loop a reduced object is pushed to the groupedSymbolReduced array
    symbolOrders.forEach((symbol) => {
      const symbolKey = Object.keys(symbol)
      const orderArray = symbol[symbolKey[0]]
      const fifoPosition = calculateFifoPosition(orderArray)
      const obj = {
        [symbolKey]: {
          shareAmount: fifoPosition.shareAmount,
          totalInvested: fifoPosition.totalInvested,
          realizedCapitalGains: fifoPosition.realizedCapitalGains,
        },
      }

      arrayResult.push(obj)
    })

    return arrayResult
  } catch (error) {
    console.log('error in getSymbolSharesPriceTotal:')
    return 'error'
  }
}

export function getSymbolGeneralInfo(categoryData) {
  try {
    // for each symbol creates an object with the general Info
    const arrayResult = categoryData.map((element) => {
      const generalInfoArray = {
        symbol: element.generalInfo.symbol,
        country: element.generalInfo.country,
        sector: element.generalInfo.sector ?? '-',
        superSector: element.generalInfo.superSector ?? '-',
      }

      return generalInfoArray
    })

    return arrayResult
  } catch (error) {
    console.log('error in getSymbolGeneralInfo:')
    return 'error'
  }
}

export function getApiData(categoryData) {
  try {
    // for each symbol creates an object with the general Info
    const arrayResult = categoryData.map((element) => {
      const apiDataArray = {
        currency: element.apiData.currency ?? 'USD',
        epsCurrentYear: element.apiData.epsCurrentYear ?? 0,

        regularMarketPrice:
          element.apiData.regularMarketPrice !== undefined
            ? element.apiData.regularMarketPrice // for yahooFinance api calls
            : element.apiData.price !== undefined
              ? parseFloat(element.apiData.price)
              : 0, // for coinRanking api calls

        regularMarketChangePercent:
          element.apiData.regularMarketChangePercent !== undefined
            ? element.apiData.regularMarketChangePercent / 100 // for yahooFinance api calls
            : element.apiData.change !== undefined
              ? parseFloat(element.apiData.change / 100)
              : 0, // for coinRanking api calls

        dividendRate:
          typeof element.apiData.dividendRate === 'number' && !isNaN(element.apiData.dividendRate)
            ? element.apiData.dividendRate // yahooFinance stocks
            : element.apiData.dividendYield !== undefined && element.apiData.currency === 'GBp'
              ? (element.apiData.regularMarketPrice / 100) * (element.apiData.dividendYield / 100)
              : element.apiData.dividendYield !== undefined
                ? element.apiData.regularMarketPrice * (element.apiData.dividendYield / 100)
                : 0, // yahooFinance ETF and in undefined 0 for the rest of the categories), // yahooFinance ETF and in undefined 0 for the rest of the categories

        dividendYield:
          typeof element.apiData.dividendRate === 'number' && !isNaN(element.apiData.dividendRate)
            ? element.apiData.dividendRate / element.apiData.regularMarketPrice
            : element.apiData.dividendYield !== undefined
              ? element.apiData.dividendYield / 100
              : 0,
      }

      return { [element.generalInfo.symbol]: apiDataArray }
    })

    return arrayResult
  } catch (error) {
    console.log('error in getSymbolYahooFinanceData:')
    return 'error'
  }
}

export function getSymbolMergedData(orderTotals, symbolGeneralInfo, apiData) {
  try {
    const arrayResult = orderTotals.map((element) => {
      const symbol = Object.keys(element)[0]
      const generalInfo = symbolGeneralInfo.find((element) => element.symbol === symbol)
      const myApiData = apiData.find((element) => symbol in element)

      const mergedObject = {}
      Object.keys(element).forEach((key) => {
        mergedObject[key] = { ...element[key], ...generalInfo, ...myApiData[key] }
      })

      return mergedObject
    })

    return arrayResult
  } catch (error) {
    console.log('error in getSymbolMergedData:')
    return 'error'
  }
}

export function getSymbolUserDefinedData(category, categoryData, symbolMergedData) {
  try {
    const arrayResult = symbolMergedData.map((element) => {
      const symbol = Object.keys(element)[0]
      const userInfo = categoryData.find(
        (element) => element.generalInfo.symbol === symbol,
      ).userInfo

      // check if user has defined its own region (if statement)
      if (userInfo.userRegionCheckBox === true) {
        const userRegion = userInfo.userRegion
        element[symbol].country = userRegion
      }

      // check if user has defined its own stock price (if statement)
      if (userInfo.userStockPriceCheckBox === true) {
        const userCurrentPrice = userInfo.userStockPrice
        element[symbol].regularMarketPrice = userCurrentPrice
      }

      // check if user has defined its own dividend
      if (userInfo.userStockDividendCheckBox === true) {
        const userDPS = userInfo.userStockDividend
        element[symbol].dividendRate = userDPS
        element[symbol].dividendYield = userDPS / element[symbol].regularMarketPrice
      }

      if (category === 'detailCashSavings' || category === 'detailOthers') {
        element[symbol].marketValue = userInfo.marketValue
        element[symbol].dividendYield = userInfo.dividendYield
      } else {
        element[symbol].marketValue = 0
      }

      return element
    })

    return arrayResult
  } catch (error) {
    console.log('error in getSymbolUserDefinedData:')
    return 'error'
  }
}

export function getSymbolDataCurrencyExchange(
  symbolUserDefinedData,
  dailyCurrencyExchange,
  userSettingsCurrency,
) {
  const arrayResult = symbolUserDefinedData.map((element) => {
    const symbolData = element[Object.keys(element)]
    const currency = symbolData.currency
    const currencyToUsd = dailyCurrencyExchange[currency]
    const currencyToBaseCurrency = dailyCurrencyExchange[userSettingsCurrency]

    symbolData.marketValue =
      symbolData.marketValue !== 0
        ? symbolData.marketValue
        : symbolData.shareAmount * symbolData.regularMarketPrice

    symbolData.marketValueBaseCurrency =
      (symbolData.marketValue / currencyToUsd) * currencyToBaseCurrency

    if (currency === 'GBp') {
      symbolData.annualDividendsBaseCurrency =
        ((symbolData.shareAmount * symbolData.dividendRate * 100) / currencyToUsd) *
        currencyToBaseCurrency
    } else {
      symbolData.annualDividendsBaseCurrency =
        symbolData.shareAmount !== 0
          ? ((symbolData.shareAmount * symbolData.dividendRate) / currencyToUsd) *
            currencyToBaseCurrency
          : symbolData.marketValue * symbolData.dividendYield
    }

    return element
  })

  return arrayResult
}

export function getSymbolRatiosCalculations(symbolDataCurrencyExchange) {
  try {
    const arrayResult = symbolDataCurrencyExchange.map((element) => {
      const symbolData = element[Object.keys(element)]
      symbolData.averagePrice =
        symbolData.shareAmount !== 0 ? symbolData.totalInvested / symbolData.shareAmount : NaN

      symbolData.priceToErningsRatio =
        symbolData.regularMarketPrice !== 0 && symbolData.epsCurrentYear !== 0
          ? symbolData.regularMarketPrice / symbolData.epsCurrentYear
          : NaN

      symbolData.totalReturn =
        symbolData.regularMarketPrice !== 0
          ? (symbolData.regularMarketPrice - symbolData.averagePrice) / symbolData.averagePrice
          : (symbolData.marketValue - symbolData.totalInvested) / symbolData.totalInvested

      if (symbolData.currency === 'GBp') {
        symbolData.dividendYield = (symbolData.dividendRate * 100) / symbolData.regularMarketPrice
      }
      return element
    })

    return arrayResult
  } catch (error) {
    console.log('error in getSymbolRatiosCalculations:')
    return 'error'
  }
}

export function getTWR(category, networthDoc, savingsDoc) {
  try {
    const nwDocKeys = Object.keys(networthDoc)

    let arrayPosition = 0
    switch (category) {
      case 'detailBrokerageAccount':
        arrayPosition = 2
        break
      case 'detailRealEstate':
        arrayPosition = 1
        break
      case 'detailFixedIncome':
        arrayPosition = 3
        break
      case 'detailCryptoAssets':
        arrayPosition = 4
        break
      case 'detailCashSavings':
        arrayPosition = 5
        break
      case 'detailBusinessEquity':
        arrayPosition = 6
        break
      case 'detailOthers':
        arrayPosition = 7
        break
    }

    const nwArray = []
    // STEP 1. Get timestamp and amount for each networth entry
    nwDocKeys.forEach((key) => {
      const obj = {
        timestamp: networthDoc[key].timestamp,
        date: networthDoc[key].date,
        amount: networthDoc[key].netWorthDict.assets[arrayPosition].amount, // need to find a way in which [2] is a variable to loop for all categories
      }
      nwArray.push(obj)
    })

    // console.log('step 1, nwArray', nwArray)

    // STEP 2. groupby entries for year
    const groupedByYearTimestamp = {}
    nwArray.forEach((obj) => {
      const year = new Date(obj.timestamp).getFullYear()
      groupedByYearTimestamp[year] = groupedByYearTimestamp[year] || []
      groupedByYearTimestamp[year].push(obj)
    })

    // console.log('step 2, groupedByYearTimestamp:', groupedByYearTimestamp)

    // STEP 3. select the last entry per year (and the first and last entry for the first year)
    const yearKeys = Object.keys(groupedByYearTimestamp)
    const nwByYear = {}
    for (let i = 0; i < yearKeys.length; i++) {
      const year = yearKeys[i]
      if (i === 0) {
        const first = groupedByYearTimestamp[year][i]
        const last = groupedByYearTimestamp[year].slice(-1)[0]
        nwByYear[year] = {
          first,
          last,
        }
      } else {
        const initYear = year - 1
        const first = groupedByYearTimestamp[initYear].slice(-1)[0]
        const last = groupedByYearTimestamp[year].slice(-1)[0]
        nwByYear[year] = {
          first,
          last,
        }
      }
    }
    // console.log('step 3, nwByYear', nwByYear)

    // STEP 4. Group savings by category (savingsDetail)
    const savingsKeys = Object.keys(savingsDoc)
    const savingsArray = savingsKeys.map((key) => savingsDoc[key])
    let savingsReducedCategory = savingsArray.reduce((acc, cur) => {
      const savingsDetail = cur.savingsDetail
      acc[savingsDetail] = acc[savingsDetail] || []
      acc[savingsDetail].push(cur)
      return acc
    }, {})

    // choose only the investment detail needed
    savingsReducedCategory = savingsReducedCategory[category]
    // console.log('step 4, savingsArrayReduced', savingsReducedCategory)

    // STEP 5. reduce by year
    const savingsReducedFinal = savingsReducedCategory.reduce((acc, cur) => {
      const year = new Date(cur.timestamp).getFullYear()
      acc[year] = acc[year] || 0
      acc[year] += cur.savingsAmount
      return acc
    }, {})

    // console.log('step 5, savingsArrayFinal', savingsReducedFinal)

    // STEP 6. CAGR array
    const cagrArray = {}
    yearKeys.forEach((year) => {
      const obj = {
        initValue: nwByYear[year].first.amount,
        endValue: nwByYear[year].last.amount,
        cashflow: savingsReducedFinal[year] || 0,
      }
      cagrArray[year] = obj
    })

    // console.log('step 6, cagrArray:', cagrArray)

    // STEP 7. CAGR calculation (Time-Weighted Return)
    // https://www.investopedia.com/terms/t/time-weightedror.asp#:~:text=The%20time%2Dweighted%20rate%20of%20return%20(TWR)%20is%20a,inflows%20and%20outflows%20of%20money.
    // TWR = [(1 + HP^1) x (1 + HP^2) x … x ( 1 + HP^n )] – 1
    // Where:
    // TWR = Time-Weighted Return
    // n = Number of Periods
    // HP = (End Value – Initial Value + Cashflow)/(Initial Value + Cashflow)
    // HP^n = Return for Period “n”
    const twrYearList = []
    yearKeys.forEach((year) => {
      const element = cagrArray[year]
      const hp =
        (element.endValue - (element.initValue + element.cashflow)) /
        (element.initValue + element.cashflow)
      const twrYear = 1 + hp
      twrYearList.push(twrYear)
    })

    const twr = twrYearList.reduce((accumulator, currentValue) => accumulator * currentValue, 1) - 1
    const n = yearKeys.slice(-1)[0] - yearKeys[0]

    //  https://analystprep.com/cfa-level-1-exam/quantitative-methods/time-weighted-rate-return/
    //  annual time-weighted rate of return = (1 + compounded TWRR) 1/n – 1, where n is the number of years
    const twrAnnualAverage = (1 + twr) ** (1 / n) - 1

    const returns = {
      twr,
      twrAnnualAverage,
    }
    return returns
  } catch {
    const returns = {
      twr: 0,
      twrAnnualAverage: 0,
    }
    return returns
  }
}

export function getSymbolFinalArray(category, symbolRatiosCalculations, returnsTWR) {
  try {
    const rows = []
    symbolRatiosCalculations.forEach((element) => rows.push(element[Object.keys(element)]))

    const portofolioMarketValue = rows
      .map((element) => element.marketValueBaseCurrency)
      .reduce((acc, cur) => acc + cur, 0)
    const portofolioAnnualDividend = rows
      .map((element) => element.annualDividendsBaseCurrency)
      .reduce((acc, cur) => acc + cur, 0)
    const portofolioDayGains = rows
      .map((element) => element.marketValueBaseCurrency * element.regularMarketChangePercent)
      .reduce((acc, cur) => acc + cur, 0)

    const portofolioMetrics = {
      portofolioMarketValue,
      AnnualExpectedIncome: portofolioAnnualDividend,
      currentIncomeYield: portofolioAnnualDividend / portofolioMarketValue,
      portofolioDayGains,
      twr: returnsTWR.twr,
      twrAnnualAverage: returnsTWR.twrAnnualAverage,
    }

    const symbolArray = rows.map((element) => {
      // add market and dividend weight
      element.marketValueWeight =
        element.marketValueBaseCurrency / portofolioMetrics.portofolioMarketValue
      element.dividendsYearWeight =
        element.annualDividendsBaseCurrency !== 0
          ? element.annualDividendsBaseCurrency / portofolioMetrics.AnnualExpectedIncome
          : 0

      // format elements to populate the table
      const currency = element.currency
      element.averagePrice = element.averagePrice.toLocaleString('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
      })
      element.regularMarketPrice = element.regularMarketPrice.toLocaleString('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
      })
      element.totalInvested = element.totalInvested.toLocaleString('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
      })

      return element
    })

    // remove symbols with 0 as shareAmount
    let symbolFinalArray = []
    if (category === 'detailCashSavings' || category === 'detailOthers') {
      symbolFinalArray = symbolArray.filter((element) => element.marketValueBaseCurrency !== 0)
    } else {
      symbolFinalArray = symbolArray.filter((element) => element.shareAmount !== 0)
    }

    return { symbolFinalArray, portofolioMetrics }
  } catch (error) {
    console.log('error in getYahooFinanceFinalArray:')
  }
}

// get zeroObj in case no investment is found
export function getObjZero() {
  const objZero = {
    symbol: 'Please add a symbol',
    country: 'n.a.',
    currency: 'n.a.',
    sector: '',
    superSector: '',
    priceToErningsRatio: 0,
    shareAmount: 0,
    averagePrice: 0,
    regularMarketPrice: 0,
    regularMarketChangePercent: 0,
    totalReturn: 0,
    dividendYield: 0,
    dividendRate: 0,
    marketValue: 0,
    marketValueBaseCurrency: 0,
    annualDividendsBaseCurrency: 0,
    marketValueWeight: 0,
    dividendsYearWeight: 0,
  }

  return objZero
}
