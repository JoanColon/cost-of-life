<!-- eslint-disable object-shorthand -->
<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------ TEMPLATE --------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<template>
  <div style="max-width: 1000px; margin: auto">
    <FormKeyMetricsNetworth
      :parentPropNetworth="parentPropNetworth"
      @close-new-entry="resetNetworth()"
    />

    <FormKeyMetricsAnnualKeyMetrics
      :parentPropKeyMetrics="parentPropKeyMetrics"
      @close-new-key-metrics-entry="resetKeyMetrics()"
    />

    <div
      class="q-mb-sm q-mt-none q-py-xs shadow-1 white-container"
      style="display: flex; width: 100%; justify-content: space-around"
    >
      <!----------------------------------------------------------------------------------->
      <!-------------------------------------- NEW entry --------------------------------->
      <!----------------------------------------------------------------------------------->
      <q-btn-dropdown class="q-ma-sm" flat padding="none" no-caps color="black" label="New entry">
        <q-list>
          <q-item clickable v-close-popup @click="openNewNetworth()">
            <q-item-section>
              <q-item-label>Networth</q-item-label>
            </q-item-section>
          </q-item>

          <q-item clickable v-close-popup @click="openNewKeyMetrics()">
            <q-item-section>
              <q-item-label>Annual metrics</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>

      <!----------------------------------------------------------------------------------->
      <!-------------------------------------- EDIT entry --------------------------------->
      <!----------------------------------------------------------------------------------->
      <q-btn
        class="q-ma-sm"
        flat
        padding="none"
        no-caps
        style="color: orange"
        @click="editMetrics = true"
      >
        Edit/Copy entry
      </q-btn>

      <!--------------------------------------------- dialg -------------------------------->
      <q-dialog v-model="editMetrics">
        <q-card style="width: 500px; max-width: 80vw">
          <p
            class="q-mb-none q-mt-sm q-pb-none q-pt-sm"
            style="text-align: center; font-size: 16px"
          >
            <strong>Edit exiting entries or Add a new entry copying a previous entry</strong>
          </p>
          <q-card-section class="row items-center q-pb-none">
            <div class="text-h6"></div>
            <q-space />
            <q-btn icon="close" flat round dense v-close-popup />
          </q-card-section>

          <!--------------------------- tabs -------------------------------->
          <q-card-section>
            <q-tabs v-model="modelMetricsTab" no-caps dense>
              <q-tab name="networth" label="Networth"></q-tab>
              <q-tab name="annualMetrics" label="Annual Metrics"></q-tab>
            </q-tabs>
          </q-card-section>

          <!--------------------------- q-table ----------------------------->
          <q-card-section v-if="modelMetricsTab === 'networth'">
            <q-table :rows="rowsNetworth" :columns="columnsNetworthEdit" row-key="name" dense>
              <!-- slot for the delete button in the delete row -->
              <template v-slot:body-cell-edit="props">
                <q-td :props="props">
                  <q-btn
                    dense
                    round
                    flat
                    color="black"
                    @click="openEditNetworth(props)"
                    icon="edit"
                  ></q-btn>
                </q-td>
              </template>
            </q-table>
          </q-card-section>

          <q-card-section v-else>
            <q-table
              :rows="rowsAnnualMetrics"
              :columns="columnsAnnualMetricsEdit"
              row-key="name"
              dense
            >
              <!-- slot for the delete button in the edit row -->
              <template v-slot:body-cell-edit="props">
                <q-td :props="props">
                  <q-btn
                    dense
                    round
                    flat
                    color="black"
                    @click="openEditKeyMetrics(props)"
                    icon="edit"
                  ></q-btn>
                </q-td>
              </template>
            </q-table>
          </q-card-section>
        </q-card>
      </q-dialog>

      <!----------------------------------------------------------------------------------->
      <!------------------------------------ DELETE entry --------------------------------->
      <!----------------------------------------------------------------------------------->
      <q-btn
        class="q-ma-sm"
        flat
        padding="none"
        no-caps
        style="color: red"
        @click="deleteMetrics = true"
      >
        Delete entry
      </q-btn>

      <!--------------------------------------------- dialg -------------------------------->
      <q-dialog v-model="deleteMetrics">
        <q-card style="width: 500px; max-width: 80vw">
          <p
            class="q-mb-none q-mt-sm q-pb-none q-pt-sm"
            style="text-align: center; font-size: 16px"
          >
            <strong>Delete exiting entries</strong>
          </p>
          <q-card-section class="row items-center q-pb-none">
            <div class="text-h6"></div>
            <q-space />
            <q-btn icon="close" flat round dense v-close-popup />
          </q-card-section>

          <!--------------------------- tabs -------------------------------->
          <q-card-section>
            <q-tabs v-model="modelMetricsTab" no-caps dense>
              <q-tab name="networth" label="Networth"></q-tab>
              <q-tab name="annualMetrics" label="Annual Metrics"></q-tab>
            </q-tabs>
          </q-card-section>

          <!--------------------------- q-table ----------------------------->
          <q-card-section v-if="modelMetricsTab === 'networth'">
            <q-table :rows="rowsNetworth" :columns="columnsNetworthDelete" row-key="name" dense>
              <!-- slot for the delete button in the delete row -->
              <template v-slot:body-cell-delete="props">
                <q-td :props="props">
                  <q-btn
                    dense
                    round
                    flat
                    color="red"
                    @click="deleteRow(props)"
                    icon="delete"
                  ></q-btn>
                </q-td>
              </template>
            </q-table>
          </q-card-section>

          <q-card-section v-else>
            <q-table
              :rows="rowsAnnualMetrics"
              :columns="columnsAnnualMetricsDelete"
              row-key="name"
              dense
            >
              <!-- slot for the delete button in the delete row -->
              <template v-slot:body-cell-delete="props">
                <q-td :props="props">
                  <q-btn
                    dense
                    round
                    flat
                    color="red"
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
// general imports
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useQuasar } from 'quasar'
import { db } from 'src/js/firebase'
import { doc, updateDoc, deleteField } from 'firebase/firestore'

