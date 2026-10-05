import { getFunctions, httpsCallable } from 'firebase/functions'
import { doc, updateDoc, setDoc } from 'firebase/firestore'
import { db } from 'src/js/firebase'

import { useStoreAuth } from 'src/stores/storeAuth'
const storeAuth = useStoreAuth()

// needed to call a firebase function
const functions = getFunctions()

// ------------------------------------- update yahoo finance -------------------------------------
export function updateMarketData(rapidApiSymbols) {
  try {
    const yahooFinanceSymbolsList = rapidApiSymbols.yahooFinance
    const categories = rapidApiSymbols.yahooFinanceSymbolsCategories
    const categoriesKeys = Object.keys(categories)
    const symbols = yahooFinanceSymbolsList.toString()
    const region = 'US'

    if (yahooFinanceSymbolsList.length > 0) {
      const updateYahooFinance = httpsCallable(functions, 'updateYahooFinance')
      updateYahooFinance({ region, symbols }).then((result) => {
        const resultData = result.data.result
        if (result.data === 'error') {
          console.log('error')
        } else {
          for (let i = 0; i < resultData.length; i++) {
            const symbol = resultData[i].symbol
            categoriesKeys.forEach(async (category) => {
              // normal update of rapidApi data when launching the app
              if (categories[category].includes(symbol)) {
                await updateDoc(doc(db, 'users', storeAuth.user.id, category, symbol), {
                  apiData: resultData[i],
                })
                // when needed in the dividends section (adding dividends to a missing symbol, need to create the symbol)
              } else if (rapidApiSymbols.fromDividends === true) {
                const generalInfo = {
                  symbol,
                  sector: '',
                  superSector: '',
                  country: 'US',
                }

                const userInfo = {
                  userStockPrice: 0.0,
                  userStockDividend: 0.0,
                  userStockPriceCheckBox: false,
                  userStockDividendCheckBox: false,
                  userRegion: '',
                  userRegionCheckBox: false,
                }

                const orderInfo = {}

                await setDoc(doc(db, 'users', storeAuth.user.id, category, symbol), {
                  generalInfo,
                  userInfo,
                  orderInfo,
                  apiData: resultData[i],
                })
              }
            })
          }
        }
      })
    }
  } catch (e) {
    // notify that an error has ocurred
    console.log('error', e)
  }
}

export function updateCryptoData(rapidApiSymbols) {
  try {
    const coinRankingSymbolsList = rapidApiSymbols.coinRanking
    const updateCoinRanking = httpsCallable(functions, 'updateCoinRanking')
    updateCoinRanking().then((result) => {
      // get response from rapidApi
      const resultData = result.data
      if (result.data === 'error') {
        console.log('error')
      } else {
        const coins = resultData.data.coins
        coinRankingSymbolsList.forEach(async (symbol) => {
          const symbolData = coins.find((element) => element.symbol === symbol)
          await updateDoc(doc(db, 'users', storeAuth.user.id, 'detailCryptoAssets', symbol), {
            apiData: symbolData,
          })
        })
      }
    })
  } catch (e) {
    console.log('error', e)
    // notify that an error has ocurred
  }
}

// --------------------------------- get candle chart -------------------------
export async function getSymbolChartData(symbol) {
  try {
    console.log('start get chart data')
    const getSymbolChartData = httpsCallable(functions, 'getSymbolChartData')
    const result = await getSymbolChartData(symbol)
    const symbolData = result.data
    console.log(symbol, ' result: ', symbolData)

    if (symbolData === 'error') {
      console.log('error')
      return 'error'
    } else {
      try {
        await updateDoc(doc(db, 'users', storeAuth.user.id, 'detailBrokerageAccount', symbol), {
          analysisCharts: symbolData.chart.result,
        })
        return 'successful operation'
      } catch (e) {
        console.error('Error updating document:', e)
        return 'error'
      }
    }
  } catch (e) {
    console.log('error', e)
    return 'error'
  }
}

/* export async function getSymbolFinancials (symbol) {
  try {   
    const getSymbolFinancials = httpsCallable(functions, 'getSymbolFinancials')
    const result = await getSymbolFinancials(symbol) // Wait for the Firebase function to complete
    
    if (result.data === 'error') {
      console.log('error')
      return 'error'
    } else {
      // Process the result data
      const finalObj = {}
      const mainKeys = Object.keys(result.data)
      mainKeys.forEach(key => {
        const subKeys = Object.keys(result.data[key])
        subKeys.forEach(subkey => {
          finalObj[subkey] = result.data[key][subkey]
        })
      })

      try {
        // Update the Firestore document with the financial data
        await updateDoc(doc(db, 'users', storeAuth.user.id, 'detailBrokerageAccount', symbol), {
          analysisFinancials: finalObj
        })
        return 'successful operation'
      } catch (e) {
        console.error('Error updating document:', e)
        return 'error'
      }
    }
  } catch (e) {
    console.error('Error in getSymbolFinancials:', e)
    return 'error'
  }
} */

// export function getSymbolFinancials (symbol) {
//   try {
//     console.log('start get financials')
//     const getSymbolFinancials = httpsCallable(functions, 'getSymbolFinancials')
//     getSymbolFinancials(symbol).then((result) => {
//       // const symbolData = result.data
//       const finalObj = {}
//       const mainKeys = Object.keys(result.data)
//       mainKeys.forEach(key => {
//         const subKeys = Object.keys(result.data[key])
//         subKeys.forEach(subkey => {
//           finalObj[subkey] = result.data[key][subkey]
//         })
//       })

//       if (result.data === 'error') {
//         console.log('error')
//       } else {
//         async function updateFirestoreDoc (finalObj) {
//           try {
//             await updateDoc(doc(db, 'users', storeAuth.user.id, 'detailBrokerageAccount', symbol), {
//               analysisFinancials: finalObj
//             })
//           } catch (e) {
//             console.error('Error updating document:', e)
//           }
//         }

//         updateFirestoreDoc(finalObj)
//       }
//     })
//   } catch (e) {
//     console.error('Error updating document:', e)
//   }
//   return 'successful operation'
// }
