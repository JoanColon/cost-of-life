<!-- eslint-disable no-lone-blocks -->
<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------ TEMPLATE --------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<template>
  <div style="max-width: 1000px; margin: auto">
    <!-- desktop only -->
    <div v-if="$q.screen.width > 400">
      <div class="radioDiv">
        <q-radio
          v-for="chartType in chartTypesRadio"
          :key="chartType.id"
          v-model="chartView"
          :val="chartType.value"
          :label="chartType.label"
          color="orange"
        />
      </div>

      <div class="chartDiv q-mt-md">
        <div>
          <!-- <p style="text-align: center;"><strong>Portofolio distribution</strong></p> -->
          <GChart
            ref="myChart"
            type="PieChart"
            :data="chartData.chartStock"
            :options="chartOptionsStock"
            :events="chartEvents"
          />
        </div>

        <div>
          <!-- <p style="text-align:center"><strong>Dividends distribution</strong></p> -->
          <GChart
            type="PieChart"
            :data="chartData.chartDividend"
            :options="chartOptionsDividend"
            :events="chartEvents"
          />
        </div>
      </div>
    </div>

    <!-- mobile only -->
    <div v-else>
      <q-select
        class="q-ml-md"
        v-model="chartView"
        :options="chartTypes"
        label="Chart view"
        style="max-width: 80vw"
      />

      <div class="chartDiv q-mt-md">
        <div class="q-mb-md" style="width: 85vw">
          <!-- <p style="text-align: center;"><strong>Portofolio distribution</strong></p> -->
          <GChart
            type="PieChart"
            :data="chartData.chartStock"
            :options="chartOptionsStockMobile"
            :events="chartEvents"
          />
        </div>

        <div style="width: 85vw">
          <!-- <p style="text-align:center"><strong>Dividends distribution</strong></p> -->
          <GChart
            type="PieChart"
            :data="chartData.chartDividend"
            :options="chartOptionsDividendMobile"
            :events="chartEvents"
          />
        </div>
      </div>
    </div>

    <!-- dialog details -->
    <q-dialog v-model="openDetailDialog">
      <q-card style="width: 500px; max-width: 80vw">
        <q-card-section>
          <div style="display: flex; justify-content: space-between">
            <p class="q-mb-none q-pb-none" style="text-align: center; font-size: 16px">
              <strong>"{{ detailCriteria }}" {{ chartView }} details</strong>
            </p>
            <q-btn icon="close" flat round dense v-close-popup />
          </div>

          <p class="q-my-none">
            Market value: <strong> {{ detailMarketValue }} </strong>
          </p>
          <p class="q-my-none">
            Annual income: <strong> {{ detailAnnualIncome }}/year</strong>
          </p>
          <p class="q-mt-none, q-mb-sm">
            Dividend yield: <strong> {{ dividendYieldDetail }}</strong>
          </p>
        </q-card-section>

        <q-card-section class="q-mt-none">
          <q-table
            :rows="rowsDetails"
            :columns="columnsDetails"
            row-key="name"
            :rows-per-page-options="[0]"
            dense
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
import { ref, computed, toRefs } from 'vue'
import { storeToRefs } from 'pinia'
import _groupBy from 'lodash/groupBy'
import { GChart } from 'vue-google-charts'
import { useQuasar } from 'quasar'

// import and declare stores
import { useStoreUserSettings } from 'src/stores/storeUserSettings'
const storeUserSettings = useStoreUserSettings()

// get reactive data from stores
const { userSettings } = storeToRefs(storeUserSettings)
const currency = userSettings.value.currency

// declare useQuasar (to use the "notify" plugin)
const $q = useQuasar()

// props recieved from parent company (detailed investments components)
const props = defineProps(['tablePropsData'])
const { tablePropsData } = toRefs(props)

const investmentDetailName = tablePropsData.value.investmentDetailName

const chartView = ref('nonGrouped')
// const chartTypes = ['nonGrouped', 'country', 'currency', 'sector', 'superSector']
let chartTypesRadio = []
switch (investmentDetailName) {
  case 'detailBrokerageAccount':
  case 'detailBusinessEquity':
    chartTypesRadio = {
      0: { value: 'nonGrouped', label: 'Not grouped' },
      1: { value: 'country', label: 'Country' },
      2: { value: 'currency', label: 'Currency' },
      3: { value: 'sector', label: 'Sector' },
      4: { value: 'superSector', label: 'Super sector' },
    }
    break
  case 'detailRealEstate':
  case 'detailFixedIncome':
    chartTypesRadio = {
      0: { value: 'nonGrouped', label: 'Not grouped' },
      1: { value: 'country', label: 'Country' },
      2: { value: 'currency', label: 'Currency' },
      3: { value: 'sector', label: 'Sector' },
    }
    break
  case 'detailCashSavings':
  case 'detailOthers':
    chartTypesRadio = {
      0: { value: 'nonGrouped', label: 'Not grouped' },
      1: { value: 'currency', label: 'Currency' },
    }
    break
  case 'detailCryptoAssets':
    chartTypesRadio = {}
}

