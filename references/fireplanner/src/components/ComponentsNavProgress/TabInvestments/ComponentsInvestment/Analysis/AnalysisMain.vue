<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------ TEMPLATE --------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<template>
  <div>
    <div class="q-mt-sm q-ml-sm" style="max-width: 1000px">
      <!--------------------------------- main body desktop ------------------------------->
      <div class="row" v-if="$q.screen.width > 1021">
        <!--------------------------- navigation bar ---------------------------->
        <div class="col-2 q-pl-none q-mr-lg" style="border-right: 1px solid grey">
          <!-- select symbol -->
          <div style="display: flex; justify-content: space-evenly">
            <q-btn class="q-mr-md" flat size="sm" icon="arrow_back" @click="minusSymbolDetail()" />
            <q-btn class="q-ml-sm" flat size="sm" icon="arrow_forward" @click="addSymbolDetail()" />
          </div>

          <q-select
            class="q-mb-lg q-mr-lg"
            v-model="symbolModel"
            :options="symbolOptions"
            label="Symbol"
          />

          <!-- analysis sections -->
          <q-list v-for="section in analysisSections" :key="section.id">
            <q-item clickable @click="showSection(section.name)">
              {{ section.label }}
            </q-item>
          </q-list>

          <q-separator style="width: 90%" />

          <div class="q-mt-lg q-pl-md text-body2">Summary</div>
        </div>

        <!--------------------------- section components ---------------------------->
        <div class="col">
          <CandlestickChart v-if="showSectionModel === 'candlestickChart'" :symbol="symbolModel" />
          <HistoricDividends
            v-if="showSectionModel === 'historicDividends'"
            :symbol="symbolModel"
          />
          <FinancialTables v-if="showSectionModel === 'financials'" :symbol="symbolModel" />
          <FinancialRatios v-if="showSectionModel === 'financialRatios'" :symbol="symbolModel" />
          <SymbolValuation v-if="showSectionModel === 'valuation'" :symbol="symbolModel" />
        </div>
      </div>

      <!--------------------------------- main body mobile ------------------------------->
      <div class="row" style="display: block" v-else>
        <!--------------------------- navigation bar ---------------------------->
        <div style="display: flex; justify-content: space-around">
          <!-- select symbol -->
          <q-select
            class="q-mb-lg q-mr-lg"
            v-model="symbolModel"
            :options="symbolOptions"
            label="Symbol"
            style="width: 100px"
          />

          <q-select
            class="q-mb-lg q-mr-lg"
            v-model="showSectionModel"
            :options="[
              'candlestickChart',
              'historicDividends',
              'financials',
              'financialRatios',
              'valuation',
            ]"
            label="Symbol"
          />
        </div>

        <!--------------------------- section components ---------------------------->
        <div>
          <CandlestickChart v-if="showSectionModel === 'candlestickChart'" :symbol="symbolModel" />
          <HistoricDividends
            v-if="showSectionModel === 'historicDividends'"
            :symbol="symbolModel"
          />
          <FinancialTables v-if="showSectionModel === 'financials'" :symbol="symbolModel" />
          <FinancialRatios v-if="showSectionModel === 'financialRatios'" :symbol="symbolModel" />
          <SymbolValuation v-if="showSectionModel === 'valuation'" :symbol="symbolModel" />
        </div>
      </div>

      <!--------------------------------- action buttons ------------------------------->
      <div class="row" style="display: flex; justify-content: space-around">
        <q-btn
          class="q-mt-lg"
          label="Get Chart data"
          rounded
          color="orange"
          no-caps
          flat
          @click="processChartDataSymbols(symbolOptions)"
        />

        <q-btn
          class="q-mt-lg"
          label="Get financials"
          rounded
          color="orange"
          no-caps
          flat
          @click="processFinancialsymbols(symbolOptions)"
        />
      </div>
    </div>
  </div>
</template>

<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------- SCRIPT ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<!-- eslint-disable no-unused-vars -->
<script setup>
import { ref, toRefs } from 'vue'
import { storeToRefs } from 'pinia'
import { useQuasar } from 'quasar'
import { getFunctions, httpsCallable } from 'firebase/functions'

import { useStoreAuth } from 'src/stores/storeAuth'
const storeAuth = useStoreAuth()

// needed to call a firebase function
const functions = getFunctions()

// import components
import CandlestickChart from 'src/components/ComponentsNavProgress/TabInvestments/ComponentsInvestment/Analysis/CandlestickChart.vue'
import HistoricDividends from 'src/components/ComponentsNavProgress/TabInvestments/ComponentsInvestment/Analysis/HistoricDividends.vue'
import FinancialTables from 'src/components/ComponentsNavProgress/TabInvestments/ComponentsInvestment/Analysis/FinancialTables.vue'
import FinancialRatios from 'src/components/ComponentsNavProgress/TabInvestments/ComponentsInvestment/Analysis/FinancialRatios.vue'
import SymbolValuation from 'src/components/ComponentsNavProgress/TabInvestments/ComponentsInvestment/Analysis/SymbolValuation.vue'

