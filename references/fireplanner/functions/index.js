/* eslint-disable no-unused-vars */

// The Cloud Functions for Firebase SDK to create Cloud Functions and set up triggers.
const functions = require('firebase-functions/v1')

// The Firebase Admin SDK to access Firestore.
const admin = require('firebase-admin')
admin.initializeApp()

const axios = require('axios')
// const cors = require("cors")({origin: true});

// imports to encrypt apiKeys
// const {defineSecret} = require("firebase-functions/params");
// const mySecretKey = defineSecret("MY_SECRET_KEY");
const crypto = require('crypto')

// import math.js
const Math = require('mathjs')

// ----------------------------------------------------------------------------
// ------------------------------- AUTH functions------------------------------
// ----------------------------------------------------------------------------

// auth trigger (new user signup)
exports.newUserSignup = functions.auth.user().onCreate((user) => {
  return admin
    .firestore()
    .collection('users')
    .doc(user.uid)
    .set({
      email: user.email,
      userName: '',
      termsOfReference: true,
      apiKeys: {},
      currency: 'USD',
      taxRate: 0,
      plan: '',
      planName: '',
      updateApiPreferences: {
        yahooFinance: 'never',
        coinRanking: 'never',
      },
      investmentTableColumns: {
        detailBrokerageAccount: [
          'symbol',
          'country',
          'shareAmount',
          'averagePrice',
          'regularMarketPrice',
          'totalReturn',
          'dividendYield',
          'marketValueFull',
          'incomeYearFull',
          'actions',
        ],
        detailRealEstate: [
          'symbol',
          'country',
          'shareAmount',
          'averagePrice',
          'regularMarketPrice',
          'totalReturn',
          'dividendYield',
          'marketValueFull',
          'incomeYearFull',
          'actions',
        ],
        detailFixedIncome: [
          'symbol',
          'country',
          'shareAmount',
          'averagePrice',
          'regularMarketPrice',
          'totalReturn',
          'dividendYield',
          'marketValueFull',
          'incomeYearFull',
          'actions',
        ],
        detailCashSavings: [
          'symbol',
          'country',
          'totalInvested',
          'dividendYield',
          'marketValueFull',
          'incomeYearFull',
          'actions',
        ],
        detailCryptoAssets: [
          'symbol',
          'shareAmount',
          'averagePrice',
          'regularMarketPrice',
          'totalReturn',
          'marketValueFull',
          'actions',
        ],
        detailBusinessEquity: [
          'symbol',
          'country',
          'shareAmount',
          'averagePrice',
          'regularMarketPrice',
          'totalReturn',
          'dividendYield',
          'marketValueFull',
          'incomeYearFull',
          'actions',
        ],
        detailOthers: [
          'symbol',
          'country',
          'totalInvested',
          'dividendYield',
          'marketValueFull',
          'incomeYearFull',
          'actions',
        ],
      },
    })
})

// auth trigger (new user delete)
exports.userDeleted = functions.auth.user().onDelete((user) => {
  const doc = admin.firestore().collection('users').doc(user.uid)
  return doc.delete()
})

// ----------------------------------------------------------------------------
// ------------------------------- SCHEDULED functions-------------------------
// ----------------------------------------------------------------------------
// function to run a normal rapiAPI call (get currency exchange),
// the returned value will be used in the scheduled function
const getCurrencyExchange = async () => {
  const options = {
    method: 'GET',
    url: 'https://exchangerate-api.p.rapidapi.com/rapid/latest/USD',
    headers: {
      'x-rapidapi-key': 'xyz',
      'x-rapidapi-host': 'exchangerate-api.p.rapidapi.com',
    },
  }

  try {
    const response = await axios.request(options)
    const currencyExchangeDict = response.data
    return currencyExchangeDict
  } catch (error) {
    functions.logger(error)
  }

  // old code from the fixer-currency-endopoint - not longer working
  /* const options = {
    method: "GET",
    url: "https://fixer-fixer-currency-v1.p.rapidapi.com/latest",
    params: {base: "USD", symbols: "GBP,JPY,EUR,AUD,CAD,CHF,HKD,INR,NOK,SEK"},
    headers: {
      "X-RapidAPI-Key": "xyz",
      "X-RapidAPI-Host": "fixer-fixer-currency-v1.p.rapidapi.com",
    },
  };
  const response = await axios.request(options);
  const rapidApiResponse = response.data;
  const currencyExchangeDict = rapidApiResponse;
  return currencyExchangeDict; */
}

