<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------ TEMPLATE --------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<template>
  <div style="max-width: 1100px; margin: auto">
    <div
      class="q-mb-sm q-mt-none q-py-xs shadow-1 white-container"
      style="display: block; width: 100%"
    >
      <!--------------------------------------- investment list ------------------------------------->
      <div v-if="investmentView === 'main'" class="q-pt-md">
        <div style="display: flex; flex-wrap: wrap">
          <div style="display: block; min-width: 400px; width: 50%; padding-right: 10px">
            <p style="font-size: 16px; text-align: center"><strong>Investments details</strong></p>

            <q-list v-for="card in cardsInfo" :key="card.id" dense>
              <q-item>
                <q-item-section avatar>
                  <q-avatar>
                    <q-icon :name="card.icon" size="sm" />
                  </q-avatar>
                </q-item-section>

                <q-item-section style="font-size: 14px">
                  {{ card.name }}
                </q-item-section>

                <q-item-section>
                  <q-btn
                    flat
                    no-caps
                    :icon="card.iconSearch"
                    @click="
                      ((detailView = card.name),
                      (investmentView = ''),
                      (detailViewName = card.detailName))
                    "
                  />
                </q-item-section>
              </q-item>
            </q-list>
          </div>

          <div style="display: block; min-width: 400px; width: 50%; padding-right: 10px">
            <p style="font-size: 16px; text-align: center"><strong>Investments summary</strong></p>

            <div>
              <div>
                <q-radio v-model="chartView" val="marketValue" label="Market value" />
                <q-radio v-model="chartView" val="expectedIncome" label="Expected income" />
              </div>

              <div v-if="chartView === 'marketValue'">
                <p style="width: 90%">
                  Your Investments are worth
                  <strong>{{
                    totalMarketValue.toLocaleString('en-US', {
                      style: 'currency',
                      currency: currency,
                      maximumFractionDigits: 0,
                    })
                  }}</strong
                  >.
                </p>
                <div style="max-width: 75%; margin-left: 15px">
                  <GChart
                    type="PieChart"
                    :data="investmentSummaryMarketValue"
                    :options="chartOptions"
                  />
                </div>
              </div>

              <div v-else>
                <p style="width: 90%">
                  Your investments generates
                  <strong>{{
                    totalExpectedIncome.toLocaleString('en-US', {
                      style: 'currency',
                      currency: currency,
                      maximumFractionDigits: 0,
                    })
                  }}</strong>
                  a year.
                </p>
                <div style="max-width: 75%; margin-left: 15px">
                  <GChart
                    type="PieChart"
                    :data="investmentSummaryExpectedIncome"
                    :options="chartOptions"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!------------------------------ investment detail view ------------------------------------->
      <div v-else>
        <DetailInvestment :detail-name="detailViewName" @hide-detail="investmentView = 'main'" />
      </div>
    </div>

    <div
      v-if="investmentView === 'main'"
      class="q-mb-sm q-mt-none q-py-xs shadow-1 white-container"
      style="justify-content: space-between; width: 100%"
    >
      <q-btn
        class="q-ma-sm"
        flat
        padding="none"
        no-caps
        style="color: #14213d; margin-left: auto; margin-right: auto"
        @click="updateMarketData()"
      >
        Update YahooFinance

        <q-tooltip>
          You need a rapidApi Yahoo Finance account, if you don't have it, please create a free
          account and add your API key in the User Settings section.
        </q-tooltip>
      </q-btn>

      <q-btn
        class="q-ma-sm"
        flat
        padding="none"
        no-caps
        style="color: #14213d; margin-left: auto; margin-right: auto"
        @click="updateCryptoData()"
      >
        Update Coinranking

        <q-tooltip>
          You need a rapidApi Coinranking account, if you don't have it, please create a free
          account and add your API key in the User Settings section.
        </q-tooltip>
      </q-btn>
    </div>
  </div>
</template>

<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------- SCRIPT ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<!-- eslint-disable no-unused-vars -->
<script setup>
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useQuasar } from 'quasar'
import { db } from 'src/js/firebase'
import { doc, updateDoc } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { GChart } from 'vue-google-charts'

// import components
import DetailInvestment from './DetailInvestment.vue'

// import and declare stores
import { useStoreAuth } from 'src/stores/storeAuth'
import { useStoreInvestments } from 'src/stores/storeInvestments'
import { useStoreUserSettings } from 'src/stores/storeUserSettings'

const storeAuth = useStoreAuth()
const storeInvestments = useStoreInvestments()
const storeUserSettings = useStoreUserSettings()

