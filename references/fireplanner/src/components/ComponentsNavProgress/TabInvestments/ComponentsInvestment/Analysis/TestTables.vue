<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------ TEMPLATE --------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<template>
  <div style="max-width: 1000px">
    <div>Tables v2</div>
    <q-carousel
      v-model="slide"
      transition-prev="scale"
      transition-next="scale"
      swipeable
      control-color="orange"
      prev-icon="arrow_left"
      next-icon="arrow_right"
      navigation
      padding
      arrows
      height="500px"
      class="rounded-borders"
    >
      <q-carousel-slide v-for="(slideItem, index) in slides" :key="index" :name="slideItem.name">
        <div class="q-pa-md">
          <div>hola que ase</div>
          <q-table
            flat
            bordered
            :title="`${props.symbol} ${slideItem.label} (in M${financialData.currencySymbol})`"
            :rows="rowsFinancialTables.mainRows"
            :columns="columnsFinancialTables"
            row-key="name"
          >
            <template v-slot:header="props">
              <q-tr :props="props">
                <q-th auto-width />
                <q-th v-for="col in props.cols" :key="col.name" :props="props">
                  {{ col.label }}
                </q-th>
              </q-tr>
            </template>

            <template v-slot:body="props">
              <q-tr :props="props">
                <q-td auto-width>
                  <q-btn
                    v-if="props.row.expansion === true"
                    size="sm"
                    color="orange"
                    round
                    dense
                    @click="props.expand = !props.expand"
                    :icon="props.expand ? 'remove' : 'add'"
                  />
                </q-td>
                <q-td v-for="col in props.cols" :key="col.name" :props="props">
                  {{ col.value }}
                </q-td>
              </q-tr>
              <q-tr v-show="props.expand" :props="props">
                <q-td colspan="100%">
                  <q-table
                    flat
                    dense
                    hide-bottom
                    title=""
                    :rows="rowsFinancialTables.subRows[props.row.field]"
                    :columns="columnsFinancialTables"
                    row-key="name"
                    :pagination="pagination"
                    :rows-per-page-options="[0]"
                  />
                </q-td>
              </q-tr>
            </template>
          </q-table>
        </div>
      </q-carousel-slide>
    </q-carousel>

    {{ financialData.cashflowStatement }}
  </div>
</template>

<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------- SCRIPT ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<script setup>
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { numberToCurrency, currencyStringToSymbol } from 'src/js/helperFunctions'

// import stores
import { useStoreInvestments } from 'src/stores/storeInvestments'
const storeInvestments = useStoreInvestments()

// get reactive data from stores
const { getAnalysisFinancials } = storeToRefs(storeInvestments)

const pagination = ref({ rowsPerPage: 0 })

const props = defineProps({
  symbol: String,
})

const slides = [
  { name: 'income', label: 'income statement' },
  { name: 'balance', label: 'balance sheet' },
  { name: 'cashflow', label: 'cashflow statement' },
]

const slide = ref('income')

