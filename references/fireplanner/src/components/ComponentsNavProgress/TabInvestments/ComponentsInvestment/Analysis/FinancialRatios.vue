<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------ TEMPLATE --------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<template>
  <div style="max-width: 1000px">
    <div v-if="$q.screen.width > 400">
      <div class="q-mt-md text-subtitle2 text-center">{{ props.symbol }} financial ratios</div>

      <q-list bordered class="rounded-borders">
        <!-------------------------------- Financial performance ratios ------------------------------->
        <q-expansion-item
          expand-separator
          icon="show_chart"
          label="Profitability ratios & Financial performance"
          caption="Gross margin, net margin, ROE, ROA, ROCE"
        >
          <q-table :rows="rowsFinancialPerformance" :columns="columns" row-key="name" flat bordered>
            <template v-slot:body-cell-info="props">
              <q-td :props="props">
                <q-btn dense round flat color="orange" icon="info" @click="openModal = true" />
              </q-td>
            </template>
          </q-table>
        </q-expansion-item>

        <!-------------------------------- Debt & liquidity ratios ------------------------------->
        <q-expansion-item
          expand-separator
          icon="credit_card"
          label="Debt & liquidity ratios"
          caption="Current ratio, quick ratio, debt to ebitda, etc."
        >
          <q-table :rows="rowsRatiosDebt" :columns="columns" row-key="name" flat bordered>
            <template v-slot:body-cell-info="props">
              <q-td :props="props">
                <q-btn dense round flat color="orange" icon="info" @click="openModal = true" />
              </q-td>
            </template>
          </q-table>
        </q-expansion-item>

        <!-------------------------------- Dividend ratios ------------------------------->
        <q-expansion-item
          expand-separator
          icon="paid"
          label="Dividend ratios"
          caption="Payout ratio, FCF ratio, etc."
        >
          <q-table :rows="rowsDividendRatios" :columns="columns" row-key="name" flat bordered>
            <template v-slot:body-cell-info="props">
              <q-td :props="props">
                <q-btn dense round flat color="orange" icon="info" @click="openModal = true" />
              </q-td>
            </template>
          </q-table>
        </q-expansion-item>
      </q-list>
      <q-separator></q-separator>
    </div>

    <div v-else class="text-body2 text-center">Flip the device to horizontal position</div>

    <!----------------------------- dialogs ---------------------------------------------------------->
    <q-dialog v-model="openModal">
      <q-card>
        <q-card-section>
          <div class="text-h6">Alert</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Rerum repellendus sit voluptate
          voluptas eveniet porro. Rerum blanditiis perferendis totam, ea at omnis vel numquam
          exercitationem aut, natus minima, porro labore.
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="OK" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------- SCRIPT ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<script setup>
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { currencyStringToSymbol, numberToPercentage } from 'src/js/helperFunctions'
import { useQuasar } from 'quasar'

import {
  currentRatioFunction,
  quickRatioFunction,
  totalDebtToEquityFunction,
  debtToEbitdaFunction,
  netDebtToEbitdaFunction,
  payoutRatioFunction,
  freeCashflowPayoutRatioFunction,
  grossMarginFunction,
  netMarginFunction,
  returnOnEquityFunction,
  returnOnAssetsFunction,
  dividendsPerShareFunction,
} from 'src/js/financialRatios'

// import Quasar for q-screen
const $q = useQuasar()

// import stores
import { useStoreInvestments } from 'src/stores/storeInvestments'
const storeInvestments = useStoreInvestments()

// get reactive data from stores
const { getAnalysisFinancials } = storeToRefs(storeInvestments)

// get financial data
const props = defineProps({
  symbol: String,
})

// info modal
const openModal = ref(false)

// ------------------------------- get data ------------------------------
const financialData = computed(() => {
  const entries =
    getAnalysisFinancials.value.detailBrokerageAccount[props.symbol].analysisFinancialData
  const currency = getAnalysisFinancials.value.detailBrokerageAccount[props.symbol].currency
  const currencySymbol = currencyStringToSymbol(currency)

  const financialData = {
    entries,
    currency,
    currencySymbol,
  }

  return financialData
})