// select for mobile only
let chartTypes = []
switch (investmentDetailName) {
  case 'detailBrokerageAccount':
    chartTypes = ['nonGrouped', 'country', 'currency', 'sector', 'superSector']
    break
  case 'detailRealEstate':
    chartTypes = ['nonGrouped', 'country', 'currency', 'sector']
    break
}

// -------------------------------- CHART DATA ----------------------------------------------------------

// calculate chart data depending on the value of the radio button
const chartData = computed(() => {
  // STEP 1. get data for the pie chart
  const rows = tablePropsData.value.rows
  const groupedCountry = _groupBy(rows, 'country')
  const countries = Object.keys(groupedCountry)
  const groupedCurrency = _groupBy(rows, 'currency')
  const currency = Object.keys(groupedCurrency)
  const groupedSector = _groupBy(rows, 'sector')
  const sector = Object.keys(groupedSector)
  const groupedSuperSector = _groupBy(rows, 'superSector')
  const superSector = Object.keys(groupedSuperSector)

  // STEP 2. initial arrays containing the data for the piecharts
  const chartStock = [['Symbol', 'Market value']]

  const chartDividend = [['Symbol', 'Annual dividend']]

  // STEP 3. Switch statment depending on the radio button selection,
  // fill the chartStock and chartDividend arrays with chart values
  switch (chartView.value) {
    case 'nonGrouped':
      rows.forEach((element) => {
        const newStock = []
        const newIncome = []
        newStock.push(element.symbol)
        newStock.push(element.marketValueBaseCurrency)
        newIncome.push(element.symbol)
        newIncome.push(element.annualDividendsBaseCurrency)
        chartStock.push(newStock)
        chartDividend.push(newIncome)
      })
      break
    case 'country':
      countries.forEach((element) => {
        const newCountry = []
        const newDividend = []
        const totalValue = groupedCountry[element]
          .map((element) => element.marketValueBaseCurrency)
          .reduce((acc, cur) => acc + cur, 0)
        const totalDividend = groupedCountry[element]
          .map((element) => element.annualDividendsBaseCurrency)
          .reduce((acc, cur) => acc + cur, 0)
        newCountry.push(element, totalValue)
        newDividend.push(element, totalDividend)
        chartStock.push(newCountry)
        chartDividend.push(newDividend)
      })
      break
    case 'currency':
      currency.forEach((element) => {
        const newCurrency = []
        const newDividend = []
        const totalValue = groupedCurrency[element]
          .map((element) => element.marketValueBaseCurrency)
          .reduce((acc, cur) => acc + cur, 0)
        const totalDividend = groupedCurrency[element]
          .map((element) => element.annualDividendsBaseCurrency)
          .reduce((acc, cur) => acc + cur, 0)
        newCurrency.push(element, totalValue)
        newDividend.push(element, totalDividend)
        chartStock.push(newCurrency)
        chartDividend.push(newDividend)
      })
      break
    case 'sector':
      sector.forEach((element) => {
        const newSector = []
        const newDividend = []
        const totalValue = groupedSector[element]
          .map((element) => element.marketValueBaseCurrency)
          .reduce((acc, cur) => acc + cur, 0)
        const totalDividend = groupedSector[element]
          .map((element) => element.annualDividendsBaseCurrency)
          .reduce((acc, cur) => acc + cur, 0)
        newSector.push(element, totalValue)
        newDividend.push(element, totalDividend)
        chartStock.push(newSector)
        chartDividend.push(newDividend)
      })
      break
    case 'superSector':
      superSector.forEach((element) => {
        const newSuperSector = []
        const newIncome = []
        const totalValue = groupedSuperSector[element]
          .map((element) => element.marketValueBaseCurrency)
          .reduce((acc, cur) => acc + cur, 0)
        const totalDividend = groupedSuperSector[element]
          .map((element) => element.annualDividendsBaseCurrency)
          .reduce((acc, cur) => acc + cur, 0)
        newSuperSector.push(element, totalValue)
        newIncome.push(element, totalDividend)
        chartStock.push(newSuperSector)
        chartDividend.push(newIncome)
      })
      break
  }

  const chartData = {
    chartStock,
    chartDividend,
  }

  return chartData
})