const { getBrokerageData } = storeToRefs(storeInvestments)
const { userSettings } = storeToRefs(storeUserSettings)
const currency = userSettings.value.currency

// declare useQuasar (to use the "notify" plugin)
const $q = useQuasar()

// needed to call a firebase function
const functions = getFunctions()

// if investmentView === main, then it shows all cards, else wills show a detailed component
// if investmentView !=== main, the shows a specific detailed view according the detailView data (from @click in card actions)
const investmentView = ref('main')
const detailView = ref('')
const detailViewName = ref('')

// ------------------------- Investment details list (cards) -------------------------
const cardsInfo = ref([
  {
    id: 1,
    icon: 'o_candlestick_chart',
    name: 'Brokerage account',
    detailName: 'detailBrokerageAccount',
    link: '',
    iconSearch: 'search',
  },
  {
    id: 2,
    icon: 'o_home_work',
    name: 'Real estate',
    detailName: 'detailRealEstate',
    link: '',
    iconSearch: 'search',
  },
  {
    id: 3,
    icon: 'o_payments',
    name: 'Fixed-income',
    detailName: 'detailFixedIncome',
    link: '',
    iconSearch: 'search',
  },
  {
    id: 4,
    icon: 'o_currency_bitcoin',
    name: 'Cryptoassets',
    detailName: 'detailCryptoAssets',
    link: '',
    iconSearch: 'search',
  },
  {
    id: 5,
    icon: 'o_savings',
    name: 'Cash/savings',
    detailName: 'detailCashSavings',
    link: '',
    iconSearch: 'search',
  },
  {
    id: 6,
    icon: 'o_business_center',
    name: 'Business equity',
    detailName: 'detailBusinessEquity',
    link: '',
    iconSearch: 'search',
  },
  {
    id: 7,
    icon: 'o_deblur',
    name: 'Others',
    detailName: 'detailOthers',
    link: '',
    iconSearch: 'search',
  },
])

// ------------------------- Summary investments -------------------------
// chart data
const chartView = ref('marketValue')
const investmentSummary = getBrokerageData.value[1]
const investmentSummaryMarketValue = [['Category', 'Market value']]
const investmentSummaryExpectedIncome = [['Category', 'Expected income']]

const investmentSummaryKeys = Object.keys(investmentSummary)
investmentSummaryKeys.forEach((key) => {
  const annualExpectedIncome = investmentSummary[key].AnnualExpectedIncome
  const portofolioMarketValue = investmentSummary[key].portofolioMarketValue

  let category = ''
  switch (key) {
    case 'detailBrokerageAccount':
      category = 'Brokerage account'
      break
    case 'detailRealEstate':
      category = 'Real estate'
      break
    case 'detailFixedIncome':
      category = 'Fixed income'
      break
    case 'detailCryptoAssets':
      category = 'Cryptoassets'
      break
    case 'detailCashSavings':
      category = 'Cash/savings'
      break
    case 'detailOthers':
      category = 'Other investments'
  }
  investmentSummaryMarketValue.push([category, portofolioMarketValue])
  investmentSummaryExpectedIncome.push([category, annualExpectedIncome])
})

const totalMarketValue = investmentSummaryMarketValue
  .slice(1)
  .map((element) => element[1])
  .reduce((acc, cur) => acc + cur, 0)
const totalExpectedIncome = investmentSummaryExpectedIncome
  .slice(1)
  .map((element) => element[1])
  .reduce((acc, cur) => acc + cur, 0)

// desktop chart optinons
const chartOptions = {
  title: '',
  legend: 'none',
  pieSliceText: 'label',
  chartArea: {
    height: '100%',
    width: '100%',
    left: 0,
    right: 0,
    top: 0,
    bottom: 10,
  },
  height: 300,
}

// ---------------------------------------------------------------------------------------------
// ---------------------------------- update market data ---------------------------------------
// ---------------------------------------------------------------------------------------------

// get symbols to update, to be used in yahoofinance and coinRanking
const rapidApiSymbols = storeInvestments.getRapidApiSymbols