// -------------------------- Financial tables -------------------------------------------------
const columnsFinancialTables = computed(() => {
  const columns = [
    {
      name: 'name',
      required: true,
      label: '',
      align: 'left',
      field: (row) => row.name,
      format: (val) => `${val}`,
    },
  ]

  let columnsArray = null
  try {
    switch (slide.value) {
      case 'income':
        columnsArray = financialData.value.incomeStatement.annualTotalRevenue
        break
      case 'balance':
        columnsArray = financialData.value.balanceSheet.annualTotalAssets
        break
      case 'cashflow':
        columnsArray = financialData.value.cashflowStatement.annualOperatingCashFlow
        break
      default:
        console.log('select a tab')
    }

    columnsArray.forEach((entry) => {
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
  } catch (e) {
    console.log(e)
  }

  return columns
})

const rowsStructure = ref({
  rows: {},
  mainRows: [],
})

const financialData = ref({
  balanceSheet: null,
  incomeStatement: null,
  cashflowStatement: null,
  currency: null,
  currencySymbol: null,
})

const updateFinancialData = () => {
  const data =
    getAnalysisFinancials.value.detailBrokerageAccount[props.symbol].analysisFinancialData
  financialData.value = {
    balanceSheet: data.balanceSheet,
    incomeStatement: data.incomeStatement,
    cashflowStatement: data.cashflow,
    currency: data.currency,
    currencySymbol: currencyStringToSymbol(data.currency),
  }

  // Update rowsStructure
  switch (slide.value) {
    case 'income':
      rowsStructure.value = {
        rows: {
          mainRows: [],
          subRows: {
            annualTotalRevenue: [],
          },
        },
        mainRows: [
          {
            name: 'Total revenue',
            field: 'annualTotalRevenue',
            expansion: true,
            subRows: [],
          },
        ],
      }
      break
    case 'balance':
      rowsStructure.value = {
        rows: {
          mainRows: [],
          subRows: {
            annualCurrentAssets: [],
            annualCurrentLiabilities: [],
            annualTotalAssets: [],
            annualTotalLiabilitiesNetMinorityInterest: [],
          },
        },
        mainRows: [
          {
            name: 'Current assets',
            field: 'annualCurrentAssets',
            expansion: true,
            subRows: [
              {
                name: 'Cash & equivalents',
                field: 'annualCashCashEquivalentsAndShortTermInvestments',
              },
              {
                name: 'Inventory',
                field: 'annualInventory',
              },
              {
                name: 'Receivables',
                field: 'annualAccountsReceivable',
              },
              {
                name: 'Other current assets',
                field: 'annualOtherCurrentAssets',
              },
            ],
          },
          {
            name: 'current liabilities',
            field: 'annualCurrentLiabilities',
            expansion: true,
            subRows: [
              {
                name: 'Accounts payable',
                field: 'annualAccountsPayable',
              },
              {
                name: 'Accrued expenses',
                field: 'annualCurrentAccruedExpenses',
              },
              {
                name: 'Income tax',
                field: 'annualIncomeTaxPayable',
              },
              {
                name: 'Short term debt',
                field: 'annualCurrentDebt',
              },
            ],
          },
          {
            name: 'Total assets',
            field: 'annualTotalAssets',
            expansion: true,
            subRows: [
              {
                name: 'Current assets',
                field: 'annualCurrentAssets',
              },
              {
                name: 'Net PPE',
                field: 'annualNetPPE',
              },
              {
                name: 'Goodwill',
                field: 'annualGoodwill',
              },
              {
                name: 'Investments and advances',
                field: 'annualInvestmentsAndAdvances',
              },
              {
                name: 'Intangible assets',
                field: 'annualOtherIntangibleAssets',
              },
              {
                name: 'Other non current assets',
                field: 'annualOtherNonCurrentAssets',
              },
            ],
          },
          {
            name: 'Total liabilities',
            field: 'annualTotalLiabilitiesNetMinorityInterest',
            expansion: true,
            subRows: [
              {
                name: 'Current liabilities',
                field: 'annualCurrentLiabilities',
              },
              {
                name: 'Long term debt',
                field: 'annualLongTermDebt',
              },
              {
                name: 'Non current deferred liabilities',
                field: 'annualNonCurrentDeferredTaxesLiabilities',
              },
              {
                name: 'Other liabilities, total',
                field: 'annualOtherNonCurrentLiabilities',
              },
            ],
          },
          {
            name: 'Total equity',
            field: 'annualStockholdersEquity',
            expansion: false,
            subRows: [],
          },
        ],
      }
      break
    case 'cashflow':
      rowsStructure.value = {
        rows: {
          mainRows: [],
          subRows: {
            annualOperatingCashFlow: [],
          },
        },
        mainRows: [
          {
            name: 'Cash from operating activities',
            field: 'annualOperatingCashFlow',
            expansion: true,
            subRows: [],
          },
        ],
      }
      break
    default:
      console.log('select a tab')
  }
}

watch(() => props.symbol, updateFinancialData, { immediate: true })

const rowsFinancialTables = computed(() => {
  const currency = financialData.value.currency
  let apiData = null
  switch (slide.value) {
    case 'income':
      apiData = financialData.value.incomeStatement
      break
    case 'balance':
      apiData = financialData.value.balanceSheet
      break
    case 'cashflow':
      apiData = financialData.value.cashflowStatement
      break
  }

  const rows = rowsStructure.value.rows
  const mainRows = rowsStructure.value.mainRows

  mainRows.forEach((row) => {
    try {
      // main rows
      const data = apiData[row.field]
      const objectToRows = {}
      objectToRows.name = row.name
      objectToRows.field = row.field
      objectToRows.expansion = row.expansion
      data.forEach((entry) => {
        if (entry !== null) {
          const date = entry.asOfDate
          const entryValue = entry.reportedValue.raw / 1000000
          objectToRows[date] = numberToCurrency(entryValue, currency, 0)
        }
      })
      rows.mainRows.push(objectToRows)

      // subrows
      if (row.subRows.length > 0) {
        row.subRows.forEach((subRow) => {
          const data = apiData[subRow.field]
          const objectToSubRows = {}
          objectToSubRows.name = subRow.name
          data.forEach((entry) => {
            try {
              if (entry !== null) {
                const date = entry.asOfDate
                const entryValue = entry.reportedValue.raw / 1000000
                objectToSubRows[date] = numberToCurrency(entryValue, currency, 0)
              }
            } catch (e) {
              console.log(e)
            }
          })
          rows.subRows[row.field].push(objectToSubRows)
        })
      }
    } catch (e) {
      console.log(e)
    }
  })

  return rows
})
</script>

<!------------------------------------------------------------------------------------------------------->
<!-------------------------------------------- STYLE ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<style scoped></style>