// scheduled function to save the Fixer Currency data into Firestore database
exports.scheduledFixerCurrency = functions.pubsub.schedule('0 19 * * *').onRun(async (context) => {
  // Save data to firestore in dailyData doc
  const currencyExchangeDict = await getCurrencyExchange()
  const writeResult = await admin
    .firestore()
    .collection('apiData')
    .doc('dailyCurrencyExchange')
    .set({
      currencyExchangeDict,
    })

  // send response to client that saving to database was succesful
  functions.logger.info(writeResult)
  functions.logger.info('daily update of currency exchange data succesful')
  return null
})

// scheduled function to write networthand annual keymetrics to all users
const writeNetworth = async (userId) => {
  const currentDate = new Date().toJSON().slice(0, 10)
  const timestamp = new Date(currentDate).getTime()
  const year = new Date(timestamp).getFullYear()
  let month = new Date(timestamp).getMonth() + 1
  if (month < 10) {
    month = '0' + month.toString()
  } else {
    month.toString()
  }

  const id = `${year.toString()}` + month

  const netWorthColRef = admin.firestore().collection('users').doc(userId).collection('networth')

  const netWorthDocs = await netWorthColRef.get()
  const documents = {}
  netWorthDocs.forEach((doc) => {
    let lastMonth = 0
    let networthAssets = {}
    let networthLiabilities = {}
    let networthTotals = {}

    try {
      const data = doc.data()
      const keysArray = Object.keys(data)
      const networthNumb = keysArray.map((element) => Number(element))
      lastMonth = networthNumb.length > 0 ? Math.max(networthNumb) : 0
      const lastMonthString = lastMonth.toString()

      switch (doc.id) {
        case 'networthAssetsDoc':
          networthAssets = doc.data()[lastMonthString]
          networthAssets.date = currentDate
          networthAssets.timestamp = timestamp
          documents.networthAssetsDoc = networthAssets
          break
        case 'networthLiabilitiesDoc':
          networthLiabilities = doc.data()[lastMonthString]
          networthLiabilities.date = currentDate
          networthLiabilities.timestamp = timestamp
          documents.networthLiabilitiesDoc = networthLiabilities
          break
        case 'networthTotalDoc':
          networthTotals = doc.data()[lastMonthString]
          networthTotals.date = currentDate
          networthTotals.timestamp = timestamp
          documents.networthTotalDoc = networthTotals
          break
      }
    } catch (error) {
      functions.logger.info('storeNetworth not able to update when deleting data')
    }
  })

  const writeAssetsDoc = await admin
    .firestore()
    .collection('users')
    .doc(userId)
    .collection('networth')
    .doc('networthAssetsDoc')
    .update({
      [id]: documents.networthAssetsDoc,
    })

  const writeLiabilitiesDoc = await admin
    .firestore()
    .collection('users')
    .doc(userId)
    .collection('networth')
    .doc('networthLiabilitiesDoc')
    .update({
      [id]: documents.networthLiabilitiesDoc,
    })

  const writeNetworthTotals = await admin
    .firestore()
    .collection('users')
    .doc(userId)
    .collection('networth')
    .doc('networthTotalDoc')
    .update({
      [id]: documents.networthTotalDoc,
    })
}