// import own functions
// import { getSymbolChartData, getSymbolFinancials } from 'src/js/rapidApiCall'
import { getSymbolChartData } from 'src/js/rapidApiCall'

// import stores
import { useStoreInvestments } from 'src/stores/storeInvestments'
const storeInvestments = useStoreInvestments()

// get reactive data from stores
const { getRapidApiSymbols } = storeToRefs(storeInvestments)

const $q = useQuasar()

// select initial component view and change it on a button click
const analysisSections = [
  {
    id: 0,
    name: 'candlestickChart',
    label: 'Candlestick chart',
  },
  {
    id: 1,
    name: 'historicDividends',
    label: 'Historic dividends',
  },
  {
    id: 2,
    name: 'financials',
    label: 'Financial statements',
  },
  {
    id: 3,
    name: 'financialRatios',
    label: 'Financial ratios',
  },
  {
    id: 4,
    name: 'valuation',
    label: 'Valuation',
  },
]

const showSectionModel = ref('candlestickChart')

function showSection(sectionName) {
  showSectionModel.value = sectionName
}

// get props form InvestmentMainComponent
const props = defineProps(['investmentDetailName'])
const investmentDetailName = props.investmentDetailName

// populate the seclect and store it in the symbolModel
const symbolOptions = getRapidApiSymbols.value.yahooFinanceSymbolsCategories[investmentDetailName]
const symbolModel = ref(symbolOptions[0])

// ------------ functions to move the symbols without needed to select them -----------------------
let symbolDetailPosition = 0
function addSymbolDetail() {
  const position = symbolOptions.indexOf(symbolModel.value)
  const maxLenght = symbolOptions.length - 1

  if (symbolDetailPosition < maxLenght) {
    symbolDetailPosition = position + 1
    symbolModel.value = symbolOptions[symbolDetailPosition]
  }
}

function minusSymbolDetail() {
  const position = symbolOptions.indexOf(symbolModel.value)

  if (symbolDetailPosition !== 0) {
    symbolDetailPosition = position - 1
    symbolModel.value = symbolOptions[symbolDetailPosition]
  }
}

// -------------------------------- update all symbols -----------------------------
async function getChartDataSymbol(symbolModel) {
  const symbol = symbolModel
  // notify that form saving was done succesfully
  $q.notify({
    message: `Fetching ${symbol} data`,
    color: 'positive',
    icon: 'check_circle',
    timeout: 1000,
  })

  const response = await getSymbolChartData(symbol)
  if (response === 'successful operation') {
    $q.notify({
      message: `${symbol} data added to database`,
      color: 'positive',
      icon: 'check_circle',
      timeout: 1000,
    })
  } else {
    $q.notify({
      message: `${symbol} data NOT added to database`,
      color: 'negative',
      icon: 'report_problem',
      timeout: 1000,
    })
  }
}

async function processChartDataSymbols(symbolOptions) {
  console.log('START UPDATING OPERATION... WAIT, IT WILL TAKE SOME TIME')
  for (const symbol of symbolOptions) {
    await getChartDataSymbol(symbol)
  }
  console.log('UPDATE FINISHED SUCCESFULLY')
}

// -----------

/* async function getFinancialsSymbol (symbolModel) {
  const symbol = symbolModel
  // notify that form saving was done succesfully
  $q.notify({
    message: `Fetching ${symbol} data`,
    color: 'positive',
    icon: 'check_circle',
    timeout: 1000
  })

  const response = await getSymbolFinancials(symbol)
  if (response === 'successful operation') {
    $q.notify({
      message: `${symbol} data added to database`,
      color: 'positive',
      icon: 'check_circle',
      timeout: 1000
    }) 
  } else {
    $q.notify({
      message: `${symbol} data NOT added to database`,
      color: 'negative',
      icon: 'report_problem',
      timeout: 1000
    })
  }
} */

async function processFinancialsymbols(symbolOptions) {
  console.log('START UPDATING OPERATION... WAIT, IT WILL TAKE SOME TIME')
  const getSymbolFinancials = httpsCallable(functions, 'getSymbolFinancials')
  const result = await getSymbolFinancials(symbolOptions) // Wait for the Firebase function to complete
  console.log(result, 'UPDATE FINISHED SUCCESFULLY')
}
</script>

<!------------------------------------------------------------------------------------------------------->
<!-------------------------------------------- STYLE ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<style scoped></style>