// import components
import FormKeyMetricsNetworth from 'src/components/ComponentsNavPlanner/FormKeyMetricsNetworth.vue'
import FormKeyMetricsAnnualKeyMetrics from 'src/components/ComponentsNavPlanner/FormKeyMetricsAnnualKeyMetrics.vue'

// store imports
import { useStoreAuth } from 'src/stores/storeAuth'
import { useStoreKeyMetrics } from 'src/stores/storeKeyMetrics'
import { useStoreNetWorth } from 'src/stores/storeNetWorth'
import { useStoreUserSettings } from 'src/stores/storeUserSettings'

// get store data
const storeAuth = useStoreAuth()
const storeKeyMetrics = useStoreKeyMetrics()
const storeNetworth = useStoreNetWorth()
const storeUserSettings = useStoreUserSettings()

// const { allKeyMetricsList } = storeToRefs(storeKeyMetrics)
const { userSettings } = storeToRefs(storeUserSettings)

// get store data
const allNetWorthList = computed(() => storeNetworth.getAllNetWorthList) // from store getter
const allKeyMetricsList = computed(() => storeKeyMetrics.getAllKeyMetricsList) // from store getter
const currency = userSettings.value.currency

// model and reactive data
const deleteMetrics = ref(false)
const editMetrics = ref(false)
const modelMetricsTab = ref('networth')

// declare useQuasar (to use the "notify" plugin)
const $q = useQuasar()