const writeKeyMetrics = async (userId) => {
  const currentDate = new Date().toJSON().slice(0, 10)
  const timestamp = new Date(currentDate).getTime()
  const year = new Date(timestamp).getFullYear()

  const id = year.toString()

  const annualMetricsColRef = admin
    .firestore()
    .collection('users')
    .doc(userId)
    .collection('keyMetrics')

  const keyMetricsDocs = await annualMetricsColRef.get()
  const documents = {}
  keyMetricsDocs.forEach((doc) => {
    let lastYear = 0
    let metricsExpenses = {}
    let metricsIncomeDoc = {}
    let metricsSavingsDoc = {}

    try {
      const data = doc.data()
      const keysArray = Object.keys(data)
      const keyMetricsKeysNumb = keysArray.map((element) => Number(element))
      lastYear = keyMetricsKeysNumb.length > 0 ? Math.max(keyMetricsKeysNumb) : 0
      const lastYearString = lastYear.toString()

      switch (doc.id) {
        case 'metricsExpensesDoc':
          metricsExpenses = doc.data()[lastYearString]
          metricsExpenses.date = currentDate
          metricsExpenses.timestamp = timestamp
          documents.metricsExpensesDoc = metricsExpenses
          break
        case 'metricsIncomeDoc':
          metricsIncomeDoc = doc.data()[lastYearString]
          metricsIncomeDoc.date = currentDate
          metricsIncomeDoc.timestamp = timestamp
          documents.metricsIncomeDoc = metricsIncomeDoc
          break
        case 'metricsSavingsDoc':
          metricsSavingsDoc = doc.data()[lastYearString]
          metricsSavingsDoc.date = currentDate
          metricsSavingsDoc.timestamp = timestamp
          documents.metricsSavingsDoc = metricsSavingsDoc
          break
      }
    } catch (error) {
      functions.logger.info('keyMetrics not able to update when deleting data')
    }
  })

  const writeExpensesDoc = await admin
    .firestore()
    .collection('users')
    .doc(userId)
    .collection('keyMetrics')
    .doc('metricsExpensesDoc')
    .update({
      [id]: documents.metricsExpensesDoc,
    })

  const writeLiabilitiesDoc = await admin
    .firestore()
    .collection('users')
    .doc(userId)
    .collection('keyMetrics')
    .doc('metricsIncomeDoc')
    .update({
      [id]: documents.metricsIncomeDoc,
    })

  const writeNetworthTotals = await admin
    .firestore()
    .collection('users')
    .doc(userId)
    .collection('keyMetrics')
    .doc('metricsSavingsDoc')
    .update({
      [id]: documents.metricsSavingsDoc,
    })
}

// ("0 0 31 12 *")
exports.scheduledWriteAnnualMetrics = functions.pubsub
  .schedule('0 0 31 12 *')
  .onRun(async (context) => {
    // Save data to firestore in dailyData doc
    const listAllUsers = (nextPageToken) => {
      // List batch of users, 1000 at a time.
      admin
        .auth()
        .listUsers(1000, nextPageToken)
        .then((listUsersResult) => {
          listUsersResult.users.forEach((userRecord) => {
            const userId = userRecord.toJSON().uid
            writeNetworth(userId)
            writeKeyMetrics(userId)
          })
          if (listUsersResult.pageToken) {
            // List next batch of users.
            listAllUsers(listUsersResult.pageToken)
          }
        })
        .catch((error) => {
          console.log('Error listing users:', error)
        })
    }
    // Start looping users from the beginning, 1000 at a time.
    listAllUsers()
    functions.logger.info('key metrics updated succesfully')
    return null
  })

// ----------------------------------------------------------------------------
// ------------------------------- call functions------------------------------
// ----------------------------------------------------------------------------
exports.saveApiKeys = functions
  .runWith({ secrets: ['MY_SECRET_KEY'] })
  .https.onCall(async (data, context) => {
    try {
      const secretKey = process.env.MY_SECRET_KEY
      const apiKey = data.apiKey
      const path = data.path
      functions.logger.info(data.apiKey, data.path)
      const userId = context.auth.uid

      // Hash the secret key using SHA-256
      const hashedSecretKey = crypto.createHash('sha256').update(secretKey).digest('hex')
      const iv = crypto.randomBytes(16)
      const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(hashedSecretKey, 'hex'), iv)

      let encryptedApiKey = cipher.update(apiKey, 'utf8', 'hex')
      encryptedApiKey += cipher.final('hex')
      const combinedData = iv.toString('hex') + encryptedApiKey

      const docRef = admin.firestore().collection('users').doc(userId)
      await docRef.update({
        [path]: combinedData,
      })

      return 'success, apiKey updated'
    } catch (e) {
      functions.logger.info(e)
      return 'error, something went wrong'
    }
  })