// desktop chart optinons
const chartOptionsStock = {
  title: 'Portofolio distribution',
  legend: 'none',
  pieSliceText: 'label',
  chartArea: {
    height: '100%',
    width: '100%',
    left: 25,
    right: 0,
    top: 20,
  },
  height: 350,
}

const chartOptionsDividend = {
  title: 'Dividends distribution',
  legend: 'none',
  pieSliceText: 'label',
  chartArea: {
    height: '100%',
    width: '100%',
    left: 0,
    right: 0,
    top: 20,
  },
  height: 350,
}

// mobile chart options
const chartOptionsStockMobile = {
  title: 'Portofolio distribution',
  legend: 'none',
  pieSliceText: 'label',
  chartArea: {
    height: '100%',
    width: '100%',
    left: 0,
    right: 0,
    top: 20,
  },
  height: 300,
}

const chartOptionsDividendMobile = {
  title: 'Dividends distribution',
  legend: 'none',
  pieSliceText: 'label',
  chartArea: {
    height: '100%',
    width: '100%',
    left: 0,
    right: 0,
    top: 20,
  },
  height: 300,
}

// --------------------------------- CHART EVENTS -----------------------------------------------
const openDetailDialog = ref(false)
const rowsDetails = ref([])
const detailCriteria = ref('')
const detailMarketValue = ref(0)
const detailAnnualIncome = ref(0)
const dividendYieldDetail = ref(0)
const columnsDetails = [
  {
    name: 'symbol',
    label: 'Symbol',
    field: (row) => row.symbol,
    format: (val) => `${val}`,
    align: 'center',
    sortable: true,
    required: true,
  },
  {
    name: 'marketValueFull',
    label: 'Market value',
    field: (row) => row.marketValueBaseCurrency,
    align: 'center',
    sortable: true,
    format: (val, row) =>
      `${val.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 1 })} (${row.marketValueWeight.toLocaleString('en-US', { style: 'percent', maximumFractionDigits: 1 })})`,
  },
  {
    name: 'incomeYearFull',
    label: 'Annual income',
    field: (row) => row.annualDividendsBaseCurrency,
    align: 'center',
    sortable: true,
    format: (val, row) =>
      `${val.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 1 })} (${row.dividendsYearWeight.toLocaleString('en-US', { style: 'percent', maximumFractionDigits: 1 })})`,
  },
]

const chartEvents = {
  ready: () => {},
  click: (event) => {
    rowsDetails.value = []
    const id = Number(event.targetID.split('#')[1]) + 1
    const criteria = chartData.value.chartStock[id][0]
    const rows = tablePropsData.value.rows

    let filteredRows = []
    switch (chartView.value) {
      case 'nonGrouped':
        filteredRows = rows.filter((element) => element.symbol === criteria)
        break
      case 'country':
        filteredRows = rows.filter((element) => element.country === criteria)
        break
      case 'currency':
        filteredRows = rows.filter((element) => element.currency === criteria)
        break
      case 'sector':
        filteredRows = rows.filter((element) => element.sector === criteria)
        break
      case 'superSector':
        filteredRows = rows.filter((element) => element.superSector === criteria)
        break
    }

    filteredRows.forEach((row) => {
      const rowData = {
        symbol: row.symbol,
        marketValueBaseCurrency: row.marketValueBaseCurrency,
        marketValueWeight: row.marketValueWeight,
        annualDividendsBaseCurrency: row.annualDividendsBaseCurrency,
        dividendsYearWeight: row.dividendsYearWeight,
      }

      rowsDetails.value.push(rowData)
    })

    detailAnnualIncome.value = chartData.value.chartDividend[id][1].toLocaleString('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 1,
    })
    detailMarketValue.value = chartData.value.chartStock[id][1].toLocaleString('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 1,
    })
    dividendYieldDetail.value = (
      chartData.value.chartDividend[id][1] / chartData.value.chartStock[id][1]
    ).toLocaleString('en-US', { style: 'percent', maximumFractionDigits: 1 })
    detailCriteria.value = criteria

    openDetailDialog.value = true
  },
}
</script>

<!------------------------------------------------------------------------------------------------------->
<!-------------------------------------------- STYLE ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<style scoped>
.radioDiv {
  max-width: 800px;
  padding-top: 3vh;
  margin: auto;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-evenly;
}
.chartDiv {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
}
</style>