// ------------------------ OPEN NEW/EDIT NETWORTH ---------------------
const zeroNetworth = {
  assets: [
    {
      id: 'nwalHome',
      arrayPostion: 0,
      label: 'Real estate (home)',
      detailInvestment: '',
      amount: 0,
    },
    {
      id: 'nwalProperties',
      arrayPostion: 1,
      label: 'Real Estate (Income property)',
      detailInvestment: 'detailRealEstate',
      amount: 0,
    },
    {
      id: 'nwalBrokerageAccount',
      arrayPostion: 2,
      label: 'Brokerage Account (stocks, etf, funds)',
      detailInvestment: 'detailBrokerageAccount',
      amount: 0,
    },
    {
      id: 'nwalFixedIncome',
      arrayPostion: 3,
      label: 'Fixed-income instruments (bonds, CDs, prefeered shares)',
      detailInvestment: 'detailFixedIncome',
      amount: 0,
    },
    {
      id: 'nwalCryptoAssets',
      arrayPostion: 4,
      label: 'Cryptoassets (cryptocurrencies, nft)',
      detailInvestment: 'detailCryptoAssets',
      amount: 0,
    },
    {
      id: 'nwalCashSavings',
      arrayPostion: 5,
      label: 'Cash/Savings',
      detailInvestment: 'detailCashSavings',
      amount: 0,
    },
    {
      id: 'nwalBusinnesEquity',
      arrayPostion: 6,
      label: 'Business equity',
      detailInvestment: 'detailBusinessEquity',
      amount: 0,
    },
    {
      id: 'nwalOthers',
      arrayPostion: 7,
      label: 'Others (e.g., art, jewelry, car)',
      detailInvestment: 'detailOthers',
      amount: 0,
    },
  ],
  liabilities: [
    {
      id: 'nwllMortage',
      label: 'Mortage',
      amount: 0,
    },
    {
      id: 'nwllPropertyLoan',
      label: 'Other real state / property loan',
      amount: 0,
    },
    {
      id: 'nwllVehicleLoan',
      label: 'Car/vehicle loan',
      amount: 0,
    },
    {
      id: 'nwllStudentLoan',
      label: 'Student loan',
      amount: 0,
    },
    {
      id: 'nwllBusinessLoan',
      label: 'Business loan',
      amount: 0,
    },
    {
      id: 'nwllOtherLoans',
      label: 'Other loans (e.g., personal loan, credit card)',
      amount: 0,
    },
  ],
}

// STEP 1. define a ref which is the initial object
const parentPropNetworth = ref({
  date:
    allNetWorthList.value[0] && allNetWorthList.value[0].date
      ? allNetWorthList.value[0].date
      : new Date(),
  dialog: false,
  seeVsEdit: 'see',
  data: {
    assets:
      allNetWorthList.value[0] && allNetWorthList.value[0].netWorthDict.assets
        ? allNetWorthList.value[0].netWorthDict.assets
        : zeroNetworth.assets,
    liabilities:
      allNetWorthList.value[0] && allNetWorthList.value[0].netWorthDict.liabilities
        ? allNetWorthList.value[0].netWorthDict.liabilities
        : zeroNetworth.liabilities,
  },
})

// STEP 2. Function to change inital parentProp object on a button click (NEW entry)
function openNewNetworth() {
  const date = new Date()
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0') // Adding 1 as months are zero-indexed, padStart function is used to ensure that the month is always a two-digit string.
  const day = String(date.getDate()).padStart(2, '0')
  const formattedDate = `${year}-${month}-${day}`
  const yearMonth = `${year}${month}`

  const obj = {
    date: formattedDate,
    dialog: true,
    key: yearMonth,
    seeVsEdit: 'edit',
    data: {
      assets: zeroNetworth.assets,
      liabilities: zeroNetworth.liabilities,
    },
  }

  parentPropNetworth.value = obj
  return 'parent prop changed'
}

