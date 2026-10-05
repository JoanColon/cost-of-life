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

      <q-card-section>
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
            step="0.0001"
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
    </q-card>
  </div>
</template>

<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------- SCRIPT ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<script setup>
import { ref } from 'vue'
// import { storeToRefs } from 'pinia'
import { useQuasar } from 'quasar'
import { db } from 'src/js/firebase'
import { doc, getDoc, updateDoc } from 'firebase/firestore'

// import and declare stores
import { useStoreAuth } from 'src/stores/storeAuth'
const storeAuth = useStoreAuth()

// declare useQuasar (to use the "notify" plugin)
const $q = useQuasar()

// props recieved from parent company (investmentTable component)
const props = defineProps(['editCryptoProps'])
const investmentDetailName = ref(props.editCryptoProps.investmentDetailName)
const propsEdit = ref(props.editCryptoProps.propsEdit)

// // ----------------------------------- new ORDER tab ------------------------------------------------------
const currentDate = new Date().toJSON().slice(0, 10)

const editDate = ref(currentDate) // date
const editBuyOrSell = ref('Buy') // buy or sell
const editShareAmount = ref(0) // number of purchased/sold shares
const editSharePrice = ref(0.0) // transaction price

// save data to database, creates a new document into the "investmentsBrokerage" collection
async function onSubmitEditCompany() {
  const dateStr = editDate.value
  const timestamp = new Date(dateStr).getTime()
  const id = String(Date.now())

  // prepare new data to add to the database
  const newTimestamp = {
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

  const docRef = doc(
    db,
    'users',
    storeAuth.user.id,
    investmentDetailName.value,
    propsEdit.value.symbol,
  )
  const docSnapshot = await getDoc(docRef)
  const existingData = docSnapshot.data()

  // Merge the new data with the existing data
  const updatedOrderInfo = {
    ...(existingData.orderInfo || {}), // Use existing orderInfo or an empty object if it doesn't exist
    [id]: newTimestamp,
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

// async function onResetModifyStockData () {
//   console.log('reset stock data')
// }
</script>

<!------------------------------------------------------------------------------------------------------->
<!-------------------------------------------- STYLE ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<style scoped></style>
