<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------ TEMPLATE --------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<template>
  <div>
    <q-card style="width: 500px; max-width: 80vw; height: 100vh">
      <!-- title -->
      <q-card-section class="row items-center">
        <div class="text-h6">
          Edit <strong>{{ propsEdit.symbol }}</strong> position
        </div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <!-- tabs -->
      <q-card-section class="q-mb-xs">
        <q-tabs v-model="infoTabs" no-caps>
          <q-tab name="order" label="New order" />
          <q-tab name="modifyStockData" label="Modify data" />
        </q-tabs>
      </q-card-section>

      <!-- tab form - New order -->
      <q-card-section v-if="infoTabs === 'order'">
        <q-form
          class="q-pr-md"
          style="width: 100%; display: block"
          @submit.prevent="onSubmitEditCompany"
          @reset="onResetEditCompany"
        >
          <!----------------------------- form fields ---------------------->
          <!-- selech purchase date -->
          <q-input class="q-ml-md" v-model="editDate" type="date" label="date" />

          <!-- select buy or sell -->
          <q-select
            class="q-ml-md"
            v-model="editBuyOrSell"
            :options="['Buy', 'Sell']"
            label="Order type"
          />

          <!-- select amount of shares -->
          <q-input
            class="q-ml-md"
            v-model.number="editShareAmount"
            type="number"
            label="Number of shares"
          />

          <!-- select average price, numbers with decimals use masks-->
          <q-input
            class="q-ml-md"
            v-model="editSharePrice"
            label="Transaction price per share"
            mask="#.##"
            fill-mask="0"
            reverse-fill-mask
          />

          <!-- form submit/reset button -->
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

      <!-- tab form - modify data -->
      <q-card-section v-if="infoTabs === 'modifyStockData'">
        <q-form
          class="q-pr-md"
          style="width: 100%; display: block"
          @submit.prevent="onSubmitModifyStockData"
          @reset="onResetModifyStockData"
        >
          <p>Fill this section only if default data is not accurate</p>
          <!-- edit stock price-->
          <q-input
            class="q-ml-md"
            v-model="userDefinedStockPrice"
            label="Current price per share"
            mask="#.##"
            fill-mask="0"
            reverse-fill-mask
          >
            <template v-slot:before>
              <q-checkbox v-model="userDefinedStockPriceCheckBox" color="orange" />
            </template>
          </q-input>

          <!-- edit dividend-->
          <q-input
            class="q-ml-md"
            v-model="userDefinedDividend"
            label="Current dividend per share"
            mask="#.##"
            fill-mask="0"
            reverse-fill-mask
          >
            <template v-slot:before>
              <q-checkbox v-model="userDefinedDividendCheckBox" color="orange" />
            </template>
          </q-input>

          <q-input class="q-ml-md" v-model="userDefinedRegion" label="Region">
            <template v-slot:before>
              <q-checkbox v-model="userDefinedRegionCheckBox" color="orange" />
            </template>
          </q-input>

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
import { useQuasar } from 'quasar'
import { db } from 'src/js/firebase'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import * as Math from 'mathjs'

// import and declare stores
import { useStoreAuth } from 'src/stores/storeAuth'
import { useStoreInvestments } from 'src/stores/storeInvestments'
const storeAuth = useStoreAuth()
const storeInvestments = useStoreInvestments()

// get getter from store
const investmentsUserModifiedList = storeInvestments.getInvestmentsUserModifiedList

// declare useQuasar (to use the "notify" plugin)
const $q = useQuasar()

// props recieved from parent company (investmentTable component)
const props = defineProps(['editSymbolProps'])
const investmentDetailName = ref(props.editSymbolProps.investmentDetailName)
const propsEdit = ref(props.editSymbolProps.propsEdit)
const symbol = ref(props.editSymbolProps.propsEdit.value.symbol)
const rows = ref(props.editSymbolProps.rows)

// tabs
const infoTabs = ref('order')

