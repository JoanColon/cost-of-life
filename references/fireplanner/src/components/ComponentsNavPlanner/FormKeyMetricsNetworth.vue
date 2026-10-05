<!-- eslint-disable object-shorthand -->
<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------ TEMPLATE --------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<template>
  <div style="max-width: 1000px; margin: auto">
    <!------------------------------------  NET WORTH LAYOUT ------------------------------------------------>
    <div class="q-mt-none shadow-1 white-container" style="width: 100%; display: block">
      <p class="q-mb-none q-mt-sm q-pb-none q-pt-sm" style="text-align: center; font-size: 16px">
        <strong>Global financial position</strong>
      </p>

      <div class="q-mb-sm q-mt-none white-container" style="width: 100%">
        <q-item>
          <q-item-section avatar>
            <q-icon name="price_check"></q-icon>
          </q-item-section>

          <q-item-section>
            <q-item-label class="text-weight-bold" style="font-size: 16px">Net worth</q-item-label>
            <q-item-label caption>{{
              totalNetWorth.toLocaleString('en-US', {
                style: 'currency',
                currency: currency,
                maximumFractionDigits: 0,
              })
            }}</q-item-label>
          </q-item-section>
        </q-item>

        <q-btn
          class="q-my-none q-mr-xs"
          flat
          no-caps
          style="color: #14213d; height: 75%"
          icon="search"
          @click="netWorthDialog = true"
        >
        </q-btn>
      </div>

      <p class="q-ml-lg text-caption" style="font-size: smaller">
        last updated: {{ netWorthDate }}
      </p>
    </div>

    <!------------------------------------  NET WORTH DIALOG/FORM ------------------------------------------------>
    <q-dialog v-model="netWorthDialog">
      <q-card style="width: 500px; max-width: 85vw">
        <!-- card header -->
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Net worth information</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup @click="$emit('close-new-entry')" />
        </q-card-section>

        <!-- tabs -->
        <q-card-section>
          <q-tabs v-model="netWorthTab" no-caps dense>
            <q-tab name="assets" label="Assets"></q-tab>
            <q-tab name="liabilities" label="Liabilities"></q-tab>
          </q-tabs>
        </q-card-section>

        <!-- tabs forms - assets, liabilities -->
        <q-card-section>
          <!-- assets -->
          <div v-if="netWorthTab === 'assets'">
            <q-input
              v-for="asset in netWorthAssetsList"
              :key="asset.id"
              v-model.number="asset.amount"
              type="number"
              :label="asset.label"
              :prefix="currencySymbol"
            >
              <template v-slot:append>
                <q-avatar v-if="asset.id !== 'nwalHome' && seeVsEdit === 'edit'">
                  <q-btn
                    round
                    icon="autorenew"
                    @click="updateFromInvestment(asset.detailInvestment, asset.arrayPostion)"
                  >
                    <q-tooltip> Click to update the value from the Investments Section </q-tooltip>
                  </q-btn>
                </q-avatar>
              </template>
            </q-input>
          </div>

          <!-- liabilities -->
          <div v-if="netWorthTab === 'liabilities'">
            <q-input
              v-for="liability in netWorthLiabilitiesList"
              :key="liability.id"
              v-model.number="liability.amount"
              type="number"
              :label="liability.label"
              :prefix="currencySymbol"
            />
          </div>
        </q-card-section>

        <!-- <hr style="width:85%"> -->

        <!-- form submit button -->
        <q-card-section style="display: flex">
          <!-- date -->
          <q-input
            v-model="netWorthDate"
            class="q-ml-sm"
            type="date"
            label="date"
            style="width: 125px"
          />

          <q-space />
          <q-btn
            v-if="seeVsEdit === 'edit'"
            class="q-mt-sm q-mr-sm"
            style="height: 75%"
            label="Save"
            rounded
            color="orange"
            no-caps
            @click="saveNetworth()"
          />
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>

<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------- SCRIPT ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<!-- eslint-disable no-unused-vars -->
<script setup>
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useQuasar } from 'quasar'
import { db } from 'src/js/firebase'
import { doc, setDoc, updateDoc } from 'firebase/firestore'
import * as math from 'mathjs'

// import and declare stores
import { useStoreAuth } from 'src/stores/storeAuth'
import { useStoreUserSettings } from 'src/stores/storeUserSettings'
import { useStoreNetWorth } from 'src/stores/storeNetWorth'
import { useStoreKeyMetrics } from 'src/stores/storeKeyMetrics'
import { useStoreInvestments } from 'src/stores/storeInvestments'
const storeAuth = useStoreAuth()
const storeUserSettings = useStoreUserSettings()
const storeNetWorth = useStoreNetWorth()
const storeInvestments = useStoreInvestments()
const storeKeyMetrics = useStoreKeyMetrics()

// get reactive data from stores
const { userSettings } = storeToRefs(storeUserSettings)
const { currencyString } = storeToRefs(storeUserSettings)
const { networthDocDict } = storeToRefs(storeNetWorth)
const { getBrokerageData } = storeToRefs(storeInvestments)

// props from parent component
const props = defineProps(['parentPropNetworth'])