// STEP 3. Function to change inital parentProp object on a button click (EDIT existing entry)
async function openEditNetworth(props) {
  const timestamp = props.row.timestamp // Replace with your timestamp
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0') // Adding 1 as months are zero-indexed, padStart function is used to ensure that the month is always a two-digit string.
  const yearMonth = `${year}${month}`
  const networthToEdit = allNetWorthList.value.find((element) => element.key === yearMonth)

  const obj = {
    date: networthToEdit.date,
    dialog: true,
    seeVsEdit: 'edit',
    data: networthToEdit.netWorthDict,
  }

  parentPropNetworth.value = obj
  editMetrics.value = false
  return 'parent prop changed'
}

// STEP 4. Return to initial parentPropsNetworth when the edit is finished (function called from emit)
function resetNetworth() {
  const obj = {
    date:
      allNetWorthList.value[0] && allNetWorthList.value[0].date
        ? allNetWorthList.value[0].date
        : new Date(),
    dialog: false,
    seeVsEdit: 'see',
    data: {
      assets:
        allNetWorthList.value[0] && allNetWorthList.value[0].netWorthDict.assets
          ? allNetWorthList.value[0].netWorthDict.assets
          : zeroNetworth.assets,
      liabilities:
        allNetWorthList.value[0] && allNetWorthList.value[0].netWorthDict.liabilities
          ? allNetWorthList.value[0].netWorthDict.liabilities
          : zeroNetworth.liabilities,
    },
  }

  parentPropNetworth.value = obj
}

// ------------------------ OPEN NEW/EDIT KEY METRICS ---------------------
const zeroKeyMetricsIncome = {
  activeIncome: [
    {
      id: 'ialPrimaryJob',
      label: 'Primary job',
      amount: 0,
    },
    {
      id: 'ialSecondaryJob',
      label: 'Secondary job / side hustle',
      amount: 0,
    },
  ],
  passiveIncome: [
    {
      id: 'iplStockDividends',
      arrayPostion: 0,
      label: 'Stock dividends',
      detailInvestment: 'detailBrokerageAccount',
      amount: 0,
    },
    {
      id: 'iplRentalIncome',
      arrayPostion: 1,
      label: 'Rental income',
      detailInvestment: 'detailRealEstate',
      amount: 0,
    },
    {
      id: 'iplFixedIncome',
      arrayPostion: 2,
      label: 'Fixed income (bonds, annuities, etc.)',
      detailInvestment: 'detailFixedIncome',
      amount: 0,
    },
    {
      id: 'iplSavingInterest',
      arrayPostion: 3,
      label: 'Saving Interests',
      detailInvestment: 'detailCashSavings',
      amount: 0,
    },
    {
      id: 'iplBusinessIncome',
      arrayPostion: 4,
      label: 'Passive business income',
      detailInvestment: 'detailBusinessEquity',
      amount: 0,
    },
  ],
}

