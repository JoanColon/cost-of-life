/* eslint-disable no-unused-vars */
/* eslint-disable no-case-declarations */
import { defineStore } from 'pinia'
import { db } from 'src/js/firebase'
import { collection, query, onSnapshot, doc } from 'firebase/firestore'
import * as math from 'mathjs'

// import functions from src/js
import {
  getSymbolOrders,
  getOrderTotals,
  getSymbolGeneralInfo,
  getApiData,
  getSymbolMergedData,
  getSymbolUserDefinedData,
  getSymbolDataCurrencyExchange,
  getSymbolRatiosCalculations,
  getTWR,
  getSymbolFinalArray,
  getObjZero,
} from 'src/js/investmentsFunctions'

// import and declare storeAuth
import { useStoreAuth } from 'src/stores/storeAuth'
import { useStoreUserSettings } from 'src/stores/storeUserSettings'
import { useStoreInvestmentsGlobal } from 'src/stores/storeInvestmentsGlobal'
import { useStoreSavings } from 'src/stores/storeSavings'
import { useStoreNetWorth } from 'src/stores/storeNetWorth'

export const useStoreInvestments = defineStore('storeInvestments', {
  // ---------------------------------------------- STATE ---------------------------------------- //
  state: () => {
    return {
      allOrderList: {
        detailBrokerageAccount: [],
        detailRealEstate: [],
        detailFixedIncome: [],
        detailCryptoAssets: [],
        detailCashSavings: [],
        detailBusinessEquity: [],
        detailOthers: [],
      },
      netwothAssetsDoc: [],
      myCategories: [
        'detailBrokerageAccount',
        'detailRealEstate',
        'detailFixedIncome',
        'detailCryptoAssets',
        'detailCashSavings',
        'detailBusinessEquity',
        'detailOthers',
      ],
    }
  },

  // ---------------------------------------------- ACTIONS ---------------------------------------- //
  actions: {
    getAllOrders() {
      const storeAuth = useStoreAuth()
      const orderCategories = this.myCategories

      // my code
      orderCategories.forEach((element) => {
        try {
          const q = query(collection(db, 'users', storeAuth.user.id, element))
          const symbolData = onSnapshot(q, (querySnapshot) => {
            this.allOrderList[element] = []

            querySnapshot.forEach((doc) => {
              this.allOrderList[element].push(doc.data())
            })
            // console.log(this.allOrderList)
          })
        } catch (error) {
          console.error(error)
        }
      })
    },
    getNetworthAssetsDoc() {
      const storeAuth = useStoreAuth()

      // Reference to your collection
      const networthAssetsDocRef = doc(
        db,
        'users',
        storeAuth.user.id,
        'networth',
        'networthAssetsDoc',
      )

      const networthData = onSnapshot(networthAssetsDocRef, (doc) => {
        this.netwothAssetsDoc = doc.data() // remove first element of the array
      })
    },
  },
  getters: {
    getBrokerageData: (state) => {
      // STEP 0. Get initial data
      // Get global data, dailyStockData from yahoo finance rapidApi (firebase funciton)
      const storeInvestmentsGlobal = useStoreInvestmentsGlobal()
      const storeUserSettings = useStoreUserSettings()
      const storeSavings = useStoreSavings()
      const storeNetWorth = useStoreNetWorth()
      const savingsDoc = storeSavings.savingsDocDict
      const networthDoc = storeNetWorth.networthDocDict
      const dailyCurrencyExchange = storeInvestmentsGlobal.currencyExchange
      const userSettingsCurrency = storeUserSettings.userSettings.currency

      // STETP 1. We will loop the orderCategories array, for each element we will calculate the needed data for the Detail investment component (table rows and portofolio metrics)
      const orderCategories = state.myCategories

      // STEP 2. Create two empty arrays that will contain the data for each element in the order Categories array
      const allRowsDict = {}
      const allPortofolioMetricsDict = {}

      try {
        // STEP 3. For each category we run the functions from storeInvestments.js to populate the allRowsDict and allPortofolioMetricsDict
        orderCategories.forEach((category) => {
          const categoryData = state.allOrderList[category]
          const symbolOrders = getSymbolOrders(categoryData) // before it was called groupedStocks
          const orderTotals = getOrderTotals(symbolOrders)
          const symbolGeneralInfo = getSymbolGeneralInfo(categoryData)
          const apiData = getApiData(categoryData)
          const symbolMergedData = getSymbolMergedData(orderTotals, symbolGeneralInfo, apiData)
          const symbolUserDefinedData = getSymbolUserDefinedData(
            category,
            categoryData,
            symbolMergedData,
          )
          const symbolDataCurrencyExchange = getSymbolDataCurrencyExchange(
            symbolUserDefinedData,
            dailyCurrencyExchange,
            userSettingsCurrency,
          )
          const symbolRatiosCalculations = getSymbolRatiosCalculations(symbolDataCurrencyExchange)
          const returnsTWR = getTWR(category, networthDoc, savingsDoc)
          const { symbolFinalArray, portofolioMetrics } = getSymbolFinalArray(
            category,
            symbolRatiosCalculations,
            returnsTWR,
          )

          // STEP 4. add data to allRowsDict and allPortofolioMetricsDict
          // add symbolFinalArray to allRowsDict if symbolFinalArray !== 0 add a predefined array
          if (symbolFinalArray.length === 0) {
            const objZero = getObjZero()
            symbolFinalArray.push(objZero)
            allRowsDict[category] = symbolFinalArray
          } else {
            allRowsDict[category] = symbolFinalArray
          }

          allPortofolioMetricsDict[category] = portofolioMetrics
        })

        // console.log('adding symbol to ddbb')

        return [allRowsDict, allPortofolioMetricsDict]
      } catch {
        console.log('something wrong happened')
        return []
      }
    },
    getDailyData: (state) => {
      const dailyData = {
        dailyYahooFinanceData: [],
        dailyCryptoData: [],
      }

      const categories = Object.keys(state.allOrderList)
      const allOrderList = state.allOrderList
      categories.forEach((category) => {
        allOrderList[category].forEach((element) => {
          const symbol = element.generalInfo.symbol
          const obj = {}
          switch (category) {
            case 'detailBrokerageAccount':
            case 'detailRealEstate':
            case 'detailFixedIncome':
              obj[symbol] = element.apiData
              dailyData.dailyYahooFinanceData.push(obj)
              break
            case 'detailCryptoAssets':
              obj[symbol] = element.apiData
              dailyData.dailyCryptoData.push(obj)
              break
          }
        })
      })

      return dailyData
    },
    getInvestmentsUserModifiedList: (state) => {
      const investmentsUserModifiedList = {}

      const categories = Object.keys(state.allOrderList)
      const allOrderList = state.allOrderList
      categories.forEach((category) => {
        allOrderList[category].forEach((element) => {
          const symbol = element.generalInfo.symbol
          investmentsUserModifiedList[symbol] = element.userInfo
        })
      })
      return investmentsUserModifiedList
    },
    getRapidApiSymbols: (state) => {
      const allOrderList = state.allOrderList
      const categories = state.myCategories

      const initialRapidApiSymbols = {
        yahooFinance: [],
        yahooFinanceSymbolsCategories: {},
        coinRanking: [],
      }

      categories.forEach((category) => {
        switch (category) {
          case 'detailBrokerageAccount':
          case 'detailRealEstate':
          case 'detailFixedIncome':
            const symbolArray = allOrderList[category]
              .map((element) => {
                // check if the shareAmount is 0, if yes, doces not include the ticker, to prevent calling old
                // or even non-existing symbols
                const orderArraykeys = Object.keys(element.orderInfo)
                const shareAmountList = []
                orderArraykeys.forEach((key) => {
                  const shares = element.orderInfo[key].shareAmount
                  shareAmountList.push(shares)
                })
                const shares = math.sum(shareAmountList)

                if (shares > 0) {
                  return element.generalInfo.symbol
                } else {
                  return null
                }
              })
              .filter((symbol) => symbol !== null) // Filter out null values

            initialRapidApiSymbols.yahooFinance.push(symbolArray)
            initialRapidApiSymbols.yahooFinanceSymbolsCategories[category] = symbolArray
            break
          case 'detailCryptoAssets':
            const symolCoinArray = allOrderList[category].map(
              (element) => element.generalInfo.symbol,
            )
            initialRapidApiSymbols.coinRanking.push(symolCoinArray)
        }
      })

      const rapidApiSymbols = {
        yahooFinance: initialRapidApiSymbols.yahooFinance.flat(),
        yahooFinanceSymbolsCategories: initialRapidApiSymbols.yahooFinanceSymbolsCategories,
        coinRanking: initialRapidApiSymbols.coinRanking.flat(),
      }

      return rapidApiSymbols
    },
    getAllSymbols: (state) => {
      const allOrderList = state.allOrderList
      const categories = state.myCategories

      const initialRapidApiSymbols = {
        yahooFinance: [],
        yahooFinanceSymbolsCategories: {},
        coinRanking: [],
      }

      categories.forEach((category) => {
        switch (category) {
          case 'detailBrokerageAccount':
          case 'detailRealEstate':
          case 'detailFixedIncome':
            const symbolArray = allOrderList[category].map((element) => element.generalInfo.symbol)
            initialRapidApiSymbols.yahooFinance.push(symbolArray)
            initialRapidApiSymbols.yahooFinanceSymbolsCategories[category] = symbolArray
            break
          case 'detailCryptoAssets':
            const symolCoinArray = allOrderList[category].map(
              (element) => element.generalInfo.symbol,
            )
            initialRapidApiSymbols.coinRanking.push(symolCoinArray)
        }
      })

      const rapidApiSymbols = {
        yahooFinance: initialRapidApiSymbols.yahooFinance.flat(),
        yahooFinanceSymbolsCategories: initialRapidApiSymbols.yahooFinanceSymbolsCategories,
        coinRanking: initialRapidApiSymbols.coinRanking.flat(),
      }

      return rapidApiSymbols
    },
    getDividends: (state) => {
      const allOrderList = state.allOrderList
      const investmentDetailNameKeys = Object.keys(allOrderList)
      const dividendeObject = {
        byCompany: {},
        byYear: {},
      }

      investmentDetailNameKeys.forEach((investmentDetailName) => {
        switch (investmentDetailName) {
          case 'detailBrokerageAccount':
          case 'detailRealEstate':
          case 'detailFixedIncome':
            const investmentDetailObject = {}

            // get dividends by company
            allOrderList[investmentDetailName].forEach((entry) => {
              const symbol = entry.generalInfo.symbol
              const dividends = entry.dividends ? entry.dividends : []
              const newObj = { dividends }
              investmentDetailObject[symbol] = newObj
            })
            dividendeObject.byCompany[investmentDetailName] = investmentDetailObject

            // get dividends by year
            const dividendsByCompanyKeys = Object.keys(
              dividendeObject.byCompany[investmentDetailName],
            )
            const dividendsArray = []
            dividendsByCompanyKeys.forEach((symbol) => {
              const dividendsKeys = Object.keys(
                dividendeObject.byCompany[investmentDetailName][symbol].dividends,
              )
              dividendsKeys.forEach((key) => {
                const obj = {}
                const objData =
                  dividendeObject.byCompany[investmentDetailName][symbol].dividends[key]
                const date = new Date(objData.date)
                obj.id = key
                obj.symbol = symbol
                obj.dividend = objData.dividend
                obj.dividendBaseCurrency = objData.dividendBaseCurrency
                obj.year = date.getFullYear()
                dividendsArray.push(obj)
              })
            })

            const dividendsByYear = dividendsArray.reduce((acc, currentValue) => {
              const { year } = currentValue
              acc[year] = acc[year] || []
              acc[year].push(currentValue)
              return acc
            }, {})

            dividendeObject.byYear[investmentDetailName] = dividendsByYear
        }
      })

      return dividendeObject
    },
    getAnalysisCharts: (state) => {
      const allOrderList = state.allOrderList
      const investmentDetailNameKeys = Object.keys(allOrderList)
      const analysisCharts = {}

      investmentDetailNameKeys.forEach((investmentDetailName) => {
        switch (investmentDetailName) {
          case 'detailBrokerageAccount':
          case 'detailRealEstate':
          case 'detailFixedIncome':
            const investmentDetailObject = {}

            // get dividends by company
            allOrderList[investmentDetailName].forEach((entry) => {
              const symbol = entry.generalInfo.symbol
              const analysisChartData = entry.analysisCharts ? entry.analysisCharts : []
              const currency = entry.apiData.currency
              const newObj = { analysisChartData, currency }
              investmentDetailObject[symbol] = newObj
            })
            analysisCharts[investmentDetailName] = investmentDetailObject
        }
      })
      return analysisCharts
    },
    getAnalysisFinancials: (state) => {
      const allOrderList = state.allOrderList
      const investmentDetailNameKeys = Object.keys(allOrderList)
      const analysisFinancials = {}

      investmentDetailNameKeys.forEach((investmentDetailName) => {
        switch (investmentDetailName) {
          case 'detailBrokerageAccount':
          case 'detailRealEstate':
          case 'detailFixedIncome':
            const investmentDetailObject = {}

            // get dividends by company
            allOrderList[investmentDetailName].forEach((entry) => {
              const symbol = entry.generalInfo.symbol
              const analysisFinancialData = entry.analysisFinancials ? entry.analysisFinancials : []
              const currency = entry.apiData.currency
              const newObj = { analysisFinancialData, currency }
              investmentDetailObject[symbol] = newObj
            })
            analysisFinancials[investmentDetailName] = investmentDetailObject
        }
      })
      return analysisFinancials
    },
  },
})
