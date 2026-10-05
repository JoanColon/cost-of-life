<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------ TEMPLATE --------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<template>
  <div style="max-width: 1100px; margin: auto">
    <!------------------------------------------ tabs header ---------------------------------------------->
    <div v-if="$q.screen.width > 450" style="display: flex">
      <q-btn flat no-caps color="black" icon="arrow_circle_left" @click="$emit('hideDetail')">
      </q-btn>

      <q-tabs v-model="tab" inline-label outside-arrows mobile-arrows no-caps align="left">
        <q-tab name="brokerTable" icon="o_table_chart" label="Table" />
        <q-tab name="brokerCharts" icon="o_pie_charts" label="Charts" />
        <q-tab
          v-if="
            investmentDetailName === 'detailBrokerageAccount' ||
            investmentDetailName === 'detailRealEstate' ||
            investmentDetailName === 'detailFixedIncome'
          "
          name="dividends"
          icon="attach_money"
          label="Dividends"
        />
        <q-tab
          v-if="
            investmentDetailName === 'detailBrokerageAccount' ||
            investmentDetailName === 'detailRealEstate' ||
            investmentDetailName === 'detailFixedIncome'
          "
          name="analysis"
          icon="waterfall_chart"
          label="Analysis"
        />
      </q-tabs>
    </div>

    <div v-else style="display: flex">
      <q-btn flat no-caps color="black" icon="arrow_circle_left" @click="$emit('hideDetail')">
      </q-btn>

      <div style="max-width: 300px">
        <q-tabs v-model="tab" inline-label outside-arrows mobile-arrows no-caps align="left">
          <q-tab name="brokerTable" icon="o_table_chart" label="Table" />
          <q-tab name="brokerCharts" icon="o_pie_charts" label="Charts" />
          <q-tab
            v-if="
              investmentDetailName === 'detailBrokerageAccount' ||
              investmentDetailName === 'detailRealEstate' ||
              investmentDetailName === 'detailFixedIncome'
            "
            name="dividends"
            icon="attach_money"
            label="Dividends"
          />
          <q-tab
            v-if="
              investmentDetailName === 'detailBrokerageAccount' ||
              investmentDetailName === 'detailRealEstate' ||
              investmentDetailName === 'detailFixedIncome'
            "
            name="analysis"
            icon="waterfall_chart"
            label="Analysis"
          />
        </q-tabs>
      </div>
    </div>

    <!--------------------------------------- cards component --------------------------------------------->
    <div>
      <HeaderCards
        v-if="tab !== 'dividends' && tab !== 'analysis'"
        :card-Props-Data="cardPropsData"
      />
    </div>
    <!--------------------------------------- table component --------------------------------------------->
    <div v-if="tab === 'brokerTable'">
      <InvestmentsTable :table-Props-Data="tablePropsData" />
    </div>

    <div v-else-if="tab === 'brokerCharts'">
      <PieChartInvestment :table-Props-Data="tablePropsData" />
    </div>

    <div v-else-if="tab === 'dividends'">
      <DividendHistoricMain :investmentDetailName="investmentDetailName" />
    </div>

    <div v-else>
      <AnalysisMain :investmentDetailName="investmentDetailName" />
    </div>
  </div>
</template>

<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------- SCRIPT ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<!-- eslint-disable no-unused-vars -->
<script setup>
import { ref, computed, defineProps, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useQuasar } from 'quasar'

// import components
import HeaderCards from './ComponentsInvestment/HeaderCards.vue'
import InvestmentsTable from './ComponentsInvestment/InvestmentsTable.vue'
import PieChartInvestment from './ComponentsInvestment/PieChartInvestment.vue'
import DividendHistoricMain from './ComponentsInvestment/Dividends/DividendHistoricMain.vue'
import AnalysisMain from './ComponentsInvestment/Analysis/AnalysisMain.vue'

// import and declare stores
import { useStoreUserSettings } from 'src/stores/storeUserSettings'
import { useStoreInvestments } from 'src/stores/storeInvestments'
import { useStoreSavings } from 'src/stores/storeSavings'

const storeUserSettings = useStoreUserSettings()
const storeInvestments = useStoreInvestments()
const storeSavings = useStoreSavings()

// get reactive data from stores
const { userSettings } = storeToRefs(storeUserSettings)
const { getBrokerageData } = storeToRefs(storeInvestments)

// get props form InvestmentMainComponent
const props = defineProps(['detailName'])

// define detail Name
const investmentDetailName = props.detailName

