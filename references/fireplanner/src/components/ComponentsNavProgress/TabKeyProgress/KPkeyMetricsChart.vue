<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------ TEMPLATE --------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<template>
  <div style="max-width: 1000px; margin: auto">
    <div
      class="q-mb-sm q-mt-none q-py-xs shadow-1 white-container"
      style="display: block; width: 100%"
    >
      <p class="q-mb-none q-mt-sm q-pb-none" style="text-align: center; font-size: 16px">
        <strong>Key Metrics progress</strong>
      </p>

      <GChart type="ColumnChart" :data="keyMetricsChart[0]" :options="keyMetricsChart[1]" />

      <q-expansion-item
        expand-separator
        label="Key metric details"
        header-class="text-weight-bold"
        v-model="expanded"
        :duration="duration"
      >
        <div
          class="q-pa-none q-mt-sm q-ml-sm q-mb-sm"
          style="display: flex; justify-content: space-between; width: 95%"
        >
          <q-radio v-model="radioBtn" color="orange" val="networth" label="Net worth" />
          <q-radio v-model="radioBtn" color="orange" val="income" label="Income" />
          <q-radio v-model="radioBtn" color="orange" val="expenses" label="Expenses" />
        </div>

        <div v-if="radioBtn === 'networth'" style="width: 100%">
          <GChart type="LineChart" :data="detailedChart[0]" :options="detailedChart[1]" />
        </div>

        <div v-else style="width: 100%">
          <GChart type="AreaChart" :data="detailedChart[0]" :options="detailedChart[1]" />
        </div>
      </q-expansion-item>
    </div>
  </div>
</template>

<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------- SCRIPT ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<script setup>
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { GChart } from 'vue-google-charts'

// import and declare stores
import { useStoreUserSettings } from 'src/stores/storeUserSettings'
import { useStoreKeyMetrics } from 'src/stores/storeKeyMetrics'
import { useStoreNetWorth } from 'src/stores/storeNetWorth'

const storeUserSettings = useStoreUserSettings()
const storeKeyMetrics = useStoreKeyMetrics()
const storeNetWorth = useStoreNetWorth()

// import reactive data from stores
const { currencyString } = storeToRefs(storeUserSettings)

// stores variables
const currencySymbol = currencyString.value
const allNetWorthList = storeNetWorth.getAllNetWorthList // from store getter
const allKeyMetricsList = storeKeyMetrics.getAllKeyMetricsList // from store getter

// to change the chart view
const radioBtn = ref('networth')

//  ---------------------------------------------- Key Metrics chart data -----------------------------------------
const keyMetricsChart = computed(() => {
  // -------------- get networth values ----------------
  const data = allNetWorthList

  // creates an array with the needed data of networth
  const networthArray = []
  for (let i = 0; i < data.length; i++) {
    const timestampDate = data[i].timestamp
    const currentDate = new Date(timestampDate)
    const networth = data[i].netWorthDict.totalNetWorth
    const year = currentDate.getFullYear()
    const networthPair = { year, currentDate, timestampDate, networth }
    networthArray.push(networthPair)
  }

  // group the networthArray into years
  const groupPairByCategory = networthArray.reduce((group, pair) => {
    ;(group[pair.year] = group[pair.year] || []).push(pair)
    return group
  }, {})

  // finds the object in groupPairByCategory with the last date (usually should be 31/12/year)
  const yearKey = Object.keys(groupPairByCategory)
  const networthYearArray = []
  yearKey.forEach((year) => {
    const lastDate = groupPairByCategory[year].reduce((acc, cur) => {
      return acc.timestampDate > cur.timestampDate ? acc : cur
    })

    networthYearArray.push(lastDate)
  })

  // ------------------ get annual metrics values --------------------
  const annualKeyMetrics = []
  for (let i = 0; i < allKeyMetricsList.length; i++) {
    const data = allKeyMetricsList[i]
    const year = data.year
    const income = data.incomeDict.totalIncome
    const expenses = data.expensesDict.totalExpenses.regularExpenses

    annualKeyMetrics.push({ year, income, expenses })
  }

  // ------------------- join nethworth and annual metrics data -----------------
  // chart data
  const keyMetricsChart = [['date', 'Annual income', 'Annual expenses', 'Net worth']]

  for (let i = 0; i < annualKeyMetrics.length; i++) {
    const date = Number(annualKeyMetrics[i].year)
    const income = annualKeyMetrics[i].income
    const expenses = annualKeyMetrics[i].expenses

    try {
      const nethworthYearMatch = networthYearArray.find(
        (element) => element.year.toString() === annualKeyMetrics[i].year,
      )
      const networth = nethworthYearMatch.networth
      keyMetricsChart.push([date, income, expenses, networth])
    } catch (e) {
      console.log(e, `missing networth for year ${date}`)
      const networth = null
      keyMetricsChart.push([date, income, expenses, networth])
    }
  }

  // chart options
  const keyMetricsOptions = {
    legend: { position: 'bottom' },
    seriesType: 'bars',
    series: {
      1: {
        type: 'bars',
        targetAxisIndex: 0,
      },
      2: {
        type: 'line',
        targetAxisIndex: 1,
      },
    },
    vAxes: {
      0: { title: `Income & Expenses (${currencySymbol}/year)` },
      1: { title: `Net worth (${currencySymbol})` },
    },
    chartArea: {
      left: 100,
      right: 100,
      top: 15,
    },
    height: 300,
  }

  return [keyMetricsChart, keyMetricsOptions]
})

