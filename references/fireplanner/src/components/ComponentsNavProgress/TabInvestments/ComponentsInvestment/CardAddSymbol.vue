<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------ TEMPLATE --------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<template>
  <div>
    <q-card style="width: 500px; max-width: 80vw; height: 100vh">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">Add a new symbol</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <q-form
          class="q-pr-md"
          style="width: 100%; display: block"
          @submit.prevent="onSubmitNewCompany"
          @reset="onResetNewCompany"
        >
          <!----------------------------- form fields ---------------------->
          <p class="q-ml-md" style="font-size: 16px; margin-bottom: 0px">
            1. Add the basic information
          </p>

          <!-- select average price, numbers with decimals use masks-->
          <q-input class="q-ml-md" v-model="symbolModel" label="Symbol" />
          <!-- select region -->
          <q-select
            v-if="investmentDetailName !== 'detailCryptoAssets'"
            class="q-ml-md"
            v-model="regionModel"
            use-input
            hide-selected
            fill-input
            input-debounce="0"
            :options="optionsSelectRegion"
            label="Select market"
          />

          <!-- select company sector -->
          <q-select
            v-if="investmentDetailName !== 'detailCryptoAssets'"
            class="q-ml-md"
            v-model="sector"
            :options="sectors"
            label="Sector"
          />

          <!-- select company supersector -->
          <q-select
            v-if="investmentDetailName === 'detailBrokerageAccount'"
            class="q-ml-md"
            v-model="supersector"
            :options="supersectors"
            label="Supersector"
          />

          <p class="q-mt-lg q-ml-md" style="font-size: 16px; margin-bottom: 0px">
            2. Add the information of your initial "Buy order"
          </p>

          <!-- selech purchase date -->
          <q-input class="q-ml-md" v-model="date" type="date" label="date" />

          <!-- select amount of shares -->
          <q-input
            class="q-ml-md"
            v-model.number="shareAmount"
            type="number"
            step="0.001"
            label="Number of shares"
          />

          <!-- select average price, numbers with decimals use masks-->
          <q-input
            class="q-ml-md"
            v-model="sharePrice"
            label="Share price"
            mask="#.##"
            fill-mask="0"
            reverse-fill-mask
          />

          <!-- form submit button -->
          <div class="q-mt-md q-mb-sm q-mr-xs float-right">
            <q-btn style="height: 75%" label="Save" type="submit" rounded color="orange" no-caps />

            <!-- reset button -->
            <q-btn
              class="on-right"
              style="height: 75%"
              label="Reset"
              type="reset"
              rounded
              color="deep-orange"
              no-caps
            />
          </div>
        </q-form>
      </q-card-section>
    </q-card>
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
import { doc, setDoc, updateDoc } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'

// import and declare stores
import { useStoreAuth } from 'src/stores/storeAuth'
import { useStoreInvestments } from 'src/stores/storeInvestments'
const storeAuth = useStoreAuth()
const storeInvestments = useStoreInvestments()
const { allOrderList } = storeToRefs(storeInvestments)

// declare useQuasar (to use the "notify" plugin)
const $q = useQuasar()

// needed to call a firebase function
const functions = getFunctions()

// props recieved from parent company (investmentTable component)
const props = defineProps(['addCompanyProps'])
const investmentDetailName = ref(props.addCompanyProps.investmentDetailName)

// ---------------------------------------- Form inputs ------------------------------------------------------
// symbol input
const symbolModel = ref(null)

// market dropdown
const regionModel = ref(null)
const optionsSelectRegion = ['US', 'BR', 'AU', 'CA', 'FR', 'DE', 'HK', 'IN', 'IT', 'ES', 'GB', 'SG']

// sector and supsector list
const sector = ref(null)
const sectors = ref(props.addCompanyProps.inputs.sectors)

const supersector = ref(null)
const supersectors = ref(props.addCompanyProps.inputs.supersectors)

// date input
const currentDate = new Date().toJSON().slice(0, 10)
const date = ref(currentDate)

// amount of shares and price inputs
const shareAmount = ref(0)
const sharePrice = ref(0.0)