// mapping names
let investmentDetailText = ''
switch (investmentDetailName) {
  case 'detailBrokerageAccount':
    investmentDetailText = 'Brokerage account (e.g., stocks, etf, funds)'
    break
  case 'detailRealEstate':
    investmentDetailText = 'Real estate (income property)'
    break
  case 'detailFixedIncome':
    investmentDetailText = 'Fixed-income (e.g., bonds, CDs, prefeered shares)'
    break
  case 'detailCryptoAssets':
    investmentDetailText = 'Cryptoassets (e.g., cryptocurrencies, nft)'
    break
  case 'detailCashSavings':
    investmentDetailText = 'Cash/savings'
    break
  case 'detailBusinessEquity':
    investmentDetailText = 'Business equity'
    break
  case 'detailOthers':
    investmentDetailText = 'Others (e.g., gold, jewelry, art)'
    break
}

// stores variables
const currency = userSettings.value.currency
const taxRate = userSettings.value.taxRate
const visibleColumns = userSettings.value.investmentTableColumns[investmentDetailName]

// declare useQuasar (to use the "notify" plugin)
const $q = useQuasar()

// emits -> to change the view back to the investmentsMainComponent
const emit = defineEmits(['hideDetail'])

// to change the tab view
const tab = ref('brokerTable')

// ------------------------------------------ Cards ----------------------------------------------------------
// get cards data
const cardDataPortofolioMetrics = ref(getBrokerageData.value[1][investmentDetailName])
const cardDataSavings = ref(storeSavings.savingsTotals)
const fundsAdded = ref(
  cardDataSavings.value && cardDataSavings.value[investmentDetailText] !== undefined
    ? cardDataSavings.value[investmentDetailText]
    : 0,
)
const netBenefit = ref(cardDataPortofolioMetrics.value.portofolioMarketValue - fundsAdded.value)
const yieldOnCost = ref(cardDataPortofolioMetrics.value.AnnualExpectedIncome / fundsAdded.value)
const totalReturn = ref(netBenefit.value / fundsAdded.value)
const twr = ref(cardDataPortofolioMetrics.value.twr)
const twrAnnualAverage = ref(cardDataPortofolioMetrics.value.twrAnnualAverage)

const dailyGains = ref(0)
switch (investmentDetailName) {
  case 'detailBrokerageAccount':
  case 'detailRealEstate':
  case 'detailFixedIncome':
    dailyGains.value = cardDataPortofolioMetrics.value.portofolioDayGains
    break
  default:
    dailyGains.value = 0
}
const dailyGainsPercentage =
  dailyGains.value / cardDataPortofolioMetrics.value.portofolioMarketValue

const cardsInfo = ref([
  {
    id: 1,
    title: 'Portofolio',
    subtitleOne: 'Portofolio market value: ',
    subtitleTwo: 'Total funds added: ',
    subtitleThree: 'Net benefit: ',
    subtitleFourth: 'Daily gains: ',
    amountOne: cardDataPortofolioMetrics.value.portofolioMarketValue.toLocaleString('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 1,
    }),
    amountTwo: fundsAdded.value.toLocaleString('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 1,
    }),
    amountThree: netBenefit.value.toLocaleString('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 1,
    }),
    amountFourth:
      `${dailyGains.value.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 1 })} (${dailyGainsPercentage.toLocaleString('en-US', { style: 'percent', maximumFractionDigits: 1 })})` ||
      0,
    icon: 'myAssets/Portofolio.png',
  },
  {
    id: 2,
    title: 'Income',
    subtitleOne: 'Gross income: ',
    subtitleTwo: 'Net income: ',
    subtitleThree: 'Portofolio yield: ',
    subtitleFourth: 'Yield on funds added: ',
    amountOne: `${cardDataPortofolioMetrics.value.AnnualExpectedIncome.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 1 })}/year`,
    amountTwo: `${(cardDataPortofolioMetrics.value.AnnualExpectedIncome * (1 - taxRate)).toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 1 })}/year`,
    amountThree: cardDataPortofolioMetrics.value.currentIncomeYield.toLocaleString('en-US', {
      style: 'percent',
      maximumFractionDigits: 1,
    }),
    amountFourth: yieldOnCost.value.toLocaleString('en-US', {
      style: 'percent',
      maximumFractionDigits: 1,
    }),
    icon: 'myAssets/Yield.png',
  },
  {
    id: 3,
    title: 'Performance',
    subtitleOne: 'Total return: ',
    subtitleTwo: 'Time-weighted return: ',
    subtitleThree: 'Annual TWR: ',
    amountOne:
      totalReturn.value.toLocaleString('en-US', { style: 'percent', maximumFractionDigits: 1 }) ||
      0,
    amountTwo: twr.value.toLocaleString('en-US', { style: 'percent', maximumFractionDigits: 1 }),
    amountThree:
      twrAnnualAverage.value.toLocaleString('en-US', {
        style: 'percent',
        maximumFractionDigits: 1,
      }) || 0,
    icon: 'myAssets/Dividends.png',
  },
])