// ------------------------------------------------- Detailed Chart --------------------------------------------------------
const expanded = ref(true)
const duration = 1

setTimeout(() => {
  expanded.value = false
}, 1)

const detailedChart = computed(() => {
  // net worth chart data
  const networthChart = [
    [
      'Date',
      { label: 'Real estate (home)', type: 'number' },
      { label: 'Real estate', type: 'number' },
      { label: 'Brokerage account', type: 'number' },
      { label: 'Fixed income instruments', type: 'number' },
      { label: 'Cryptoassets', type: 'number' },
      { label: 'Cash/savings', type: 'number' },
      { label: 'Business equity', type: 'number' },
      { label: 'Other assets', type: 'number' },
      { label: 'Mortage', type: 'number' },
      { label: 'Property loan', type: 'number' },
      { label: 'Vehicle loan', type: 'number' },
      { label: 'Student loan', type: 'number' },
      { label: 'Business loan', type: 'number' },
      { label: 'Ohter loans', type: 'number' },
    ],
  ]

  // net worth date arrays
  for (let i = 0; i < allNetWorthList.length; i++) {
    const data = allNetWorthList[i]
    const date = data.date
    networthChart.push([new Date(date)])
  }

  // networh arrays
  for (let i = 0; i < allNetWorthList.length; i++) {
    const dataNetworth = allNetWorthList[i].netWorthDict
    const assets = dataNetworth.assets
    const liabilities = dataNetworth.liabilities

    for (let j = 0; j < assets.length; j++) {
      networthChart[i + 1].push(assets[j].amount)
    }

    for (let j = 0; j < liabilities.length; j++) {
      networthChart[i + 1].push(liabilities[j].amount * -1)
    }
  }

  // eslint-disable-next-line no-unused-vars
  const newNetworthChart = networthChart.map((entry) => {
    for (let i = 0; i < entry.length; i++) {
      if (entry[i] === 0) {
        entry[i] = null
      }
    }
    return entry
  })

  // income and expenses chart data
  const incomeChart = [
    [
      'Date',
      { label: 'Primary job', type: 'number' },
      { label: 'Secondary job', type: 'number' },
      { label: 'Stock dividends', type: 'number' },
      { label: 'Rental income', type: 'number' },
      { label: 'Fixed income', type: 'number' },
      { label: 'Saving interest', type: 'number' },
      { label: 'Passive business', type: 'number' },
    ],
  ]

  const expensesChart = [
    [
      'Date',
      { label: 'Childcare', type: 'number' },
      { label: 'Debt payment', type: 'number' },
      { label: 'Entertainment', type: 'number' },
      { label: 'Groceries', type: 'number' },
      { label: 'Housing', type: 'number' },
      { label: 'Medical', type: 'number' },
      { label: 'Miscellaneous', type: 'number' },
      { label: 'Personal spending', type: 'number' },
      { label: 'Transportation', type: 'number' },
      { label: 'Utilities', type: 'number' },
    ],
  ]

  // income and expenses dates
  for (let i = 0; i < allKeyMetricsList.length; i++) {
    const data = allKeyMetricsList[i]
    // const date = data.dateString
    const date = data.year
    incomeChart.push([new Date(date)])
    expensesChart.push([new Date(date)])
  }

  // income arrays
  for (let i = 0; i < allKeyMetricsList.length; i++) {
    const data = allKeyMetricsList[i]
    const activeIncome = data.incomeDict.activeIncome
    const passiveIncome = data.incomeDict.passiveIncome

    for (let j = 0; j < activeIncome.length; j++) {
      incomeChart[i + 1].push(activeIncome[j].amount)
    }

    for (let j = 0; j < passiveIncome.length; j++) {
      incomeChart[i + 1].push(passiveIncome[j].amount)
    }
  }

  // eslint-disable-next-line no-unused-vars
  const newIncomeChart = incomeChart.map((entry) => {
    for (let i = 0; i < entry.length; i++) {
      if (entry[i] === 0) {
        entry[i] = null
      }
    }
    return entry
  })

  // expenses arrays
  for (let i = 0; i < allKeyMetricsList.length; i++) {
    const dataExpenses = allKeyMetricsList[i].expensesDict

    const reducedChildare = dataExpenses.childcare
      .map((item) => item.amount)
      .reduce((previousValue, currentValue) => previousValue + currentValue)
    const reducedDebtPayment = dataExpenses.debtPayment
      .map((item) => item.amount)
      .reduce((previousValue, currentValue) => previousValue + currentValue)
    const reducedEntertainment = dataExpenses.entertainment
      .map((item) => item.amount)
      .reduce((previousValue, currentValue) => previousValue + currentValue)
    const reducedGroceries = dataExpenses.groceries
      .map((item) => item.amount)
      .reduce((previousValue, currentValue) => previousValue + currentValue)
    const reducedHousing = dataExpenses.housing
      .map((item) => item.amount)
      .reduce((previousValue, currentValue) => previousValue + currentValue)
    const reducedMedical = dataExpenses.medical
      .map((item) => item.amount)
      .reduce((previousValue, currentValue) => previousValue + currentValue)
    const reducedMiscellaneous = dataExpenses.miscellaneous
      .map((item) => item.amount)
      .reduce((previousValue, currentValue) => previousValue + currentValue)
    const reducedPersonalSpending = dataExpenses.personalSpending
      .map((item) => item.amount)
      .reduce((previousValue, currentValue) => previousValue + currentValue)
    const reducedTransportation = dataExpenses.transportation
      .map((item) => item.amount)
      .reduce((previousValue, currentValue) => previousValue + currentValue)
    const reducedUtilities = dataExpenses.utilities
      .map((item) => item.amount)
      .reduce((previousValue, currentValue) => previousValue + currentValue)

    expensesChart[i + 1].push(
      reducedChildare,
      reducedDebtPayment,
      reducedEntertainment,
      reducedGroceries,
      reducedHousing,
      reducedMedical,
      reducedMiscellaneous,
      reducedPersonalSpending,
      reducedTransportation,
      reducedUtilities,
    )
  }

  // eslint-disable-next-line no-unused-vars
  const newExpensesChart = expensesChart.map((entry) => {
    for (let i = 0; i < entry.length; i++) {
      if (entry[i] === 0) {
        entry[i] = null
      }
    }
    return entry
  })

  let axisTitle = ''
  if (radioBtn.value === 'income') {
    axisTitle = `Income (${currencySymbol}/year)`
  } else if (radioBtn.value === 'expenses') {
    axisTitle = `Expenses (${currencySymbol}/year)`
  } else if (radioBtn.value === 'networth') {
    axisTitle = `Net worth (${currencySymbol})`
  } else return 'hola'

  // chart options
  const detailedOptionsNetworth = {
    // isStacked: 'true',
    legend: { position: 'bottom' },
    pointSize: 3,
    chartArea: {
      left: 100,
      right: 70,
      top: 15,
    },
    vAxis: {
      title: axisTitle,
    },
    height: 300,
  }

  const detailedOptionsIncomeExpenses = {
    isStacked: 'absolute',
    legend: { position: 'bottom' },
    pointSize: 3,
    chartArea: {
      left: 100,
      right: 70,
      top: 15,
    },
    vAxis: {
      title: axisTitle,
    },
    height: 300,
  }

  // chart data selection
  if (radioBtn.value === 'income') {
    return [incomeChart, detailedOptionsIncomeExpenses]
  } else if (radioBtn.value === 'expenses') {
    return [expensesChart, detailedOptionsIncomeExpenses]
  } else if (radioBtn.value === 'networth') {
    return [networthChart, detailedOptionsNetworth]
  } else return 'no chart available'
})
</script>

<!------------------------------------------------------------------------------------------------------->
<!-------------------------------------------- STYLE ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<style scoped></style>
