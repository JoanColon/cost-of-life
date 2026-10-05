<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------ TEMPLATE --------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<template>
  <div style="max-width: 1100px; margin: auto">
    <!-- table main info -->
    <q-table
      class="q-my-md q-mx-sm"
      :title="tablePropsData.tableTitle"
      :rows="tablePropsData.rows"
      :columns="tablePropsData.columns"
      :filter="filter"
      :visible-columns="tablePropsData.visibleColumns"
      :pagination="pagination"
      row-key="name"
      dense
    >
      <!-- slot to color daily gains -->
      <template v-slot:body-cell-regularMarketChangePercent="props">
        <q-td :props="props">
          <p
            :class="{
              'q-py-none': true,
              'q-my-none': true,
              'text-red': props.value.startsWith('-'),
              'text-green': !props.value.startsWith('-'),
            }"
          >
            {{ props.value }}
          </p>
        </q-td>
      </template>

      <!-- slot to color return -->
      <template v-slot:body-cell-totalReturn="props">
        <q-td :props="props">
          <p
            :class="{
              'q-py-none': true,
              'q-my-none': true,
              'text-red': props.value.startsWith('-'),
              'text-green': !props.value.startsWith('-'),
            }"
          >
            {{ props.value }}
          </p>
        </q-td>
      </template>

      <!-- slot for the filter on the top of the table -->
      <template v-slot:top-right>
        <q-input borderless dense debounce="300" v-model="filter" placeholder="Search">
          <template v-slot:append>
            <q-icon name="search" />
          </template>
        </q-input>
      </template>

      <!-- slot for the info, edit & delete buttons in the actions row -->
      <!-- only for detailCashSavings -->
      <template
        v-if="investmentDetailName === 'detailCashSavings'"
        v-slot:body-cell-actions="props"
      >
        <q-td :props="props">
          <q-btn
            dense
            round
            flat
            color="black"
            @click="((propsEdit = props.row), infoTabs === 'order', (editCashSavings = true))"
            icon="edit"
          ></q-btn>
          <q-btn
            dense
            round
            flat
            color="red"
            @click="((propsDelete = props.row), (deleteEntry = true))"
            icon="delete"
          ></q-btn>
        </q-td>
      </template>

      <!-- only for detailBusinessEquity -->
      <template
        v-else-if="investmentDetailName === 'detailBusinessEquity'"
        v-slot:body-cell-actions="props"
      >
        <q-td :props="props">
          <q-btn
            dense
            round
            flat
            color="black"
            @click="((propsEdit = props.row), infoTabs === 'order', (editSymbol = true))"
            icon="edit"
          ></q-btn>
          <q-btn
            dense
            round
            flat
            color="red"
            @click="((propsDelete = props.row), (deleteEntry = true))"
            icon="delete"
          ></q-btn>
        </q-td>
      </template>

      <!-- only for other investments -->
      <template
        v-else-if="investmentDetailName === 'detailOthers'"
        v-slot:body-cell-actions="props"
      >
        <q-td :props="props">
          <q-btn
            dense
            round
            flat
            color="black"
            @click="((propsEdit = props.row), infoTabs === 'order', (editCashSavings = true))"
            icon="edit"
          ></q-btn>
          <q-btn
            dense
            round
            flat
            color="red"
            @click="((propsDelete = props.row), (deleteEntry = true))"
            icon="delete"
          ></q-btn>
        </q-td>
      </template>

      <!-- only for other cryptoAssets -->
      <template
        v-else-if="investmentDetailName === 'detailCryptoAssets'"
        v-slot:body-cell-actions="props"
      >
        <q-td :props="props">
          <q-btn
            dense
            round
            flat
            color="orange"
            @click="((propsInfo = props.row), (infoCompany = true))"
            icon="info"
          ></q-btn>
          <q-btn
            dense
            round
            flat
            color="black"
            @click="((propsEdit = props.row), (editCrypto = true))"
            icon="edit"
          ></q-btn>
          <q-btn
            dense
            round
            flat
            color="red"
            @click="((propsDelete = props.row), (deleteEntry = true))"
            icon="delete"
          ></q-btn>
        </q-td>
      </template>

      <!-- for the other investment categories -->
      <template v-else v-slot:body-cell-actions="props">
        <q-td :props="props">
          <q-btn
            dense
            round
            flat
            color="orange"
            @click="((propsInfo = props.row), (infoCompany = true))"
            icon="info"
          ></q-btn>
          <q-btn
            dense
            round
            flat
            color="black"
            @click="((propsEdit = props.row), infoTabs === 'order', (editSymbol = true))"
            icon="edit"
          ></q-btn>
          <q-btn
            dense
            round
            flat
            color="red"
            @click="((propsDelete = props.row), (deleteEntry = true))"
            icon="delete"
          ></q-btn>
        </q-td>
      </template>

      <!-- slot for the add company and select column buttons -->
      <template v-slot:bottom="scope">
        <div class="row">
          <!-- table bottom buttons (add company and select columns) -->
          <div>
            <!-- add company -->
            <q-btn
              v-if="investmentDetailName === 'detailCashSavings'"
              flat
              no-caps
              icon="playlist_add"
              @click="newCashSavings = true"
            >
              Add name
            </q-btn>

            <q-btn
              v-else-if="investmentDetailName === 'detailBusinessEquity'"
              flat
              no-caps
              icon="playlist_add"
              @click="newBusinessEquity = true"
            >
              Add name
            </q-btn>

            <q-btn
              v-else-if="investmentDetailName === 'detailOthers'"
              flat
              no-caps
              icon="playlist_add"
              @click="newCashSavings = true"
            >
              Add name
            </q-btn>

            <q-btn v-else flat no-caps icon="playlist_add" @click="newCompany = true">
              Add symbol
            </q-btn>

            <!-- select columns to display -->
            <q-btn
              v-if="$q.screen.width > 400"
              flat
              no-caps
              icon="o_visibility"
              @click="tableColumns = true"
            >
              Select columns
            </q-btn>
          </div>

          <!-- pagination -->
          <div class="absolute-bottom-right">
            <q-btn
              v-if="scope.pagesNumber > 2"
              icon="first_page"
              color="grey-8"
              round
              dense
              flat
              :disable="scope.isFirstPage"
              @click="scope.firstPage"
            />

            <q-btn
              icon="chevron_left"
              color="grey-8"
              round
              dense
              flat
              :disable="scope.isFirstPage"
              @click="scope.prevPage"
            />

            <q-btn
              icon="chevron_right"
              color="grey-8"
              round
              dense
              flat
              :disable="scope.isLastPage"
              @click="scope.nextPage"
            />

            <q-btn
              v-if="pagesNumber > 2"
              icon="last_page"
              color="grey-8"
              round
              dense
              flat
              :disable="scope.isLastPage"
              @click="scope.lastPage"
            />
          </div>
        </div>
      </template>
    </q-table>

    <!--------------------------------- dialog Actions buttons (body-cell-actions slot) ------------------------------->
    <!-- Info button -->
    <q-dialog v-model="infoCompany">
      <CardMoreInfo :moreInfoProps="moreInfoProps" />
    </q-dialog>

    <!-- Edit button -->
    <q-dialog v-model="editSymbol">
      <CardEditSymbol :editSymbolProps="editSymbolProps" />
    </q-dialog>

    <q-dialog v-model="editCrypto">
      <CardEditCrypto :editCryptoProps="editCryptoProps" />
    </q-dialog>

    <q-dialog v-model="editCashSavings">
      <CardEditSavingsOthers :editCashSavingsProps="editCashSavingsProps" />
    </q-dialog>

    <!-- Delete button -->
    <q-dialog v-model="deleteEntry">
      <CardDeleteOrder :deleteOrderProps="deleteOrderProps" />
    </q-dialog>

    <!--------------------------------------- dialog Bottom buttons (bottom slot) -------------------------------------->
    <!-- Add new company -->
    <q-dialog v-model="newCompany">
      <CardAddSymbol :addCompanyProps="addCompanyProps" />
    </q-dialog>

    <q-dialog v-model="newBusinessEquity">
      <CardAddBusinessEquity :addCompanyProps="addCompanyProps" />
    </q-dialog>

    <q-dialog v-model="newCashSavings">
      <CardAddSavingsOthers :addNameProps="addNameProps" />
    </q-dialog>

    <!-- select columns to display -->
    <q-dialog v-model="tableColumns">
      <CardViewColumns :columnsView="columnsView" />
    </q-dialog>
  </div>
