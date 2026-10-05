<!-- eslint-disable dot-notation -->
<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------ TEMPLATE --------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<template>
  <div>
    <q-card style="width: 500px; max-width: 80vw; height: 100vh">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">Add a new Business</div>
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

          <!-- select symbol -->
          <q-input class="q-ml-md" v-model="symbolModel" label="Business name" />

          <!-- country -->
          <q-input class="q-ml-md" v-model="country" label="Country" />

          <!-- currency -->
          <q-select
            class="q-ml-md"
            v-model="currency"
            :options="currencyOptions"
            label="Currency"
          />

          <!-- select company sector -->
          <q-select class="q-ml-md" v-model="sector" :options="sectors" label="Sector" />

          <!-- select company supersector -->
          <q-select
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
            label="Number of shares"
          />

          <!-- select average price, numbers with decimals use masks-->
          <q-input
            class="q-ml-md"
            v-model.number="sharePrice"
            type="number"
            step="0.1"
            label="Share price"
          />

          <q-input
            class="q-ml-md"
            v-model.number="dividend"
            type="number"
            step="0.1"
            label="dividend per share"
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

// import and declare stores
import { useStoreAuth } from 'src/stores/storeAuth'
import { useStoreInvestments } from 'src/stores/storeInvestments'
const storeAuth = useStoreAuth()
const storeInvestments = useStoreInvestments()
const { allOrderList } = storeToRefs(storeInvestments)

// declare useQuasar (to use the "notify" plugin)
const $q = useQuasar()

// props recieved from parent company (investmentTable component)
const props = defineProps(['addCompanyProps'])
const investmentDetailName = ref(props.addCompanyProps.investmentDetailName)

// ---------------------------------------- Form inputs ---------------------------------------------------------
// Business name
const symbolModel = ref('')

// sector and supsector list
const sector = ref(null)
const sectors = ref(props.addCompanyProps.inputs.sectors)

const supersector = ref(null)
const supersectors = ref(props.addCompanyProps.inputs.supersectors)

// Business currency
const currencyOptions = ['EUR', 'USD', 'GBP']
const currency = ref('')

// Business country
const country = ref('')

// date input
const currentDate = new Date().toJSON().slice(0, 10)
const date = ref(currentDate)

// amount of shares and price inputs
const shareAmount = ref(0)
const sharePrice = ref(0.0)

// dividend yield
const dividend = ref(0)

// ----------------------------------------- Save data to ddbb ----------------------------------------------------
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

// save data to database, creates a new document into the "Savings" collection
async function onSubmitNewCompany() {
  const dateStr = date.value
  const timestamp = new Date(dateStr).getTime()

  const generalInfo = {
    symbol: symbolModel.value,
    country: country.value,
    currency: currency.value,
    sector: sector.value,
    superSector: supersector.value,
  }

  const newOrder = {
    buyOrSell: 'Buy',
    date: dateStr,
    timestamp,
    shareAmount: shareAmount.value,
    sharePrice: sharePrice.value,
    totalTransaction: shareAmount.value * sharePrice.value,
  }

  const orderInfo = {
    [timestamp]: newOrder,
  }

  const userInfo = {
    userStockPrice: sharePrice.value,
    userStockDividend: dividend.value,
    userStockPriceCheckBox: true,
    userStockDividendCheckBox: true,
    userRegion: country.value,
    userRegionCheckBox: true,
  }

  const existingSymbolData = getExistingSymbolData(symbolModel.value)
  const symbolAlreadyVisible = visibleSymbolAlreadyExists(symbolModel.value)

  if (symbolAlreadyVisible === false && existingSymbolData) {
    await updateDoc(
      doc(
        db,
        'users',
        storeAuth.user.id,
        investmentDetailName.value,
        existingSymbolData.generalInfo.symbol,
      ),
      {
        [`orderInfo.${timestamp}`]: newOrder,
      },
    )

    $q.notify({
      message: 'data added to existing symbol without deleting historical data',
      color: 'positive',
      icon: 'check_circle',
      timeout: 5000,
    })
  } else if (symbolAlreadyVisible === false) {
    // Add a new document with the initial purchase
    await setDoc(
      doc(db, 'users', storeAuth.user.id, investmentDetailName.value, symbolModel.value),
      {
        generalInfo,
        orderInfo,
        userInfo,
      },
    )

    // notify that form saving was done succesfully
    $q.notify({
      message: 'Data added to database',
      color: 'positive',
      icon: 'check_circle',
      timeout: 1000,
    })
  } else {
    // notify that form saving was done succesfully
    $q.notify({
      message:
        'This symbol already exist, to modify it use the buttons on the action column of the portofolio table',
      color: 'negative',
      icon: 'report_problem',
      timeout: 2500,
    })
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