const zeroKeyMetricsExpenses = {
  housing: [
    {
      id: 'ehlMortageRent',
      label: 'Mortage/rent',
      amount: 0,
    },
    {
      id: 'ehlPropertyTaxes',
      label: 'Proerty taxes',
      amount: 0,
    },
    {
      id: 'ehlHouseInsurance',
      label: 'House insurance',
      amount: 0,
    },
    {
      id: 'ehlAlarmSystem',
      label: 'Alarm system',
      amount: 0,
    },
    {
      id: 'ehlRepairsMaintainance',
      label: 'Repairs & maintainance',
      amount: 0,
    },
  ],
  transportation: [
    {
      id: 'etlCarPayments',
      label: 'Car/vehicle payments',
      amount: 0,
    },
    {
      id: 'etlCarInsurance',
      label: 'Car/vehicle insurance',
      amount: 0,
    },
    {
      id: 'etlFuel',
      label: 'Fuel',
      amount: 0,
    },
    {
      id: 'etlParking',
      label: 'Parking',
      amount: 0,
    },
    {
      id: 'etlMaintainance',
      label: 'Maintainance',
      amount: 0,
    },
    {
      id: 'etlTaxes',
      label: 'Taxes',
      amount: 0,
    },
    {
      id: 'etlPublicTransport',
      label: 'Public transport',
      amount: 0,
    },
  ],
  groceries: [
    {
      id: 'eglGroceries',
      label: 'Groceries',
      amount: 0,
    },
    {
      id: 'eglOthers',
      label: 'Others',
      amount: 0,
    },
  ],
  utilities: [
    {
      id: 'eulUtilities',
      label: 'Utilities (e.g., electricity, water, gas)',
      amount: 0,
    },
    {
      id: 'eulPhoneInternet',
      label: 'Phone / internet plan',
      amount: 0,
    },
  ],
  medical: [
    {
      id: 'emlHealthInsurance',
      label: 'Health insurance',
      amount: 0,
    },
    {
      id: 'emlLifeInsurance',
      label: 'Life insurance',
      amount: 0,
    },
    {
      id: 'emlSpecialityCare',
      label: 'Speciality care (e.g., dentist, oculist)',
      amount: 0,
    },
    {
      id: 'emlDevicesSupplies',
      label: 'Medical devices and supplies',
      amount: 0,
    },
    {
      id: 'emlOthers',
      label: 'Others',
      amount: 0,
    },
  ],
  debtPayment: [
    {
      id: 'edplPersonalLoan',
      label: 'Personal loan',
      amount: 0,
    },
    {
      id: 'edplStudentLoan',
      label: 'Student loan',
      amount: 0,
    },
    {
      id: 'edplCreditCard',
      label: 'Credit card',
      amount: 0,
    },
  ],
  personalSpending: [
    {
      id: 'epslClothes',
      label: 'Clothes and shoes',
      amount: 0,
    },
    {
      id: 'epslGym',
      label: 'Gym',
      amount: 0,
    },
    {
      id: 'epslGifts',
      label: 'Gifts',
      amount: 0,
    },
    {
      id: 'epslOthers',
      label: 'Others',
      amount: 0,
    },
  ],
  entertainment: [
    {
      id: 'eelRestaurants',
      label: 'Restaurants/dining out',
      amount: 0,
    },
    {
      id: 'eelVacations',
      label: 'Vacations and travelling',
      amount: 0,
    },
    {
      id: 'eelStreamingSubscriptions',
      label: 'Streaming and other subscriptions',
      amount: 0,
    },
    {
      id: 'epslHobbies',
      label: 'Hobbies',
      amount: 0,
    },
    {
      id: 'epslOthers',
      label: 'Others',
      amount: 0,
    },
  ],
  childcare: [
    {
      id: 'eclSchool',
      label: 'School/education',
      amount: 0,
    },
    {
      id: 'eclDaycare',
      label: 'Daycare',
      amount: 0,
    },
    {
      id: 'eclOthers',
      label: 'Others',
      amount: 0,
    },
  ],
  miscellaneous: [
    {
      id: 'emlMiscellaneous',
      label: 'Miscellaneous',
      amount: 0,
    },
  ],
}

const zeroKeyMetricsSavings = {
  annualSavingsRate: 0,
  savingType: 'Lean saver',
  userSavingsRate: 0,
}

// STEP 1. define a ref which is the initial object
const parentPropKeyMetrics = ref({
  year:
    allKeyMetricsList.value[0] && allKeyMetricsList.value[0].year
      ? allKeyMetricsList.value[0].year
      : new Date().getFullYear(),
  dialog: false,
  seeVsEdit: 'see',
  data: {
    incomeDict:
      allKeyMetricsList.value[0] && allKeyMetricsList.value[0].incomeDict
        ? allKeyMetricsList.value[0].incomeDict
        : zeroKeyMetricsIncome,
    expensesDict:
      allKeyMetricsList.value[0] && allKeyMetricsList.value[0].expensesDict
        ? allKeyMetricsList.value[0].expensesDict
        : zeroKeyMetricsExpenses,
    savingsDict:
      allKeyMetricsList.value[0] && allKeyMetricsList.value[0].savingsDict
        ? allKeyMetricsList.value[0].savingsDict
        : zeroKeyMetricsSavings,
  },
})