// ------------------------------ reusable functions --------------------------------
function removeNulls(data) {
  const cleanArray = []
  const newObj = {}
  data.forEach((entry) => {
    if (entry !== null) {
      const date = entry.asOfDate
      const entryValueRaw = entry.reportedValue.raw
      newObj[date] = entryValueRaw
    }
  })
  cleanArray.push(newObj)
  return cleanArray
}

function groupByYear(data) {
  const groupedData = {}

  // Iterate over each category
  Object.keys(data).forEach((category) => {
    // Get the data entries for the category
    const entries = data[category][0]

    // Iterate over each date in the entries
    Object.keys(entries).forEach((date) => {
      // Initialize the date entry if it doesn't exist
      if (!groupedData[date]) {
        groupedData[date] = {}
      }
      // Assign the value to the respective category
      groupedData[date][category] = entries[date]
    })
  })

  return groupedData
}

// ------------------------------- table structure -----------------------
const rowsFinancialPerformance = computed(() => {
  const rows = []

  const grossMarginResult = grossMarginRatio()
  const netMarginResult = netMarginRatio()
  const returnOnEquityResult = returnOnEquityRatio()
  const returnOnAssetsResult = returnOnAssetsRatio()
  rows.push(grossMarginResult)
  rows.push(netMarginResult)
  rows.push(returnOnEquityResult)
  rows.push(returnOnAssetsResult)

  return rows
})

const rowsRatiosDebt = computed(() => {
  const rows = []

  const currentRatioResult = currentRatio()
  const quickRatioResult = quickRatio()
  const totalDebtToEquityResult = totalDebtToEquity()
  const debtToEbitdaResult = debtToEbidta()
  const netDebtToEbitdaResult = netDebtToEbidta()
  rows.push(currentRatioResult)
  rows.push(quickRatioResult)
  rows.push(totalDebtToEquityResult)
  rows.push(debtToEbitdaResult)
  rows.push(netDebtToEbitdaResult)

  return rows
})

const rowsDividendRatios = computed(() => {
  const rows = []

  const payoutRatioResult = payoutRatio()
  const freecashflowPayoutRatioResult = cashFlowPayoutRatio()
  const dividendPerShareResult = dividendPerShare()
  const dividenGrowthRateResults = dividenGrowthRate()
  rows.push(payoutRatioResult)
  rows.push(freecashflowPayoutRatioResult)
  rows.push(dividendPerShareResult)
  rows.push(dividenGrowthRateResults)

  return rows
})

const columns = computed(() => {
  const columns = [
    {
      name: 'name',
      required: true,
      label: '',
      align: 'left',
      field: (row) => row.name,
      format: (val) => `${val}`,
      sortable: true,
    },
  ]

  // variable right columns, depending on the amount of data
  // loop all objects in the financialData.value[slide.value] to get the first objet that contains 'annual'
  // and is not empty, in that object, gets all !== null arrays and get the date which will be used as columns
  // and added to the const columns
  try {
    const financialDataKeys = Object.keys(financialData.value.entries)
      .filter((item) => item.includes('annual'))
      .sort()
    let index = 0
    let found = false

    while (index < financialDataKeys.length && !found) {
      const key = financialDataKeys[index]
      const dataArray = financialData.value.entries[key]

      if (dataArray.length === 0) {
        console.log('empty')
      } else {
        dataArray.forEach((entry) => {
          if (entry !== null) {
            const date = entry.asOfDate
            const newObj = {
              name: date,
              aling: 'center',
              label: date,
              field: date,
            }
            columns.push(newObj)
          }
        })
        found = true // Exit the loop since a non-empty array is found
      }
      index++
    }
  } catch (e) {
    console.log(e)
  }

  columns.push({
    name: 'info',
    align: 'center',
    label: 'Info',
    field: '',
  })

  return columns
})