// update cardsInfo value
watch(getBrokerageData, (newData) => {
  cardDataPortofolioMetrics.value = newData[1][investmentDetailName]
  cardDataSavings.value = storeSavings.savingsTotals
  fundsAdded.value =
    cardDataSavings.value && cardDataSavings.value[investmentDetailText] !== undefined
      ? cardDataSavings.value[investmentDetailText]
      : 0
  netBenefit.value = cardDataPortofolioMetrics.value.portofolioMarketValue - fundsAdded.value
  yieldOnCost.value = cardDataPortofolioMetrics.value.AnnualExpectedIncome / fundsAdded.value
  totalReturn.value = netBenefit.value / fundsAdded.value
  twr.value = cardDataPortofolioMetrics.value.twr
  twrAnnualAverage.value = cardDataPortofolioMetrics.value.twrAnnualAverage

  cardsInfo.value = [
    {
      id: 1,
      title: 'Portofolio',
      subtitleOne: 'Portofolio market value: ',
      subtitleTwo: 'Total funds added: ',
      subtitleThree: 'Net benefit: ',
      subtitleFourth: 'Daily gains: ',
      amountOne: cardDataPortofolioMetrics.value.portofolioMarketValue.toLocaleString('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 1,
      }),
      amountTwo: fundsAdded.value.toLocaleString('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 1,
      }),
      amountThree: netBenefit.value.toLocaleString('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 1,
      }),
      amountFourth:
        `${dailyGains.value.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 1 })} (${dailyGainsPercentage.toLocaleString('en-US', { style: 'percent', maximumFractionDigits: 1 })})` ||
        0,
      icon: 'myAssets/Portofolio.png',
    },
    {
      id: 2,
      title: 'Income',
      subtitleOne: 'Gross income: ',
      subtitleTwo: 'Net income: ',
      subtitleThree: 'Portofolio yield: ',
      subtitleFourth: 'Yield on funds added: ',
      amountOne: `${cardDataPortofolioMetrics.value.AnnualExpectedIncome.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 1 })}/year`,
      amountTwo: `${(cardDataPortofolioMetrics.value.AnnualExpectedIncome * (1 - taxRate)).toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 1 })}/year`,
      amountThree: cardDataPortofolioMetrics.value.currentIncomeYield.toLocaleString('en-US', {
        style: 'percent',
        maximumFractionDigits: 1,
      }),
      amountFourth: yieldOnCost.value.toLocaleString('en-US', {
        style: 'percent',
        maximumFractionDigits: 1,
      }),
      icon: 'myAssets/Yield.png',
    },
    {
      id: 3,
      title: 'Performance',
      subtitleOne: 'Total return: ',
      subtitleTwo: 'Time-weighted return: ',
      subtitleThree: 'Annual TWR: ',
      amountOne:
        totalReturn.value.toLocaleString('en-US', { style: 'percent', maximumFractionDigits: 1 }) ||
        0,
      amountTwo: twr.value.toLocaleString('en-US', { style: 'percent', maximumFractionDigits: 1 }),
      amountThree:
        twrAnnualAverage.value.toLocaleString('en-US', {
          style: 'percent',
          maximumFractionDigits: 1,
        }) || 0,
      icon: 'myAssets/Dividends.png',
    },
  ]
})

const cardPropsData = computed(() => {
  const obj = {
    cardsInfo: cardsInfo.value,
  }
  return obj
})