// STEP 2. Function to change inital parentProp object on a button click (NEW entry)
function openNewKeyMetrics() {
  const date = new Date()
  const year = date.getFullYear()

  const obj = {
    year,
    dialog: true,
    key: year,
    seeVsEdit: 'edit',
    data: {
      incomeDict: zeroKeyMetricsIncome,
      expensesDict: zeroKeyMetricsExpenses,
      savingsDict: zeroKeyMetricsSavings,
    },
  }

  parentPropKeyMetrics.value = obj
  return 'parent prop changed'
}

// STEP 3. Function to change inital parentProp object on a button click (EDIT existing entry)
async function openEditKeyMetrics(props) {
  const year = props.row.year
  const keyMetricsToEdit = allKeyMetricsList.value.find((element) => element.key === year)

  const obj = {
    year,
    dialog: true,
    key: year,
    seeVsEdit: 'edit',
    data: {
      incomeDict: keyMetricsToEdit.incomeDict,
      expensesDict: keyMetricsToEdit.expensesDict,
      savingsDict: keyMetricsToEdit.savingsDict,
    },
  }

  parentPropKeyMetrics.value = obj
  editMetrics.value = false
  return 'parent prop changed'
}

// STEP 4. Return to initial parentPropKeyMetrics when the edit is finished (function called from emit)
function resetKeyMetrics() {
  const obj = {
    year:
      allKeyMetricsList.value[0] && allKeyMetricsList.value[0].year
        ? allKeyMetricsList.value[0].year
        : new Date().getFullYear(),
    dialog: false,
    seeVsEdit: 'see',
    data: {
      incomeDict:
        allKeyMetricsList.value[0] && allKeyMetricsList.value[0].incomeDict
          ? allKeyMetricsList.value[0].incomeDict
          : zeroKeyMetricsIncome,
      expensesDict:
        allKeyMetricsList.value[0] && allKeyMetricsList.value[0].expensesDict
          ? allKeyMetricsList.value[0].expensesDict
          : zeroKeyMetricsExpenses,
      savingsDict:
        allKeyMetricsList.value[0] && allKeyMetricsList.value[0].savingsDict
          ? allKeyMetricsList.value[0].savingsDict
          : zeroKeyMetricsSavings,
    },
  }
  parentPropKeyMetrics.value = obj
}

// -------------------------- table networth --------------------------
const columnsNetworthEdit = ref([
  {
    name: 'date',
    label: 'Date',
    field: (row) => row.date,
    format: (val) => `${val}`,
    align: 'center',
  },
  { name: 'networth', label: 'Networth', field: 'networth', align: 'center' },
  { name: 'edit', label: 'Edit/Copy', field: '', align: 'center' },
])

const columnsNetworthDelete = ref([
  {
    name: 'date',
    label: 'Date',
    field: (row) => row.date,
    format: (val) => `${val}`,
    align: 'center',
  },
  { name: 'networth', label: 'Networth', field: 'networth', align: 'center' },
  { name: 'delete', label: 'Delete', field: '', align: 'center' },
])

const rowsNetworth = computed(() => {
  try {
    const rows = allNetWorthList.value.map((item) => {
      return {
        timestamp: item.timestamp,
        date: item.date,
        networth: item.netWorthDict.totalNetWorth.toLocaleString('en-US', {
          style: 'currency',
          currency,
          maximumFractionDigits: 0,
        }),
      }
    })
    return rows
  } catch (error) {
    const rows = []
    return rows
  }
})

// -------------------------- table annual metrics --------------------------
const columnsAnnualMetricsEdit = ref([
  {
    name: 'year',
    label: 'Year',
    field: (row) => row.year,
    format: (val) => `${val}`,
    align: 'center',
  },
  { name: 'income', label: 'Income', field: 'income', align: 'center' },
  { name: 'expenses', label: 'Expenses', field: 'expenses', align: 'center' },
  { name: 'savings', label: 'Savings', field: 'savings', align: 'center' },
  { name: 'edit', label: 'Edit/Copy', field: '', align: 'center' },
])