// ------------------------------------- Financial performance ratios ----------------------------
function grossMarginRatio() {
  // populate rows
  const objectToRows = {}
  objectToRows.name = 'Gross margin'
  objectToRows.field = 'grossMargin'

  try {
    const totalRevenue = removeNulls(financialData.value.entries.annualTotalRevenue)
    const costOfRevenue = removeNulls(financialData.value.entries.annualCostOfRevenue)

    const initialData = {
      totalRevenue,
      costOfRevenue,
    }

    // transform data
    const data = groupByYear(initialData)

    const dates = Object.keys(data)
    dates.forEach((date) => {
      const grossMargin = grossMarginFunction(data[date])
      objectToRows[date] = grossMargin
    })
  } catch (e) {
    console.log(e)
  }

  return objectToRows
}

function netMarginRatio() {
  // populate rows
  const objectToRows = {}
  objectToRows.name = 'Net profit margin'
  objectToRows.field = 'netMargin'

  try {
    const totalRevenue = removeNulls(financialData.value.entries.annualTotalRevenue)
    const netIncome = removeNulls(financialData.value.entries.annualNetIncome)

    const initialData = {
      totalRevenue,
      netIncome,
    }

    // transform data
    const data = groupByYear(initialData)

    const dates = Object.keys(data)
    dates.forEach((date) => {
      const netMargin = netMarginFunction(data[date])
      objectToRows[date] = netMargin
    })
  } catch (e) {
    console.log(e)
  }

  return objectToRows
}

function returnOnEquityRatio() {
  // populate rows
  const objectToRows = {}
  objectToRows.name = 'Return on equity (ROE)'
  objectToRows.field = 'returnOnEquity'

  try {
    const netIncome = removeNulls(financialData.value.entries.annualNetIncome)
    const totalEquity = removeNulls(financialData.value.entries.annualStockholdersEquity)

    const initialData = {
      netIncome,
      totalEquity,
    }

    // transform data
    const data = groupByYear(initialData)

    const dates = Object.keys(data)
    dates.forEach((date) => {
      const roe = returnOnEquityFunction(data[date])
      objectToRows[date] = roe
    })
  } catch (e) {
    console.log(e)
  }

  return objectToRows
}

function returnOnAssetsRatio() {
  // populate rows
  const objectToRows = {}
  objectToRows.name = 'Return on assets (ROA)'
  objectToRows.field = 'returnOnAssets'

  try {
    const netIncome = removeNulls(financialData.value.entries.annualNetIncome)
    const totalAssets = removeNulls(financialData.value.entries.annualTotalAssets)

    const initialData = {
      netIncome,
      totalAssets,
    }

    // transform data
    const data = groupByYear(initialData)

    const dates = Object.keys(data)
    dates.forEach((date) => {
      const roa = returnOnAssetsFunction(data[date])
      objectToRows[date] = roa
    })
  } catch (e) {
    console.log(e)
  }

  return objectToRows
}

// ------------------------------------- Debt ratios -----------------------------------------
function currentRatio() {
  // populate rows
  const objectToRows = {}
  objectToRows.name = 'Current ratio'
  objectToRows.field = 'currentRatio'

  try {
    // get initial data from ddbb
    const currentAssets = removeNulls(financialData.value.entries.annualCurrentAssets)
    const currentLiabilities = removeNulls(financialData.value.entries.annualCurrentLiabilities)

    const initialData = {
      currentAssets,
      currentLiabilities,
    }

    // transform data
    const data = groupByYear(initialData)

    const dates = Object.keys(data)
    dates.forEach((date) => {
      const currentRatio = currentRatioFunction(data[date]).toFixed(2) // to fixed rounds to 2 decimals
      objectToRows[date] = currentRatio
    })
  } catch (e) {
    console.log(e)
  }

  return objectToRows
}

