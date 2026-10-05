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
          <q-tab name="modifyCashSavingsData" label="Modify data" />
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

          <!-- Deposit buy or Withdraw -->
          <q-select
            class="q-ml-md"
            v-model="editDepositWithdrwaw"
            :options="['Buy', 'Sell']"
            label="Order type"
          />

          <q-input
            class="q-ml-md"
            v-model.number="orderAmount"
            type="number"
            step="0.1"
            :label="`Amount deposited/withdrawn (in ${propsEdit.currency})`"
          />

          <p class="q-ml-md">
            the updated market value of this account is going to be
            {{
              updatedMarketValue.toLocaleString('en-Us', {
                style: 'currency',
                currency: propsEdit.currency,
                maximumFractionDigits: 1,
              })
            }}
          </p>

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

      <!-- tab form - Modify data -->
      <q-card-section v-else>
        <q-form
          class="q-pr-md"
          style="width: 100%; display: block"
          @submit.prevent="onSubmitUpdateCashSavings"
          @reset="onResetUpdateCashSavings"
        >
          <!-- date in which the account is updated -->
          <q-input class="q-ml-md" v-model="editDate" type="date" label="date" />

          <!-- market Value base currency numbers with decimals use masks-->
          <q-input
            class="q-ml-md"
            v-model.number="newMarketValue"
            type="number"
            step="0.1"
            :label="`Update the total market value of this account (in ${propsEdit.currency})`"
          />

          <!-- new interest rate -->
          <q-input
            class="q-ml-md"
            v-model.number="newDividendYield"
            type="number"
            step="0.1"
            label="Update the interest rate of this account"
          >
            <template v-slot:append> % </template>
          </q-input>

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
    </q-card>
  </div>
</template>

<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------- SCRIPT ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<!-- eslint-disable no-unused-vars -->
<script setup>
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { db } from 'src/js/firebase'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import * as math from 'mathjs'

// import and declare stores
import { useStoreAuth } from 'src/stores/storeAuth'
import { useStoreInvestments } from 'src/stores/storeInvestments'
const storeAuth = useStoreAuth()
const storeInvestments = useStoreInvestments()

// declare useQuasar (to use the "notify" plugin)
const $q = useQuasar()

// props recieved from parent company (investmentTable component)
const props = defineProps(['editCashSavingsProps'])
const investmentDetailName = ref(props.editCashSavingsProps.investmentDetailName)
const propsEdit = ref(props.editCashSavingsProps.propsEdit)

// tabs
const infoTabs = ref('order')

// ----------------------------------- new ORDER tab ------------------------------------------------------
const currentDate = new Date().toJSON().slice(0, 10)

const editDate = ref(currentDate) // date
const editDepositWithdrwaw = ref('Buy') // Deposit or Withdraw money form account
const orderAmount = ref(0)

const totalTransaction = computed(() => {
  if (editDepositWithdrwaw.value === 'Buy') {
    const orderAmountFinal = math.abs(orderAmount.value)
    return orderAmountFinal
  } else {
    const orderAmountFinal = -1 * math.abs(orderAmount.value)
    return orderAmountFinal
  }
})

const updatedMarketValue = computed(() => {
  const currentMarketValue = propsEdit.value.marketValue
  const updatedMarketValue = currentMarketValue + totalTransaction.value
  return updatedMarketValue
}) // updated market value when adding a new order

// save data to database, creates a new document into the "investmentsBrokerage" collection
async function onSubmitEditCompany() {
  const dateStr = editDate.value
  const timestamp = new Date(dateStr).getTime()

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
    buyOrSell: editDepositWithdrwaw.value,
    totalTransaction: totalTransaction.value,
  }

  // Merge the new data with the existing data
  const updatedOrderInfo = {
    ...(existingData.orderInfo || {}), // Use existing orderInfo or an empty object if it doesn't exist
    [timestamp]: newOrder,
  }

  await updateDoc(docRef, { orderInfo: updatedOrderInfo })

  console.log(updatedMarketValue.value)
  await updateDoc(docRef, {
    'userInfo.marketValue': updatedMarketValue.value,
  })
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

// -------------------------------------- update tab ---------------------------------------------------
// get reactive data from stores
const investmentsUserModifiedList = computed(() => {
  const userData = storeInvestments.getInvestmentsUserModifiedList
  return userData
})

const symbol = propsEdit.value.symbol
const userData = investmentsUserModifiedList.value[symbol]
const newMarketValue = ref(userData.marketValue) // new market value in account currency
const newDividendYield = ref(userData.dividendYield * 100)

async function onSubmitUpdateCashSavings() {
  const docRef = doc(
    db,
    'users',
    storeAuth.user.id,
    investmentDetailName.value,
    propsEdit.value.symbol,
  )
  await updateDoc(docRef, {
    userInfo: {
      dividendYield: newDividendYield.value / 100,
      marketValue: newMarketValue.value,
    },
  })

  // notify that form saving was done succesfully
  $q.notify({
    message: 'Data added to database',
    color: 'positive',
    icon: 'check_circle',
    timeout: 1000,
  })
}

async function onResetUpdateCashSavings() {
  console.log('reset')
}
</script>

<!------------------------------------------------------------------------------------------------------->
<!-------------------------------------------- STYLE ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<style scoped></style>