// ------------------------------------- update yahoo finance -------------------------------------
function updateMarketData() {
  $q.notify({
    message: 'Updating YahooFinance data, please wait...',
    color: 'positive',
    icon: 'check_circle',
    timeout: 4000,
  })
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
          // notify that an error has ocurred
          $q.notify({
            message:
              'An error has ocurred, data has not been updated. Make sure you have a valid YahooFinance API key and updte it in the settings section',
            color: 'negative',
            icon: 'check_circle',
            timeout: 2000,
          })
        } else {
          for (let i = 0; i < resultData.length; i++) {
            const symbol = resultData[i].symbol
            categoriesKeys.forEach(async (category) => {
              if (categories[category].includes(symbol)) {
                await updateDoc(doc(db, 'users', storeAuth.user.id, category, symbol), {
                  apiData: resultData[i],
                })
              }
            })
          }
          // notify that form saving was done succesfully
          $q.notify({
            message: 'Data added to database',
            color: 'positive',
            icon: 'check_circle',
            timeout: 1000,
          })
        }
      })
    }
  } catch {
    // notify that an error has ocurred
    $q.notify({
      message:
        'An error has ocurred, data has not been updated. Make sure you have a valid YahooFinance API key and update it in the settings section',
      color: 'negative',
      icon: 'check_circle',
      timeout: 1000,
    })
  }
}

// ---------------------------------------- update coinranking -------------------------------------
function updateCryptoData() {
  $q.notify({
    message: 'Updating Coinranking data, please wait...',
    color: 'positive',
    icon: 'check_circle',
    timeout: 4000,
  })

  try {
    const coinRankingSymbolsList = rapidApiSymbols.coinRanking

    const updateCoinRanking = httpsCallable(functions, 'updateCoinRanking')
    updateCoinRanking()
      .then((result) => {
        const resultData = result.data
        console.log('resultData:', resultData)

        if (result.data === 'error') {
          $q.notify({
            message:
              'An error has ocurred, data has not been updated. Make sure you have a valid Coinranking API key and updte it in the settings section',
            color: 'negative',
            icon: 'check_circle',
            timeout: 3000,
          })
        } else {
          const coins = resultData.data.coins

          coins.forEach(async (coin) => {
            if (!coinRankingSymbolsList.includes(coin.symbol)) return

            await updateDoc(
              doc(db, 'users', storeAuth.user.id, 'detailCryptoAssets', coin.symbol),
              {
                apiData: coin,
              },
            )
          })

          $q.notify({
            message: 'Data added to database',
            color: 'positive',
            icon: 'check_circle',
            timeout: 1000,
          })
        }
      })
      .catch((error) => {
        console.error('updateCryptoData error:', error)

        $q.notify({
          message:
            'An error has ocurred, data has not been updated. Make sure you have a valid Coinranking API key and update it in the settings section',
          color: 'negative',
          icon: 'check_circle',
          timeout: 3500,
        })
      })
  } catch (error) {
    console.error('updateCryptoData error:', error)

    $q.notify({
      message:
        'An error has ocurred, data has not been updated. Make sure you have a valid Coinranking API key and update it in the settings section',
      color: 'negative',
      icon: 'check_circle',
      timeout: 3500,
    })
  }
}
/* function updateCryptoData () {
  $q.notify({
    message: 'Updating Coinranking data, please wait...',
    color: 'positive',
    icon: 'check_circle',
    timeout: 4000
  })

  try {
    const coinRankingSymbolsList = rapidApiSymbols.coinRanking

    const updateCoinRanking = httpsCallable(functions, 'updateCoinRanking')
    updateCoinRanking().then((result) => {
    // get response from rapidApi
      const resultData = result.data
      console.log('resultData: ', resultData)
      if (result.data === 'error') {
        // notify that an error has ocurred
        $q.notify({
          message: 'An error has ocurred, data has not been updated. Make sure you have a valid Coinranking API key and updte it in the settings section',
          color: 'negative',
          icon: 'check_circle',
          timeout: 3000
        })
      } else {
        const coins = resultData.data.coins
        coinRankingSymbolsList.forEach(async (symbol) => {
          const symbolData = coins.find((element) => element.symbol === symbol)
          await updateDoc(doc(db, 'users', storeAuth.user.id, 'detailCryptoAssets', symbol), {
            apiData: symbolData
          })
        })

        // notify that form saving was done succesfully
        $q.notify({
          message: 'Data added to database',
          color: 'positive',
          icon: 'check_circle',
          timeout: 1000
        })
      }
    })
  } catch {
    // notify that an error has ocurred
    $q.notify({
      message: 'An error has ocurred, data has not been updated. Make sure you have a valid Coinranking API key and updte it in the settings section',
      color: 'negative',
      icon: 'check_circle',
      timeout: 3500
    })
  }
} */
</script>

<!------------------------------------------------------------------------------------------------------->
<!-------------------------------------------- STYLE ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<style scoped></style>