// ----------------------------------------- Save data to ddbb ------------------------------------------------
const rows = ref(props.addCompanyProps.rows) // from detailXXX component passed to investmentsTable and then to here

function symbolMatches(savedSymbol, inputSymbol) {
  return String(savedSymbol || '').toUpperCase() === String(inputSymbol || '').toUpperCase()
}

function getExistingSymbolData(symbol) {
  const detailedOrderList = allOrderList.value[investmentDetailName.value] || []
  return detailedOrderList.find((element) => symbolMatches(element.generalInfo.symbol, symbol))
}

function visibleSymbolAlreadyExists(symbol) {
  return rows.value.some((element) => symbolMatches(element.symbol, symbol))
}

async function addOrderToExistingSymbol(symbol, timestamp, newOrder, apiData) {
  await updateDoc(doc(db, 'users', storeAuth.user.id, investmentDetailName.value, symbol), {
    [`orderInfo.${timestamp}`]: newOrder,
    apiData,
  })

  $q.notify({
    message: 'data added to existing symbol without deleting historical data',
    color: 'positive',
    icon: 'check_circle',
    timeout: 5000,
  })
}

// function to get symbol data from yahooFinance
function updateMarketData() {
  const symbols = symbolModel.value
  const region = 'US'

  $q.notify({
    message: 'Getting data from YahooFinance, please wait',
    color: 'positive',
    icon: 'check_circle',
    timeout: 5000,
  })

  // const returnApiStatus = ''
  return new Promise((resolve, reject) => {
    const updateYahooFinance = httpsCallable(functions, 'updateYahooFinance')
    updateYahooFinance({ region, symbols })
      .then((result) => {
        const resultData = result.data.result

        if (resultData.length === 0) {
          $q.notify({
            message: 'Symbol not found, please try again',
            color: 'negative',
            icon: 'report_problem',
            timeout: 1000,
          })
          reject('Symbol not found')
        } else {
          // notify that form saving was done successfully
          $q.notify({
            message: 'Data from yahoo was found',
            color: 'positive',
            icon: 'check_circle',
            timeout: 1000,
          })

          const data = {
            apiData: resultData,
            check: 'ok',
          }

          resolve(data)
        }
      })
      .catch((error) => {
        console.error('Error in updateYahooFinance:', error)
        $q.notify({
          message: 'Error getting data from yahooFinance, please try again',
          color: 'negative',
          icon: 'report_problem',
          timeout: 1000,
        })
        reject('Error updating market data')
      })
  })
}

// function to get and save data from coinranking (rapidApi)
function updateCryptotData() {
  $q.notify({
    message: 'Getting data from CoinRanking, please wait',
    color: 'positive',
    icon: 'check_circle',
    timeout: 5000,
  })

  return new Promise((resolve, reject) => {
    const updateCoinRanking = httpsCallable(functions, 'updateCoinRanking')
    updateCoinRanking()
      .then((result) => {
        const symbol = symbolModel.value

        // get response from rapidApi
        const resultData = result.data
        const coins = resultData.data.coins.coins

        // select coin from symboModel.value
        const symbolData = coins.find((element) => element.symbol === symbol)

        if (typeof symbolData !== 'object') {
          reject('Symbol not found')
        } else {
          // notify that form saving was done successfully
          $q.notify({
            message: 'Data added to the database',
            color: 'positive',
            icon: 'check_circle',
            timeout: 1000,
          })

          const data = {
            apiData: symbolData,
            check: 'ok',
          }

          resolve(data)
        }
      })
      .catch((error) => {
        console.error('Error in getting data from CoinRanking:', error)
        reject('Error updating market data')
      })
  })
}

