<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------ TEMPLATE --------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<template>
  <div style="max-width: 1000px; margin: auto">
    <div class="q-mb-sm q-mt-none q-py-xs shadow-1 white-container" style="width: 100%">
      <!----------------------------------- add new savings --------------------------------------------->
      <q-btn
        class="q-ma-sm"
        flat
        padding="none"
        no-caps
        style="color: #14213d; margin-left: auto; margin-right: auto"
        @click="newEntryDialog = true"
      >
        Add new savings
      </q-btn>

      <q-dialog v-model="newEntryDialog">
        <q-card style="width: 500px; max-width: 80vw">
          <q-card-section class="row items-center q-pb-none">
            <div class="text-h6">Add and allocate savings</div>
            <q-space />
            <q-btn icon="close" flat round dense v-close-popup />
          </q-card-section>

          <q-card-section>
            <q-form
              class="q-pr-md"
              style="width: 100%; display: block"
              @submit.prevent="onSubmit"
              @reset="onReset"
            >
              <!-- form fields -->
              <q-input class="q-ml-md" v-model="date" type="date" label="date" />

              <q-input
                class="q-ml-md"
                v-model.number="savingsAmount"
                type="number"
                label="Savings amount"
              />

              <q-select
                class="q-ml-md"
                v-model="savingsChoice"
                :options="savingsOptions"
                label="Select a savings option"
              />

              <!-- form submit button -->
              <div class="q-mt-md q-mb-sm q-mr-xs float-right">
                <q-btn
                  style="height: 75%"
                  label="Save"
                  type="submit"
                  rounded
                  color="orange"
                  no-caps
                />

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
      </q-dialog>

      <!-------------------------------------- delete entered savings ----------------------------------------->
      <q-btn
        class="q-ma-sm"
        flat
        padding="none"
        no-caps
        style="color: red; margin-left: auto; margin-right: auto"
        @click="deleteEntryDialog = true"
      >
        Delete entry
      </q-btn>

      <q-dialog v-model="deleteEntryDialog">
        <q-card style="max-width: 80vw">
          <q-card-section class="row items-center q-pb-none">
            <div class="text-h6">Delete allocated savings</div>
            <q-space />
            <q-btn icon="close" flat round dense v-close-popup />
          </q-card-section>

          <q-card-section>
            <!-- q-table -->
            <q-table :rows="rows" :columns="columns" row-key="name" dense>
              <!-- slot for the delete button in the delete row -->
              <template v-slot:body-cell-delete="props">
                <q-td :props="props">
                  <q-btn
                    dense
                    round
                    flat
                    color="grey"
                    @click="deleteRow(props)"
                    icon="delete"
                  ></q-btn>
                </q-td>
              </template>
            </q-table>
          </q-card-section>
        </q-card>
      </q-dialog>
    </div>
  </div>
</template>

<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------- SCRIPT ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<!-- eslint-disable no-unused-vars -->
<script setup>
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useQuasar } from 'quasar'
import { db } from 'src/js/firebase'
import { doc, setDoc, updateDoc, deleteField } from 'firebase/firestore'

// import and declare stores
import { useStoreAuth } from 'src/stores/storeAuth'
import { useStoreUserSettings } from 'src/stores/storeUserSettings'
import { useStoreSavings } from 'src/stores/storeSavings'
const storeAuth = useStoreAuth()
const storeSavings = useStoreSavings()
const storeUserSettings = useStoreUserSettings()

// get reactive data from stores
const { userSettings } = storeToRefs(storeUserSettings)

// stores variables
const savingsList = computed(() => storeSavings.getSavingsList)
const currency = userSettings.value.currency

// declare useQuasar (to use the "notify" plugin)
const $q = useQuasar()

// ------------------------------------------- New entry ---------------------------------------------------
const newEntryDialog = ref(false)

const currentDate = new Date().toJSON().slice(0, 10) // slice is to only return the 10 first characters (if not it will also return the hh:mm:ss.ms)

const date = ref(currentDate)
const savingsAmount = ref(0)
const savingsChoice = ref('')
const savingsOptions = ref([
  'Real estate (income property)',
  'Brokerage account (e.g., stocks, etf, funds)',
  'Fixed-income (e.g., bonds, CDs, prefeered shares)',
  'Cryptoassets (e.g., cryptocurrencies, nft)',
  'Cash/savings',
  'Business equity',
  'Others (e.g., gold, jewelry, art)',
])