function quickRatio() {
  // populate rows
  const objectToRows = {}
  objectToRows.name = 'Quick ratio'
  objectToRows.field = 'quickRatio'

  try {
    // get initial data from ddbb
    const cash = removeNulls(
      financialData.value.entries.annualCashCashEquivalentsAndShortTermInvestments,
    )
    const accountsReceivable = removeNulls(financialData.value.entries.annualAccountsReceivable)
    const currentLiabilities = removeNulls(financialData.value.entries.annualCurrentLiabilities)

    const initialData = {
      cash,
      accountsReceivable,
      currentLiabilities,
    }

    // transform data
    const data = groupByYear(initialData)

    const dates = Object.keys(data)
    dates.forEach((date) => {
      const quickRatio = quickRatioFunction(data[date]).toFixed(2) // to fixed rounds to 2 decimals
      objectToRows[date] = quickRatio
    })
  } catch (e) {
    console.log(e)
  }

  return objectToRows
}

function totalDebtToEquity() {
  // populate rows
  const objectToRows = {}
  objectToRows.name = 'Debt to stockholders equity'
  objectToRows.field = 'totalDebtToEquity'

  try {
    // get initial data from ddbb
    const totalLiabilities = removeNulls(
      financialData.value.entries.annualTotalLiabilitiesNetMinorityInterest,
    )
    const equity = removeNulls(financialData.value.entries.annualStockholdersEquity)

    const initialData = {
      totalLiabilities,
      equity,
    }

    // transform data
    const data = groupByYear(initialData)

    const dates = Object.keys(data)
    dates.forEach((date) => {
      const debtToEquity = totalDebtToEquityFunction(data[date])
      objectToRows[date] = debtToEquity
    })
  } catch (e) {
    console.log(e)
  }

  return objectToRows
}

function debtToEbidta() {
  // populate rows
  const objectToRows = {}
  objectToRows.name = 'Debt to EBITDA'
  objectToRows.field = 'debtToEbitda'

  try {
    const shortTermDebt = removeNulls(financialData.value.entries.annualCurrentDebt)
    const longTermDebt = removeNulls(financialData.value.entries.annualLongTermDebt)
    const netIncome = removeNulls(financialData.value.entries.annualNetIncome)
    const interestExpense = removeNulls(financialData.value.entries.annualInterestExpense)
    const taxProvision = removeNulls(financialData.value.entries.annualTaxProvision)
    const depreciationAmortization = removeNulls(
      financialData.value.entries.annualDepreciationAndAmortization,
    )

    const initialData = {
      shortTermDebt,
      longTermDebt,
      netIncome,
      interestExpense,
      taxProvision,
      depreciationAmortization,
    }

    // transform data
    const data = groupByYear(initialData)

    const dates = Object.keys(data)
    dates.forEach((date) => {
      const debtToEbitda = debtToEbitdaFunction(data[date]).toFixed(2) // to fixed rounds to 2 decimals
      objectToRows[date] = debtToEbitda
    })
  } catch (e) {
    console.log(e)
  }

  return objectToRows
}

function netDebtToEbidta() {
  // populate rows
  const objectToRows = {}
  objectToRows.name = 'Net debt to EBITDA'
  objectToRows.field = 'netDebtToEbitda'

  try {
    const shortTermDebt = removeNulls(financialData.value.entries.annualCurrentDebt)
    const longTermDebt = removeNulls(financialData.value.entries.annualLongTermDebt)
    const cash = removeNulls(financialData.value.entries.annualCashAndCashEquivalents)
    const netIncome = removeNulls(financialData.value.entries.annualNetIncome)
    const interestExpense = removeNulls(financialData.value.entries.annualInterestExpense)
    const taxProvision = removeNulls(financialData.value.entries.annualTaxProvision)
    const depreciationAmortization = removeNulls(
      financialData.value.entries.annualDepreciationAndAmortization,
    )

    const initialData = {
      shortTermDebt,
      longTermDebt,
      cash,
      netIncome,
      interestExpense,
      taxProvision,
      depreciationAmortization,
    }

    // transform data
    const data = groupByYear(initialData)

    const dates = Object.keys(data)
    dates.forEach((date) => {
      const debtToEbitda = netDebtToEbitdaFunction(data[date]).toFixed(2) // to fixed rounds to 2 decimals
      objectToRows[date] = debtToEbitda
    })
  } catch (e) {
    console.log(e)
  }

  return objectToRows
}