const columnsAnnualMetricsDelete = ref([
  {
    name: 'year',
    label: 'Year',
    field: (row) => row.year,
    format: (val) => `${val}`,
    align: 'center',
  },
  { name: 'income', label: 'Income', field: 'income', align: 'center' },
  { name: 'expenses', label: 'Expenses', field: 'expenses', align: 'center' },
  { name: 'savings', label: 'Savings', field: 'savings', align: 'center' },
  { name: 'delete', label: 'Delete', field: '', align: 'center' },
])

const rowsAnnualMetrics = computed(() => {
  try {
    const rows = []
    for (let i = 0; i < allKeyMetricsList.value.length; i++) {
      const obj = {}
      obj.timestamp = allKeyMetricsList.value[i].timestamp
      obj.year = allKeyMetricsList.value[i].year
      obj.income = allKeyMetricsList.value[i].incomeDict.totalIncome.toLocaleString('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      })
      obj.expenses = allKeyMetricsList.value[
        i
      ].expensesDict.totalExpenses.regularExpenses.toLocaleString('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      })
      obj.savings = allKeyMetricsList.value[i].savingsDict.annualSavingsRate.toLocaleString(
        'en-US',
        { style: 'currency', currency, maximumFractionDigits: 0 },
      )
      rows.push(obj)
    }
    return rows
  } catch (error) {
    const rows = []
    return rows
  }
})

// ------------------------------ DELETE function -------------------------
async function deleteRow(props) {
  if (modelMetricsTab.value === 'networth') {
    const timestamp = props.row.timestamp
    const year = new Date(timestamp).getFullYear()
    let month = new Date(timestamp).getMonth() + 1 // Adding 1 because getMonth() returns zero-based month
    if (month < 10) {
      month = '0' + month.toString()
    } else {
      month.toString()
    }

    const id = `${year.toString()}` + month

    await updateDoc(doc(db, 'users', storeAuth.user.id, 'networth', 'networthAssetsDoc'), {
      [id]: deleteField(),
    })

    await updateDoc(doc(db, 'users', storeAuth.user.id, 'networth', 'networthLiabilitiesDoc'), {
      [id]: deleteField(),
    })

    await updateDoc(doc(db, 'users', storeAuth.user.id, 'networth', 'networthTotalDoc'), {
      [id]: deleteField(),
    })

    // notify that form saving was done succesfully
    $q.notify({
      message: 'Networth deleted from database',
      color: 'positive',
      icon: 'check_circle',
      timeout: 1000,
    })
  } else {
    const year = props.row.year.toString()

    await updateDoc(doc(db, 'users', storeAuth.user.id, 'keyMetrics', 'metricsExpensesDoc'), {
      [year]: deleteField(),
    })

    await updateDoc(doc(db, 'users', storeAuth.user.id, 'keyMetrics', 'metricsIncomeDoc'), {
      [year]: deleteField(),
    })

    await updateDoc(doc(db, 'users', storeAuth.user.id, 'keyMetrics', 'metricsSavingsDoc'), {
      [year]: deleteField(),
    })

    // notify that form saving was done succesfully
    $q.notify({
      message: 'Annual metrics deleted from database',
      color: 'positive',
      icon: 'check_circle',
      timeout: 1000,
    })
  }
  const networthUpdatedList = storeNetworth.getAllNetWorthList
  const keyMetricsUpdatedList = storeKeyMetrics.getAllKeyMetricsList

  if (networthUpdatedList.length === 0 || keyMetricsUpdatedList === 0) {
    console.log('zero')
    await updateDoc(doc(db, 'users', storeAuth.user.id), {
      plan: '',
    })
  }
}
</script>

<!------------------------------------------------------------------------------------------------------->
<!-------------------------------------------- STYLE ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<style scoped></style>