// save data to database, creates a new document into the "Savings" collection
async function onSubmit() {
  // STEP 1. Get date data
  const dateStr = date.value
  const timestamp = new Date(dateStr).getTime()
  const timestampStr = timestamp.toString()

  let savingsDetail = ''
  switch (savingsChoice.value) {
    case 'Real estate (income property':
      savingsDetail = 'detailRealEstate'
      break
    case 'Brokerage account (e.g., stocks, etf, funds)':
      savingsDetail = 'detailBrokerageAccount'
      break
    case 'Fixed-income (e.g., bonds, CDs, prefeered shares)':
      savingsDetail = 'detailFixedIncome'
      break
    case 'Cryptoassets (e.g., cryptocurrencies, nft)':
      savingsDetail = 'detailCryptoAssets'
      break
    case 'Cash/savings':
      savingsDetail = 'detailCashSavings'
      break
    case 'Business equity':
      savingsDetail = 'detailBusinessEquity'
      break
    case 'Others (e.g., gold, jewelry, art)':
      savingsDetail = 'detailOthers'
      break
  }

  // STEP 2. Create object to save
  const savingsObj = {
    date: dateStr,
    timestamp,
    savingsAmount: savingsAmount.value,
    savingsChoice: savingsChoice.value,
    savingsDetail,
  }

  // STEP 3. Get arraylength to check if savingsDoc exists, if yes we will update it, if not, we will create it in STEP 4
  const savingsKeys = Object.keys(savingsList.value)

  // STEP 4. Save data to ddbb
  if (savingsKeys.length === 0) {
    // when no data exists
    await setDoc(doc(db, 'users', storeAuth.user.id, 'savings', 'savingsDoc'), {
      [timestampStr]: savingsObj,
    })

    // notify that form saving was done succesfully
    $q.notify({
      message: 'Data added to database',
      color: 'positive',
      icon: 'check_circle',
      timeout: 1000,
    })
  } else {
    // when data exists
    await updateDoc(doc(db, 'users', storeAuth.user.id, 'savings', 'savingsDoc'), {
      [timestampStr]: savingsObj,
    })

    // notify that form saving was done succesfully
    $q.notify({
      message: 'Data added to database',
      color: 'positive',
      icon: 'check_circle',
      timeout: 1000,
    })
  }
}

// resets form data
function onReset() {
  date.value = null
  savingsAmount.value = null
  savingsChoice.value = null
}

// ----------------------------------------- delete entry -----------------------------------------
const deleteEntryDialog = ref(false)

// definition of table columns and rows
const columns = ref([
  {
    name: 'date',
    label: 'Date',
    field: (row) => row.date,
    format: (val) => `${val}`,
    align: 'center',
  },
  { name: 'savingsAmount', label: 'Savings amount', field: 'savingsAmount', align: 'center' },
  { name: 'savingsChoice', label: 'Savings allocation', field: 'savingsChoice', align: 'center' },
  { name: 'delete', label: 'Delete', field: '', align: 'center' },
])

const rows = computed(() => {
  const rows = []

  for (let i = 0; i < savingsList.value.length; i++) {
    const obj = {}
    obj.date = savingsList.value[i].date
    obj.savingsAmount = savingsList.value[i].savingsAmount.toLocaleString('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    })
    obj.savingsChoice = savingsList.value[i].savingsChoice
    rows.push(obj)
  }

  return rows
})

// delete function on a button click - deletes an entry of the savings allocation table
async function deleteRow(props) {
  const timestamp = new Date(props.row.date).getTime()
  const timestampStr = timestamp.toString()

  await updateDoc(doc(db, 'users', storeAuth.user.id, 'savings', 'savingsDoc'), {
    [timestampStr]: deleteField(),
  })

  // notify that form saving was done succesfully
  $q.notify({
    message: 'savings deleted from database',
    color: 'positive',
    icon: 'check_circle',
    timeout: 1000,
  })
}
</script>

<!------------------------------------------------------------------------------------------------------->
<!-------------------------------------------- STYLE ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<style scoped></style>