// ------------------------------------- Dividend ratios -----------------------------------------
function payoutRatio() {
  // populate rows
  const objectToRows = {}
  objectToRows.name = 'Net income payout ratio'
  objectToRows.field = 'payoutRatio'

  try {
    const netIncome = removeNulls(financialData.value.entries.annualNetIncome)
    const dividendsPaid = removeNulls(financialData.value.entries.annualCashDividendsPaid)

    const initialData = {
      netIncome,
      dividendsPaid,
    }

    // transform data
    const data = groupByYear(initialData)

    const dates = Object.keys(data)
    dates.forEach((date) => {
      const payout = payoutRatioFunction(data[date])
      objectToRows[date] = payout
    })
  } catch (e) {
    console.log(e)
  }

  return objectToRows
}

function cashFlowPayoutRatio() {
  // populate rows
  const objectToRows = {}
  objectToRows.name = 'Free cashflow payout ratio'
  objectToRows.field = 'cashflowPayoutRatio'

  try {
    const freeCashflow = removeNulls(financialData.value.entries.annualFreeCashFlow)
    const dividendsPaid = removeNulls(financialData.value.entries.annualCashDividendsPaid)

    const initialData = {
      freeCashflow,
      dividendsPaid,
    }

    // transform data
    const data = groupByYear(initialData)

    const dates = Object.keys(data)
    dates.forEach((date) => {
      const payout = freeCashflowPayoutRatioFunction(data[date])
      objectToRows[date] = payout
    })
  } catch (e) {
    console.log(e)
  }

  return objectToRows
}

function dividendPerShare() {
  // populate rows
  const objectToRows = {}
  objectToRows.name = 'Dividend per share'
  objectToRows.field = 'dividendPerShare'

  try {
    const totalShares = removeNulls(financialData.value.entries.annualBasicAverageShares)
    const dividendsPaid = removeNulls(financialData.value.entries.annualCashDividendsPaid)

    const initialData = {
      totalShares,
      dividendsPaid,
    }

    // transform data
    const data = groupByYear(initialData)

    const dates = Object.keys(data)
    dates.forEach((date) => {
      const dps = dividendsPerShareFunction(data[date]).toFixed(2)
      objectToRows[date] = dps
    })
  } catch (e) {
    console.log(e)
  }

  return objectToRows
}

function dividenGrowthRate() {
  // populate rows
  const objectToRows = {}
  objectToRows.name = 'Dividend per share'
  objectToRows.field = 'dividendPerShare'

  try {
    const totalShares = removeNulls(financialData.value.entries.annualBasicAverageShares)
    const dividendsPaid = removeNulls(financialData.value.entries.annualCashDividendsPaid)

    const initialData = {
      totalShares,
      dividendsPaid,
    }

    // transform data
    const data = groupByYear(initialData)

    const dates = Object.keys(data)
    const dividendArray = []
    dates.forEach((date) => {
      const dps = dividendsPerShareFunction(data[date])
      dividendArray.push(dps)
    })

    for (let i = 0; i < dates.length; i++) {
      let dividendGrowth = 'n.a'
      if (i !== 0) {
        const dividendGrowthCalc = (dividendArray[i] - dividendArray[i - 1]) / dividendArray[i - 1]
        dividendGrowth = numberToPercentage(dividendGrowthCalc, 2)
        objectToRows[dates[i]] = dividendGrowth
      } else {
        objectToRows[dates[i]] = dividendGrowth
      }
    }
  } catch (e) {
    console.log(e)
  }

  return objectToRows
}
</script>

<!------------------------------------------------------------------------------------------------------->
<!-------------------------------------------- STYLE ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<style scoped></style>