</template>

<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------- SCRIPT ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<!-- eslint-disable no-unused-vars -->
<script setup>
import { ref, computed, toRefs } from 'vue'
import { storeToRefs } from 'pinia'
import { useQuasar } from 'quasar'

// import components
import CardViewColumns from './CardViewColumns.vue'
import CardAddSymbol from './CardAddSymbol.vue'
import CardAddSavingsOthers from './CardAddSavingsOthers.vue'
import CardAddBusinessEquity from './CardAddBusinessEquity.vue'
import CardMoreInfo from './CardMoreInfo.vue'
import CardEditSymbol from './CardEditSymbol.vue'
import CardEditCrypto from './CardEditCrypto.vue'
import CardEditSavingsOthers from './CardEditSavingsOthers.vue'
import CardDeleteOrder from './CardDeleteOrder.vue'

// import stores
import { useStoreUserSettings } from 'src/stores/storeUserSettings'
const storeUserSettings = useStoreUserSettings()

// get reactive data from stores
const { userSettings } = storeToRefs(storeUserSettings)

// props recieved from parent company (detailed investments components)
const props = defineProps(['tablePropsData'])
const { tablePropsData } = toRefs(props)

// show/hide table modals
const newCompany = ref(false)
const newCashSavings = ref(false)
const newBusinessEquity = ref(false)
const tableColumns = ref(false)
const infoCompany = ref(false)
const editSymbol = ref(false)
const editCrypto = ref(false)
const editCashSavings = ref(false)
const deleteEntry = ref(false)