// save data to database, creates a new document into the "criptocurrency" collection
async function onSubmitNewCompany() {
  const symbol = symbolModel.value.toUpperCase()
  const timestamp = new Date(date.value).getTime()

  // ---------------------- save cryptocurrencies ------------------------
  if (investmentDetailName.value === 'detailCryptoAssets') {
    const generalInfo = {
      symbol,
      country: 'US',
      currency: 'USD',
    }

    const newOrder = {
      date: date.value,
      timestamp,
      buyOrSell: 'Buy',
      shareAmount: shareAmount.value,
      sharePrice: parseFloat(sharePrice.value),
      totalTransaction: shareAmount.value * sharePrice.value,
    }

    const orderInfo = {
      [timestamp]: newOrder,
    }

    const userInfo = {}

    const existingSymbolData = getExistingSymbolData(symbol)
    const symbolAlreadyVisible = visibleSymbolAlreadyExists(symbol)

    if (symbolAlreadyVisible === false) {
      updateCryptotData().then(async (data) => {
        if (existingSymbolData && data.check === 'ok') {
          await addOrderToExistingSymbol(
            existingSymbolData.generalInfo.symbol,
            timestamp,
            newOrder,
            data.apiData,
          )
        } else if (data.check === 'ok') {
          // Add a new document with the initial purchase
          await setDoc(doc(db, 'users', storeAuth.user.id, investmentDetailName.value, symbol), {
            generalInfo,
            orderInfo,
            userInfo,
            apiData: data.apiData,
          })

          $q.notify({
            message: 'data added to database',
            color: 'positive',
            icon: 'check_circle',
            timeout: 5000,
          })
        } else {
          // notify that form saving was done succesfully
          $q.notify({
            message:
              'This symbol already exist in your database, to modify it use the buttons on the action column of the portofolio table',
            color: 'negative',
            icon: 'report_problem',
            timeout: 2500,
          })
        }
      })
    } else {
      $q.notify({
        message:
          'This symbol already exist in your database, to modify it use the buttons on the action column of the portofolio table',
        color: 'negative',
        icon: 'report_problem',
        timeout: 2500,
      })
    }
    // ------------------------- save yahoofinance ---------------------------------
  } else {
    // detailBroker, reits, fixed income
    const generalInfo = {
      symbol,
      sector: sector.value,
      superSector: supersector.value,
      country: 'US',
    }

    const userInfo = {
      userStockPrice: 0.0,
      userStockDividend: 0.0,
      userStockPriceCheckBox: false,
      userStockDividendCheckBox: false,
      userRegion: regionModel.value,
      userRegionCheckBox: true,
    }

    const newOrder = {
      date: date.value,
      timestamp,
      buyOrSell: 'Buy',
      shareAmount: shareAmount.value,
      sharePrice: parseFloat(sharePrice.value),
      totalTransaction: shareAmount.value * sharePrice.value,
    }

    const orderInfo = {
      [timestamp]: newOrder,
    }

    // check if the symbols has already been added in the portofolio, only if false data will be added in the ddbb,
    // else will show a message indicating that the symbol already exists
    const existingSymbolData = getExistingSymbolData(symbol)
    const symbolAlreadyVisible = visibleSymbolAlreadyExists(symbol)

    if (symbolAlreadyVisible === false) {
      updateMarketData().then(async (data) => {
        if (existingSymbolData && data.check === 'ok') {
          await addOrderToExistingSymbol(
            existingSymbolData.generalInfo.symbol,
            timestamp,
            newOrder,
            data.apiData,
          )
        } else if (data.check === 'ok') {
          // Add a new document with the initial purchase
          await setDoc(doc(db, 'users', storeAuth.user.id, investmentDetailName.value, symbol), {
            generalInfo,
            userInfo,
            orderInfo,
            apiData: data.apiData,
          })

          $q.notify({
            message: 'data added to database',
            color: 'positive',
            icon: 'check_circle',
            timeout: 5000,
          })
        } else {
          // notify that form saving was done succesfully
          $q.notify({
            message: 'A problem has occurred, try again',
            color: 'negative',
            icon: 'report_problem',
            timeout: 2500,
          })
        }
      })
    } else {
      // notify that form saving was done succesfully
      $q.notify({
        message:
          'This symbol already exist in your database, to modify it use the buttons on the action column of the portofolio table',
        color: 'negative',
        icon: 'report_problem',
        timeout: 2500,
      })
    }
  }
}

async function onResetNewCompany() {
  console.log('new company reset')
}
</script>

<!------------------------------------------------------------------------------------------------------->
<!-------------------------------------------- STYLE ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<style scoped></style>
