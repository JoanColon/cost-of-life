<!-- eslint-disable dot-notation -->
<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------ TEMPLATE --------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<template>
  <div>
    <q-card style="width: 500px; max-width: 80vw; height: 100vh">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">Add a new account/item</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <q-form
          class="q-pr-md"
          style="width: 100%; display: block"
          @submit.prevent="onSubmitNewName"
          @reset="onResetNewName"
        >
          <!-- form fields -->
          <q-input class="q-ml-md" v-model="symbol" label="Name" />

          <q-input class="q-ml-md" v-model="country" label="country" />

          <q-input
            class="q-ml-md"
            v-model="totalInvested"
            label="Total invested"
            mask="#.##"
            fill-mask="0"
            reverse-fill-mask
          />

          <q-input
            class="q-ml-md"
            v-model="dividendYield"
            label="Interest rate"
            mask="#.##"
            fill-mask="0"
            reverse-fill-mask
          >
            <template v-slot:append> % </template>
          </q-input>

          <q-select
            class="q-ml-md"
            v-model="currency"
            :options="currencyOptions"
            label="Currency"
          />

          <q-input class="q-ml-md" v-model="date" type="date" label="date" />

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
const props = defineProps(['addNameProps'])
const investmentDetailName = ref(props.addNameProps.investmentDetailName)

// ---------------------------------------- Form inputs ---------------------------------------------------------
// input fields
const symbol = ref('') // name input field
const country = ref('')
const totalInvested = ref(0) // total invested input field
const dividendYield = ref(0) // interest Rate input field

// currency select
const currency = ref('EUR')
const currencyOptions = ['EUR', 'USD', 'GBP']

// date input
const currentDate = new Date().toJSON().slice(0, 10)
const date = ref(currentDate)

// ----------------------------------------- Save data to ddbb ----------------------------------------------------
const rows = ref(props.addNameProps.rows) // from detailXXX component passed to investmentsTable and then to here

function symbolMatches(savedSymbol, inputSymbol) {
  return String(savedSymbol || '').toUpperCase() === String(inputSymbol || '').toUpperCase()
}

function getExistingSymbolData(symbol) {
  const detailedOrderList = allOrderList.value[investmentDetailName.value] || []
  return detailedOrderList.find((element) => symbolMatches(element.generalInfo.symbol, symbol))
}

function visibleSymbolAlreadyExists(inputSymbol) {
  return rows.value.some((element) => symbolMatches(element.symbol, inputSymbol))
}

async function onSubmitNewName() {
  const dateStr = date.value
  const timestamp = new Date(dateStr).getTime()

  const generalInfo = {
    symbol: symbol.value,
    country: country.value,
  }

  const newOrder = {
    date: dateStr,
    timestamp,
    buyOrSell: 'Buy',
    totalTransaction: parseFloat(totalInvested.value),
  }

  const orderInfo = {
    [timestamp]: newOrder,
  }

  const apiData = {
    currency: currency.value,
  }

  const userInfo = {
    marketValue: parseFloat(totalInvested.value),
    dividendYield: parseFloat(dividendYield.value) / 100,
  }

  const existingSymbolData = getExistingSymbolData(symbol.value)
  const symbolAlreadyVisible = visibleSymbolAlreadyExists(symbol.value)

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
        apiData,
        userInfo,
      },
    )

    $q.notify({
      message: 'data added to existing symbol without deleting historical data',
      color: 'positive',
      icon: 'check_circle',
      timeout: 5000,
    })
  } else if (symbolAlreadyVisible === false) {
    await setDoc(doc(db, 'users', storeAuth.user.id, investmentDetailName.value, symbol.value), {
      generalInfo,
      orderInfo,
      apiData,
      userInfo,
    })

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
        'This name already exist, to modify it use the buttons on the action column of the portofolio table',
      color: 'negative',
      icon: 'report_problem',
      timeout: 2500,
    })
  }
}

async function onResetNewName() {
  console.log('new company reset')
}
</script>

<!------------------------------------------------------------------------------------------------------->
<!-------------------------------------------- STYLE ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<style scoped></style>