// import Quasar for q-screen
const $q = useQuasar()

// table filter
const filter = ref('')

// table pagination
const pagination = ref({
  sortBy: 'desc',
  descending: false,
  page: 1,
  rowsPerPage: 50,
})

const pagesNumber = computed(() => {
  const pagesNumber = Math.ceil(props.tablePropsData.rows.length / pagination.value.rowsPerPage)
  return pagesNumber
})

// ------------------------------------------------------------------------------------------------------
// -----------------------------------------  DIALOG (MODAL) DATA --------------------------------------
// ------------------------------------------------------------------------------------------------------

const investmentDetailName = ref(props.tablePropsData.investmentDetailName).value

// ----------------------------- PROPS TO SELECT COLUMNS DIALOG ------------------------------------------
// let columnsAllview = []
const color = 'orange'
const columnsAllview = [
  { value: 'symbol', label: 'Symbol', color },
  { value: 'country', label: 'Country', color },
  { value: 'currency', label: 'Currency', color },
  { value: 'shareAmount', label: 'Shares amount', color },
  { value: 'averagePrice', label: 'Average Price', color },
  { value: 'totalInvested', label: 'Total invested', color },
  { value: 'regularMarketPrice', label: 'Current Price', color },
  { value: 'regularMarketChangePercent', label: 'Daily P/L (%)', color },
  { value: 'totalReturn', label: 'Return (%)', color },
  { value: 'dividendYield', label: 'Income yield (%)', color },
  { value: 'priceToErningsRatio', label: 'PER', color },
  { value: 'marketValueBaseCurrency', label: 'Market value', color },
  { value: 'marketValueWeight', label: 'Market weight (%)', color },
  { value: 'marketValueFull', label: 'Market value & weight (%)', color },
  { value: 'annualDividendsBaseCurrency', label: 'Annual income', color },
  { value: 'incomeYearWeight', label: 'Income weight (%)', color },
  { value: 'incomeYearFull', label: 'Annual income & weight (%)', color },
]