// code from chatGTP
exports.updateYahooFinance = functions
  .runWith({ secrets: ['MY_SECRET_KEY'] })
  .https.onCall(async (data, context) => {
    const mySymbol = data.symbols
    const myRegion = data.region

    const userId = context.auth.uid
    const docRef = admin.firestore().collection('users').doc(userId)
    const doc = await docRef.get()

    const secretKey = process.env.MY_SECRET_KEY
    const apiKey = doc.data().apiKeys.yahooFinanceRapidApiKey

    const storedIv = Buffer.from(apiKey.slice(0, 32), 'hex')
    const encryptedApiKey = apiKey.slice(32)

    const hashedSecretKey = crypto.createHash('sha256').update(secretKey).digest('hex')

    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(hashedSecretKey, 'hex'),
      storedIv,
    )

    let decryptedApiKey = decipher.update(encryptedApiKey, 'hex', 'utf8')
    decryptedApiKey += decipher.final('utf8')

    const url = 'https://apidojo-yahoo-finance-v1.p.rapidapi.com/market/v2/get-quotes'

    const options = {
      method: 'GET',
      url,
      params: {
        region: myRegion,
        symbols: mySymbol,
      },
      headers: {
        'X-RapidAPI-Key': decryptedApiKey,
        'X-RapidAPI-Host': 'apidojo-yahoo-finance-v1.p.rapidapi.com',
      },
    }

    try {
      const response = await axios.request(options)
      const yahooResponse = response.data.quoteResponse
      return yahooResponse
    } catch (error) {
      return 'error'
    }
  })
/* exports.updateYahooFinance =
functions.https.onCall(async (data, context) => {
  const mySymbol = data.symbols;
  const myRegion = data.region;

  // ------------------- decrypt apiKey ---------------------------
  const userId = context.auth.uid;
  const docRef = admin.firestore().collection("users").doc(userId);
  const doc = await docRef.get();
  const secretKey = mySecretKey.value();
  const apiKey = doc.data().apiKeys.yahooFinanceRapidApiKey;
  const storedIv = Buffer.from(apiKey.slice(0, 32), "hex");
  const encryptedApiKey = apiKey.slice(32);
  const hashedSecretKey = crypto.createHash(
      "sha256").update(secretKey).digest("hex");

  const decipher = crypto.createDecipheriv(
      "aes-256-cbc", Buffer.from(hashedSecretKey, "hex"), storedIv);

  let decryptedApiKey = decipher.update(encryptedApiKey, "hex", "utf8");
  decryptedApiKey += decipher.final("utf8");

  // -------------------------- rapid API call ------------------------------
  const options = {
    method: "GET",
    url: "https://apidojo-yahoo-finance-v1.p.rapidapi.com/market/v2/get-quotes",
    params: {region: myRegion, symbols: mySymbol},
    headers: {
      "X-RapidAPI-Key": decryptedApiKey,
      "X-RapidAPI-Host": "apidojo-yahoo-finance-v1.p.rapidapi.com",
    },
  };

  try {
    const response = await axios.request(options);
    const yahooResponse = response.data.quoteResponse;
    return yahooResponse;
  } catch (error) {
    const message = "error";
    return message;
  }
}); */