// props with watchers to react on a parent change
const netWorthAssetsList = ref(props.parentPropNetworth.data.assets)
const netWorthLiabilitiesList = ref(props.parentPropNetworth.data.liabilities)
const netWorthDate = ref(props.parentPropNetworth.date)
const netWorthDialog = ref(false)
const seeVsEdit = ref('see')

watch(
  () => props.parentPropNetworth.data.assets,
  (newAssets) => {
    netWorthAssetsList.value = newAssets
  },
)

watch(
  () => props.parentPropNetworth.data.liabilities,
  (newLiabilities) => {
    netWorthLiabilitiesList.value = newLiabilities
  },
)

watch(
  () => props.parentPropNetworth.date,
  (newDate) => {
    netWorthDate.value = newDate
  },
)

watch(
  () => props.parentPropNetworth.dialog,
  (newDialog) => {
    netWorthDialog.value = newDialog
  },
)

watch(
  () => props.parentPropNetworth.seeVsEdit,
  (newSeeVsEdit) => {
    seeVsEdit.value = newSeeVsEdit
  },
)

// stores variables
const currency = userSettings.value.currency
const currencySymbol = currencyString.value

// declare useQuasar (to use the "notify" plugin)
const $q = useQuasar()

// emits -> to change the view back to the investmentsMainComponent
const emit = defineEmits(['close-new-entry'])

// to open and close the dialogs
const netWorthTab = ref('assets')

const totalNetWorth = computed(() => {
  const assetsList = netWorthAssetsList.value.map((item) => item.amount)
  const liabilitiesList = netWorthLiabilitiesList.value.map((item) => item.amount)
  const totalNetWorth = math.sum(assetsList) - math.sum(liabilitiesList)
  return totalNetWorth
})

// ------------------------------------- get data from investments ---------------------------------------
const investmentSummary = getBrokerageData.value[1]

function updateFromInvestment(detailInvestment, i) {
  const amount = math.round(parseFloat(investmentSummary[detailInvestment].portofolioMarketValue))
  netWorthAssetsList.value[i].amount = amount
}

// ---------------------------------- submit form "Only networth" to firebase ---------------------------------------
async function saveNetworth() {
  // STEP 1. Check if networth collection has data:
  const networthKeys = Object.keys(networthDocDict.value)

  // STEP 2. Create the needed timestamp and date data
  const dateStr = netWorthDate.value
  const timestamp = new Date(dateStr).getTime()
  const year = new Date(timestamp).getFullYear()
  let month = new Date(timestamp).getMonth() + 1 // Adding 1 because getMonth() returns zero-based month
  if (month < 10) {
    month = '0' + month.toString()
  } else {
    month.toString()
  }

  const id = `${year.toString()}` + month

  // STEP 3. Create the dicts to be saved as docs in firestore
  const networthAssetsDict = {
    date: dateStr,
    timestamp,
    netWorthAssetsList: netWorthAssetsList.value,
  }

  const networthLiabilitiesDict = {
    date: dateStr,
    timestamp,
    netWorthLiabilitiesList: netWorthLiabilitiesList.value,
  }

  const networthTotalDict = {
    date: dateStr,
    timestamp,
    totalNetWorth: totalNetWorth.value,
  }

  // STEP 4. Save data to ddbb
  if (networthKeys.length === 0) {
    // when no data exists
    await setDoc(doc(db, 'users', storeAuth.user.id, 'networth', 'networthAssetsDoc'), {
      [id]: networthAssetsDict,
    })

    await setDoc(doc(db, 'users', storeAuth.user.id, 'networth', 'networthLiabilitiesDoc'), {
      [id]: networthLiabilitiesDict,
    })

    await setDoc(doc(db, 'users', storeAuth.user.id, 'networth', 'networthTotalDoc'), {
      [id]: networthTotalDict,
    })

    // STEP 5. Update userSettings "plan" value
    const networthUpdatedList = storeNetWorth.getAllNetWorthList
    const keyMetricsUpdatedList = storeKeyMetrics.getAllKeyMetricsList

    if (networthUpdatedList.length !== 0 && keyMetricsUpdatedList !== 0) {
      await updateDoc(doc(db, 'users', storeAuth.user.id), {
        plan: 'noPlan',
      })
    }

    // notify that form saving was done succesfully
    $q.notify({
      message: 'Data added to database',
      color: 'positive',
      icon: 'check_circle',
      timeout: 1000,
    })
  } else {
    // when data exists
    await updateDoc(doc(db, 'users', storeAuth.user.id, 'networth', 'networthAssetsDoc'), {
      [id]: networthAssetsDict,
    })

    await updateDoc(doc(db, 'users', storeAuth.user.id, 'networth', 'networthLiabilitiesDoc'), {
      [id]: networthLiabilitiesDict,
    })

    await updateDoc(doc(db, 'users', storeAuth.user.id, 'networth', 'networthTotalDoc'), {
      [id]: networthTotalDict,
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
</script>

<!------------------------------------------------------------------------------------------------------->
<!-------------------------------------------- STYLE ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<style scoped>
.q-expansion-item {
  border-radius: 15px;
  background: white;
  font-size: 20px;
  width: 100%;
}

.submit-section {
  display: flex;
  justify-content: space-between;
  border-radius: 15px;
  background: white;
  width: 95%;
  height: 95%;
}
</style>