// visibleColumns creates an array with columns that will have a checkbox ticket so will appear in the table
let visibleColumns = []
switch (investmentDetailName) {
  case investmentDetailName:
    visibleColumns = userSettings.value.investmentTableColumns[investmentDetailName]
    break
}

// columnsView props
const columnsView = computed(() => {
  const columnsView = {
    investmentDetailName,
    columnsAllview,
    visibleColumns,
  }
  return columnsView
})

// ------------------------------------ PROPS ADD NEW COMPANY -------------------------------------------
// inputs
const inputs = {}
switch (investmentDetailName) {
  case 'detailBrokerageAccount':
  case 'detailBusinessEquity':
    inputs.sectors = [
      'Basic materials',
      'Broad market (e.g., index ETF)',
      'Consumer cyclical',
      'Consumer defensive',
      'Communication services',
      'Energy',
      'Financial services',
      'Healthcare',
      'Industrials',
      'Real estate',
      'Technology',
      'Utilities',
    ]
    inputs.supersectors = ['Broad market (e.g., index ETF)', 'Cyclical', 'Defensive', 'Sensitive']
    break
  case 'detailRealEstate':
    inputs.sectors = ['Equity REIT', 'Mortage REIT']
    inputs.supersectors = ['n.a']
    break
  case 'detailFixedIncome':
    inputs.sectors = ['Government fixed income', 'Corporate fixed income']
    inputs.supersectors = ['n.a']
    break
  case 'detailCryptoAssets':
    inputs.sectors = [
      'utility',
      'payment',
      'security',
      'stablecoins',
      'DeFi',
      'tokens',
      'NFT',
      'asset-backed tokens',
    ]
    inputs.supersectors = ['n.a']
    break
}

// addCompany props
const addCompanyProps = computed(() => {
  const addCompanyProps = {
    investmentDetailName,
    inputs,
    rows: tablePropsData.value.rows,
  }
  return addCompanyProps
})

// AddName props - only for "Cash/Savings investments"
const addNameProps = computed(() => {
  const addCompanyProps = {
    investmentDetailName,
    rows: tablePropsData.value.rows,
  }
  return addCompanyProps
})

// ---------------------------------------  PROPS MORE INFO ---------------------------------------------
const propsInfo = ref({})

const moreInfoProps = computed(() => {
  const moreInfoProps = {
    investmentDetailName,
    propsInfo,
  }
  return moreInfoProps
})

// ---------------------------------------  PROPS EDIT SYMBOL ---------------------------------------------
const propsEdit = ref({})

const editSymbolProps = computed(() => {
  const editSymbolProps = {
    investmentDetailName,
    propsEdit,
    rows: tablePropsData.value.rows,
  }
  return editSymbolProps
})

// only for "Crypto investments"
const editCryptoProps = computed(() => {
  const editCryptoProps = {
    investmentDetailName,
    propsEdit,
    rows: tablePropsData.value.rows,
  }
  return editCryptoProps
})

// only for "Cash/Savings investments"
const editCashSavingsProps = computed(() => {
  const editCashSavingsProps = {
    investmentDetailName,
    propsEdit,
    rows: tablePropsData.value.rows,
  }
  return editCashSavingsProps
})

// ---------------------------------------  PROPS DELETE SYMBOL ---------------------------------------------
const propsDelete = ref({})

const deleteOrderProps = computed(() => {
  const deleteOrderProps = {
    investmentDetailName,
    propsDelete,
    rows: tablePropsData.value.rows,
  }
  return deleteOrderProps
})
</script>

<!------------------------------------------------------------------------------------------------------->
<!-------------------------------------------- STYLE ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<style scoped>
.text-red {
  color: red;
}

.text-green {
  color: green;
}
</style>