// ----------------------------------- new ORDER tab ------------------------------------------------------
const currentDate = new Date().toJSON().slice(0, 10)

const editDate = ref(currentDate) // date
const editBuyOrSell = ref('Buy') // buy or sell
const editShareAmount = ref(0) // number of purchased/sold shares
const editSharePrice = ref(0.0) // transaction price

// save data to database, creates a new document into the "investmentsBrokerage" collection
async function onSubmitEditCompany() {
  const dateStr = editDate.value
  const timestamp = new Date(dateStr).getTime()

  // // get the sector, supersector, currency and conuntry from the "rows" const

  // get symbol data from database
  const docRef = doc(
    db,
    'users',
    storeAuth.user.id,
    investmentDetailName.value,
    propsEdit.value.symbol,
  )
  const docSnapshot = await getDoc(docRef)
  const existingData = docSnapshot.data()

  // prepare new data to add to the database
  const newOrder = {
    date: dateStr,
    timestamp,
    buyOrSell: editBuyOrSell.value,
    shareAmount:
      editBuyOrSell.value === 'Sell' ? Math.abs(editShareAmount.value) * -1 : editShareAmount.value,
    sharePrice: parseFloat(editSharePrice.value),
    totalTransaction:
      editBuyOrSell.value === 'Sell'
        ? Math.abs(editShareAmount.value) * -1 * editSharePrice.value
        : editShareAmount.value * editSharePrice.value,
  }

  // Merge the new data with the existing data
  const updatedOrderInfo = {
    ...(existingData.orderInfo || {}), // Use existing orderInfo or an empty object if it doesn't exist
    [timestamp]: newOrder,
  }

  // updated the database, add a new order in OrderInfo
  await updateDoc(docRef, { orderInfo: updatedOrderInfo })

  // notify that form saving was done succesfully
  $q.notify({
    message: 'Data added to database',
    color: 'positive',
    icon: 'check_circle',
    timeout: 1000,
  })
}

async function onResetEditCompany() {
  console.log('reset')
}

// ----------------------------------- MODIFY DATA tab ---------------------------------------------------
// user modified data
const userDefinedStockPriceCheckBox = ref(
  investmentsUserModifiedList[symbol.value].userStockPriceCheckBox,
)
const userDefinedDividendCheckBox = ref(
  investmentsUserModifiedList[symbol.value].userStockDividendCheckBox,
)
const userDefinedRegionCheckBox = ref(investmentsUserModifiedList[symbol.value].userRegionCheckBox)
const userDefinedStockPrice = ref(investmentsUserModifiedList[symbol.value].userStockPrice * 100)
const userDefinedDividend = ref(investmentsUserModifiedList[symbol.value].userStockDividend * 100)
const userDefinedRegion = ref(investmentsUserModifiedList[symbol.value].userRegion)

async function onSubmitModifyStockData() {
  const symbolFound = rows.value.find((element) => element.symbol === symbol.value)
  const symbolToUpdate = symbolFound.symbol

  await updateDoc(doc(db, 'users', storeAuth.user.id, investmentDetailName.value, symbolToUpdate), {
    userInfo: {
      userStockPrice: parseFloat(userDefinedStockPrice.value),
      userStockPriceCheckBox: userDefinedStockPriceCheckBox.value,
      userStockDividend: parseFloat(userDefinedDividend.value),
      userStockDividendCheckBox: userDefinedDividendCheckBox.value,
      userRegion: userDefinedRegion.value,
      userRegionCheckBox: userDefinedRegionCheckBox.value,
    },
  })

  // notify that form saving was done succesfully
  $q.notify({
    message: 'User stock data has been modified',
    color: 'positive',
    icon: 'check_circle',
    timeout: 1000,
  })
}

async function onResetModifyStockData() {
  console.log('reset stock data')
}
</script>

<!------------------------------------------------------------------------------------------------------->
<!-------------------------------------------- STYLE ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<style scoped></style>