exports.updateCoinRanking = functions
  .runWith({ secrets: ['MY_SECRET_KEY'] })
  .https.onCall(async (data, context) => {
    try {
      const userId = context.auth.uid
      const docRef = admin.firestore().collection('users').doc(userId)
      const doc = await docRef.get()
      const secretKey = process.env.MY_SECRET_KEY
      const apiKey = doc.data()?.apiKeys?.CoinrankingRapidApiKey
      const storedIv = Buffer.from(apiKey.slice(0, 32), 'hex')
      const encryptedApiKey = apiKey.slice(32)

      const hashedSecretKey = crypto.createHash('sha256').update(secretKey).digest('hex')

      const decipher = crypto.createDecipheriv(
        'aes-256-cbc',
        Buffer.from(hashedSecretKey, 'hex'),
        storedIv,
      )

      let decryptedApiKey = decipher.update(encryptedApiKey, 'hex', 'utf8')
      decryptedApiKey += decipher.final('utf8')

      const response = await axios.get('https://coinranking1.p.rapidapi.com/coins', {
        params: {
          limit: 50,
          offset: 0,
        },
        headers: {
          'x-rapidapi-key': decryptedApiKey,
          'x-rapidapi-host': 'coinranking1.p.rapidapi.com',
          'Content-Type': 'application/json',
        },
      })

      return response.data
    } catch (error) {
      functions.logger.error('updateCoinRanking FAILED', {
        message: error?.message,
        stack: error?.stack,
        status: error?.response?.status,
        data: error?.response?.data,
      })
      throw new functions.https.HttpsError('internal', 'failed')
    }
  })

exports.getSymbolChartData = functions
  .runWith({ secrets: ['MY_SECRET_KEY'] })
  .https.onCall(async (data, context) => {
    // ------------------- decrypt apiKey ---------------------------
    const userId = context.auth.uid
    const docRef = admin.firestore().collection('users').doc(userId)
    const doc = await docRef.get()
    const secretKey = process.env.MY_SECRET_KEY
    const apiKey = doc.data().apiKeys.yahooFinanceRapidApiKey
    const storedIv = Buffer.from(apiKey.slice(0, 32), 'hex')
    const encryptedApiKey = apiKey.slice(32)
    const hashedSecretKey = crypto.createHash('sha256').update(secretKey).digest('hex')

    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(hashedSecretKey, 'hex'),
      storedIv,
    )

    let decryptedApiKey = decipher.update(encryptedApiKey, 'hex', 'utf8')
    decryptedApiKey += decipher.final('utf8')

    // -------------------------- rapid API call ------------------------
    const mySymbol = data
    functions.logger.info(mySymbol)

    const options = {
      method: 'GET',
      url: 'https://apidojo-yahoo-finance-v1.p.rapidapi.com/stock/v3/get-chart',
      params: {
        interval: '1mo',
        region: 'US',
        symbol: mySymbol,
        range: '10y',
        includePrePost: 'false',
        useYfid: 'true',
        includeAdjustedClose: 'true',
        events: 'capitalGain,div,split',
      },
      headers: {
        'x-rapidapi-key': decryptedApiKey,
        'x-rapidapi-host': 'apidojo-yahoo-finance-v1.p.rapidapi.com',
      },
    }

    try {
      const response = await axios.request(options)
      return response.data
    } catch (error) {
      functions.logger.info(error)
    }
  })