// ------------------------------- main table info -----------------------------------------------------
const columnTypes = [
  {
    name: 'symbol',
    label: 'Symbol',
    field: (row) => row.symbol,
    format: (val) => `${val}`,
    align: 'center',
    sortable: true,
    required: true,
  },
  { name: 'country', label: 'Country', field: 'country', align: 'center', sortable: true },
  { name: 'currency', label: 'Currency', field: 'currency', align: 'center', sortable: true },
  {
    name: 'totalInvested',
    label: 'Amount invested',
    field: 'totalInvested',
    align: 'center',
    sortable: true,
  },
  {
    name: 'shareAmount',
    label: 'Share amount',
    field: 'shareAmount',
    align: 'center',
    format: (val) => `${val.toLocaleString('en-US', { maximumFractionDigits: 3 })}`,
  },
  { name: 'averagePrice', label: 'Average price', field: 'averagePrice', align: 'center' },
  {
    name: 'regularMarketPrice',
    label: 'Current price',
    field: 'regularMarketPrice',
    align: 'center',
  },
  {
    name: 'regularMarketChangePercent',
    label: 'Daily P/L',
    field: 'regularMarketChangePercent',
    align: 'center',
    sortable: true,
    format: (val) =>
      `${val.toLocaleString('en-US', { style: 'percent', maximumFractionDigits: 2 })}`,
  },
  {
    name: 'totalReturn',
    label: 'Return',
    field: 'totalReturn',
    align: 'center',
    sortable: true,
    format: (val) =>
      `${val.toLocaleString('en-US', { style: 'percent', maximumFractionDigits: 1 })}`,
  },
  {
    name: 'dividendYield',
    label: 'Income yield',
    field: 'dividendYield',
    align: 'center',
    sortable: true,
    format: (val) =>
      `${val.toLocaleString('en-US', { style: 'percent', maximumFractionDigits: 1 })}`,
  },
  {
    name: 'priceToErningsRatio',
    label: 'PER',
    field: 'priceToErningsRatio',
    align: 'center',
    sortable: true,
    format: (val) => `${val.toLocaleString('en-US', { maximumFractionDigits: 1 })}`,
  },
  {
    name: 'marketValueBaseCurrency',
    label: 'Market value',
    field: 'marketValueBaseCurrency',
    align: 'center',
    sortable: true,
    format: (val) =>
      `${val.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 0 })}`,
  },
  {
    name: 'marketValueFull',
    label: 'Market value',
    field: (row) => row.marketValueBaseCurrency,
    align: 'center',
    sortable: true,
    format: (val, row) =>
      `${val.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 0 })} (${row.marketValueWeight.toLocaleString('en-US', { style: 'percent', maximumFractionDigits: 1 })})`,
  },
  {
    name: 'annualDividendsBaseCurrency',
    label: 'Annual income',
    field: 'annualDividendsBaseCurrency',
    align: 'center',
    sortable: true,
    format: (val) =>
      `${val.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 0 })}`,
  },
  {
    name: 'incomeYearFull',
    label: 'Annual income',
    field: (row) => row.annualDividendsBaseCurrency,
    align: 'center',
    sortable: true,
    format: (val, row) =>
      `${val.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 0 })} (${row.dividendsYearWeight.toLocaleString('en-US', { style: 'percent', maximumFractionDigits: 1 })})`,
  },
  {
    name: 'marketValueWeight',
    label: 'Market weight',
    field: 'marketValueWeight',
    align: 'center',
    sortable: true,
    format: (val) =>
      `${val.toLocaleString('en-US', { style: 'percent', maximumFractionDigits: 0 })}`,
  },
  {
    name: 'dividendsYearWeight',
    label: 'Income weight',
    field: 'dividendsYearWeight',
    align: 'center',
    sortable: true,
    format: (val) =>
      `${val.toLocaleString('en-US', { style: 'percent', maximumFractionDigits: 0 })}`,
  },
  { name: 'actions', label: 'Actions', field: 'actions', align: 'center' },
]

const columTypesMobile = [
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
      `${val.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 0 })} (${row.marketValueWeight.toLocaleString('en-US', { style: 'percent', maximumFractionDigits: 1 })})`,
  },
  {
    name: 'incomeYearFull',
    label: 'Annual income',
    field: (row) => row.annualDividendsBaseCurrency,
    align: 'center',
    sortable: true,
    format: (val, row) =>
      `${val.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 0 })} (${row.dividendsYearWeight.toLocaleString('en-US', { style: 'percent', maximumFractionDigits: 1 })})`,
  },
  { name: 'actions', label: 'Actions', field: 'actions', align: 'center' },
]

const columns = computed(() => {
  let columnSelection = []
  if ($q.screen.width > 450) {
    columnSelection = columnTypes
  } else {
    columnSelection = columTypesMobile
  }
  return columnSelection
})

// ------------------------------------------- table props --------------------------------------------
let tableTitle = ''
switch (investmentDetailName) {
  case 'detailBrokerageAccount':
    tableTitle = 'Stocks Portofolio'
    break
  case 'detailRealEstate':
    tableTitle = 'Real Estate Portofolio'
    break
  case 'detailFixedIncome':
    tableTitle = 'Fixed Income Portofolio'
    break
  case 'detailCryptoAssets':
    tableTitle = 'Cryptocurrency Portofolio'
    break
  case 'detailCashSavings':
    tableTitle = 'Cash/Savings Accounts'
    break
  case 'detailBusinessEquity':
    tableTitle = 'Business Equity Portofolio'
    break
  case 'detailOthers':
    tableTitle = 'Other Investments Portofolio'
    break
}

// to be able to update props in child, we need to pass props as computed properties
const tablePropsData = computed(() => {
  try {
    const tablePropsData = {
      tableTitle,
      investmentDetailName,
      columns: columns.value,
      rows: getBrokerageData.value[0][investmentDetailName],
      visibleColumns,
    }
    return tablePropsData
  } catch {
    return 'something went wrong, wait a moment'
  }
})
</script>

<!------------------------------------------------------------------------------------------------------->
<!-------------------------------------------- STYLE ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<style scoped></style>