exports.getSymbolFinancials = functions
  .runWith({ secrets: ['MY_SECRET_KEY'] })
  .https.onCall(async (data, context) => {
    // ------------------- decrypt apiKey ---------------------------
    const userId = context.auth.uid
    const docRef = admin.firestore().collection('users').doc(userId)
    const doc = await docRef.get()
    const secretKey = process.env.MY_SECRET_KEY
    const apiKey = doc.data().apiKeys.yahooFinanceRapidApiKey
    const storedIv = Buffer.from(apiKey.slice(0, 32), 'hex')
    const encryptedApiKey = apiKey.slice(32)
    const hashedSecretKey = crypto.createHash('sha256').update(secretKey).digest('hex')

    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(hashedSecretKey, 'hex'),
      storedIv,
    )

    let decryptedApiKey = decipher.update(encryptedApiKey, 'hex', 'utf8')
    decryptedApiKey += decipher.final('utf8')

    // -------------------------- rapid API call ------------------------
    const symbolOptions = data
    for (let i = 0; i < 2; i++) {
      // get symbol
      const mySymbol = symbolOptions[i]
      functions.logger.info('start symbol:', mySymbol)

      // get rapidApi data
      // income statement
      const incomeStatementOptions = {
        method: 'GET',
        url: 'https://apidojo-yahoo-finance-v1.p.rapidapi.com/stock/v2/get-financials',
        params: {
          symbol: mySymbol,
          region: 'US',
        },
        headers: {
          'x-rapidapi-key': decryptedApiKey,
          'x-rapidapi-host': 'apidojo-yahoo-finance-v1.p.rapidapi.com',
        },
      }

      // cashflow
      const cashflowOptions = {
        method: 'GET',
        url: 'https://apidojo-yahoo-finance-v1.p.rapidapi.com/stock/v2/get-cash-flow',
        params: {
          symbol: mySymbol,
          region: 'US',
        },
        headers: {
          'x-rapidapi-key': decryptedApiKey,
          'x-rapidapi-host': 'apidojo-yahoo-finance-v1.p.rapidapi.com',
        },
      }

      // balance sheet
      const balanceSheetOptions = {
        method: 'GET',
        url: 'https://apidojo-yahoo-finance-v1.p.rapidapi.com/stock/v2/get-balance-sheet',
        params: {
          symbol: mySymbol,
          region: 'US',
        },
        headers: {
          'x-rapidapi-key': decryptedApiKey,
          'x-rapidapi-host': 'apidojo-yahoo-finance-v1.p.rapidapi.com',
        },
      }
      try {
        functions.logger.info('entering try block')
        const incomeStatement = await axios.request(incomeStatementOptions)
        const cashflow = await axios.request(cashflowOptions)
        const balanceSheet = await axios.request(balanceSheetOptions)
        functions.logger.info(incomeStatement)
        functions.logger.info(cashflow)
        functions.logger.info(balanceSheet)

        const response = {
          incomeStatement: incomeStatement.data.timeSeries,
          cashflow: cashflow.data.timeSeries,
          balanceSheet: balanceSheet.data.timeSeries,
        }
        functions.logger.info(response)
      } catch (error) {
        functions.logger.info('entering catch block')
        functions.logger.info(error)
        const response = {
          incomeStatement: {},
          cashflow: {},
          balanceSheet: {},
        }
      }

      /* const mySymbol = data;

    // income statement
    const incomeStatementOptions = {
      method: "GET",
      url: "https://apidojo-yahoo-finance-v1.p.rapidapi.com/stock/v2/get-financials",
      params: {
        symbol: mySymbol,
        region: "US",
      },
      headers: {
        "x-rapidapi-key": decryptedApiKey,
        "x-rapidapi-host": "apidojo-yahoo-finance-v1.p.rapidapi.com",
      },
    };

    // cashflow
    const cashflowOptions = {
      method: "GET",
      url: "https://apidojo-yahoo-finance-v1.p.rapidapi.com/stock/v2/get-cash-flow",
      params: {
        symbol: mySymbol,
        region: "US",
      },
      headers: {
        "x-rapidapi-key": decryptedApiKey,
        "x-rapidapi-host": "apidojo-yahoo-finance-v1.p.rapidapi.com",
      },
    };

    // balance sheet
    const balanceSheetOptions = {
      method: "GET",
      url: "https://apidojo-yahoo-finance-v1.p.rapidapi.com/stock/v2/get-balance-sheet",
      params: {
        symbol: mySymbol,
        region: "US",
      },
      headers: {
        "x-rapidapi-key": decryptedApiKey,
        "x-rapidapi-host": "apidojo-yahoo-finance-v1.p.rapidapi.com",
      },
    };
    try {
      const incomeStatement = await axios.request(incomeStatementOptions);
      const cashflow = await axios.request(cashflowOptions);
      const balanceSheet = await axios.request(balanceSheetOptions);

      const response = {
        incomeStatement: incomeStatement.data.timeSeries,
        cashflow: cashflow.data.timeSeries,
        balanceSheet: balanceSheet.data.timeSeries,
      };
      return response;
    } catch (error) {
      functions.logger.info(error);
      const response = {
        incomeStatement: {},
        cashflow: {},
        balanceSheet: {},
      };
      return response;
    } */
    }
    return 'finished'
  })
