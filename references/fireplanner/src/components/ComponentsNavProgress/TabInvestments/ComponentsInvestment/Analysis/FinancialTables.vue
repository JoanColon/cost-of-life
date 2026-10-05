<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------ TEMPLATE --------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<template>
  <div style="max-width: 1000px">
    <div v-if="$q.screen.width > 400">
      <div style="display: flex; justify-content: center; width: 100%">
        <q-radio v-model="radioSelection" val="annual" label="Annual" color="orange" />
        <q-radio
          v-model="radioSelection"
          val="trailing"
          label="Trailing 12 months"
          color="orange"
        />
      </div>

      <q-carousel
        v-model="slide"
        transition-prev="scale"
        transition-next="scale"
        control-color="orange"
        prev-icon="arrow_left"
        next-icon="arrow_right"
        navigation
        padding
        arrows
        class="rounded-borders q-mt-none"
        :style="{ height: carouselHeight }"
      >
        <q-carousel-slide v-for="(slideItem, index) in slides" :key="index" :name="slideItem.name">
          <div class="q-pa-md">
            <q-table
              flat
              bordered
              :title="`${props.symbol} ${slideItem.label} (in M${financialData.currencySymbol})`"
              :rows="rowsFinancialTables.mainRows"
              :columns="columnsFinancialTables"
              row-key="name"
              hide-bottom
              :pagination="pagination"
              :rows-per-page-options="[0]"
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
                <q-tr v-show="props.expand" :props="props" style="background-color: #f4f3ee">
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
    </div>

    <div v-else class="text-body2 text-center">Flip the device to horizontal position</div>
  </div>
</template>

<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------- SCRIPT ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<script setup>
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { numberToCurrency, currencyStringToSymbol } from 'src/js/helperFunctions'
import { useQuasar } from 'quasar'

// import stores
import { useStoreInvestments } from 'src/stores/storeInvestments'
const storeInvestments = useStoreInvestments()

// get reactive data from stores
const { getAnalysisFinancials } = storeToRefs(storeInvestments)

// get financial data
const props = defineProps({
  symbol: String,
})

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

// set up other parameters
const pagination = ref({ rowsPerPage: 0 })

const slides = [
  { name: 'incomeStatement', label: 'income statement' },
  { name: 'balanceSheet', label: 'balance sheet' },
  { name: 'cashflowStatement', label: 'cashflow statement' },
]

const slide = ref('incomeStatement')

const carouselHeight = computed(() => {
  if (slide.value === 'incomeStatement') {
    return '650px'
  } else {
    return '500px'
  }
})

const radioSelection = ref('annual')

// import Quasar for q-screen
const $q = useQuasar()

// -------------------------- Financial tables -------------------------------------------------
// function
function rowsStructureFunction(data) {
  const slide = data
  let rows = {}
  let mainRows = []

  switch (slide) {
    case 'incomeStatement':
      rows = {
        mainRows: [],
        subRows: {
          annualOperatingExpense: [],
          annualNetIncomeCommonStockholders: [],
        },
      }

      mainRows = [
        // Total revenue
        {
          name: 'Total revenue',
          field: 'annualTotalRevenue',
          fieldTrailing: 'trailingTotalRevenue',
          expansion: false,
          calc: false,
          subRows: [],
        },
        {
          name: 'Cost of revenue',
          field: 'annualCostOfRevenue',
          fieldTrailing: 'trailingCostOfRevenue',
          expansion: false,
          calc: false,
          subRows: [],
        },
        {
          name: 'Gross profit',
          field: 'annualGrossProfit',
          fieldTrailing: 'trailingGrossProfit',
          expansion: false,
          calc: false,
          subRows: [],
        },
        {
          name: 'Operating expenses',
          field: 'annualOperatingExpense',
          fieldTrailing: 'trailingOperatingExpense',
          expansion: true,
          calc: false,
          subRows: [
            {
              name: 'Selling/general/admin exp.',
              field: 'annualSellingGeneralAndAdministration',
              fieldTrailing: 'trailingSellingGeneralAndAdministration',
              calc: false,
            },
            {
              name: 'Research & develop',
              field: 'annualResearchAndDevelopment',
              fieldTrailing: 'trailingResearchAndDevelopment',
              calc: false,
            },
            {
              name: 'Depreciation/amortization',
              field: 'annualDepreciationAndAmortization',
              fieldTrailing: 'trailingDepreciationAndAmortization',
              calc: false,
            },
            {
              name: 'Interest expense',
              field: 'annualInterestExpense',
              fieldTrailing: 'trailingInterestExpense',
              calc: false,
            },
          ],
        },
        {
          name: 'Operating income',
          field: 'annualOperatingIncome',
          fieldTrailing: 'trailingOperatingIncome',
          expansion: false,
          calc: false,
          subRows: [],
        },
        {
          name: 'Other income expense',
          field: 'annualOtherIncomeExpense',
          fieldTrailing: 'trailingOtherIncomeExpense',
          expansion: false,
          calc: false,
          subRows: [],
        },
        {
          name: 'Net income before taxes',
          field: 'annualPretaxIncome',
          fieldTrailing: 'trailingPretaxIncome',
          expansion: false,
          calc: false,
          subRows: [],
        },
        {
          name: 'Tax provision',
          field: 'annualTaxProvision',
          fieldTrailing: 'trailingTaxProvision',
          expansion: false,
          calc: false,
          subRows: [],
        },
        {
          name: 'Net income',
          field: 'annualNetIncomeCommonStockholders',
          fieldTrailing: 'trailingNetIncomeCommonStockholders',
          expansion: true,
          calc: false,
          subRows: [
            {
              name: 'Net income after taxes',
              field: 'annualNetIncomeContinuousOperations',
              fieldTrailing: 'trailingNetIncomeContinuousOperations',
              calc: false,
            },
          ],
        },
      ]
      break
    case 'balanceSheet':
      rows = {
        mainRows: [],
        subRows: {
          annualCurrentAssets: [],
          annualCurrentLiabilities: [],
          annualTotalAssets: [],
          annualTotalLiabilitiesNetMinorityInterest: [],
        },
      }

      mainRows = [
        // current assets
        {
          name: 'Current assets',
          field: 'annualCurrentAssets',
          fieldTrailing: 'trailingCurrentAssets',
          expansion: true,
          calc: false,
          subRows: [
            {
              name: 'Cash & equivalents',
              field: 'annualCashCashEquivalentsAndShortTermInvestments',
              fieldTrailing: 'trailingCashCashEquivalentsAndShortTermInvestments',
              calc: false,
            },
            {
              name: 'Inventory',
              field: 'annualInventory',
              fieldTrailing: 'trailingInventory',
              calc: false,
            },
            {
              name: 'Receivables',
              field: 'annualAccountsReceivable',
              fieldTrailing: 'trailingAccountsReceivable',
              calc: false,
            },
            {
              name: 'Other current assets',
              field: 'annualOtherCurrentAssets',
              fieldTrailing: 'trailingOtherCurrentAssets',
              calc: false,
            },
          ],
        },
        // current liabilities
        {
          name: 'current liabilities',
          field: 'annualCurrentLiabilities',
          fieldTrailing: 'trailingCurrentLiabilities',
          expansion: true,
          calc: false,
          subRows: [
            {
              name: 'Accounts payable',
              field: 'annualAccountsPayable',
              fieldTrailing: 'trailingAccountsPayable',
              calc: false,
            },
            {
              name: 'Accrued expenses',
              field: 'annualCurrentAccruedExpenses',
              fieldTrailing: 'trailingCurrentAccruedExpenses',
              calc: false,
            },
            {
              name: 'Income tax',
              field: 'annualIncomeTaxPayable',
              fieldTrailing: 'trailingIncomeTaxPayable',
              calc: false,
            },
            {
              name: 'Short term debt',
              field: 'annualCurrentDebt',
              fieldTrailing: 'trailingCurrentDebt',
              calc: false,
            },
          ],
        },
        // total assets
        {
          name: 'Total assets',
          field: 'annualTotalAssets',
          fieldTrailing: 'trailingTotalAssets',
          expansion: true,
          calc: false,
          subRows: [
            {
              name: 'Current assets',
              field: 'annualCurrentAssets',
              fieldTrailing: 'trailingCurrentAssets',
              calc: false,
            },
            {
              name: 'Net PPE',
              field: 'annualNetPPE',
              fieldTrailing: 'trailingNetPPE',
              calc: false,
            },
            {
              name: 'Goodwill',
              field: 'annualGoodwill',
              fieldTrailing: 'trailingGoodwill',
              calc: false,
            },
            {
              name: 'Investments and advances',
              field: 'annualInvestmentsAndAdvances',
              fieldTrailing: 'trailingInvestmentsAndAdvances',
              calc: false,
            },
            {
              name: 'Intangible assets',
              field: 'annualOtherIntangibleAssets',
              fieldTrailing: 'trailingOtherIntangibleAssets',
              calc: false,
            },
            {
              name: 'Other non current assets',
              field: 'annualOtherNonCurrentAssets',
              fieldTrailing: 'trailingOtherNonCurrentAssets',
              calc: false,
            },
          ],
        },
        // total liabilities
        {
          name: 'Total liabilities',
          field: 'annualTotalLiabilitiesNetMinorityInterest',
          fieldTrailing: 'trailingTotalLiabilitiesNetMinorityInterest',
          expansion: true,
          calc: false,
          subRows: [
            {
              name: 'Current liabilities',
              field: 'annualCurrentLiabilities',
              fieldTrailing: 'trailingCurrentLiabilities',
              calc: false,
            },
            {
              name: 'Long term debt',
              field: 'annualLongTermDebt',
              fieldTrailing: 'trailingLongTermDebt',
              calc: false,
            },
            {
              name: 'Non current deferred liabilities',
              field: 'annualNonCurrentDeferredTaxesLiabilities',
              fieldTrailing: 'trailingNonCurrentDeferredTaxesLiabilities',
              calc: false,
            },
            {
              name: 'Other liabilities, total',
              field: 'annualOtherNonCurrentLiabilities',
              fieldTrailing: 'trailingOtherNonCurrentLiabilities',
              calc: false,
            },
          ],
        },
        // Total equity
        {
          name: 'Total equity',
          field: '',
          fieldTrailing: '',
          expansion: false,
          calc: true,
          subRows: [],
        },
      ]
      break
    case 'cashflowStatement':
      rows = {
        mainRows: [],
        subRows: {
          annualOperatingCashFlow: [],
          annualInvestingCashFlow: [],
          annualCashFlowFromContinuingFinancingActivities: [],
          annualEndCashPosition: [],
        },
      }

      mainRows = [
        {
          name: 'Operating cashflow',
          field: 'annualOperatingCashFlow',
          fieldTrailing: 'trailingOperatingCashFlow',
          expansion: true,
          calc: false,
          subRows: [
            {
              name: 'Net income continuous operations',
              field: 'annualNetIncomeContinuousOperations',
              fieldTrailing: '',
              calc: false,
            },
            {
              name: 'Depreciation & amortization',
              field: 'annualDepreciationAndAmortization',
              fieldTrailing: 'trailingNetIncomeContinuousOperations',
              calc: false,
            },
            {
              name: 'Deferred Income tax',
              field: 'annualDeferredIncomeTax',
              fieldTrailing: 'trailingDeferredIncomeTax',
              calc: false,
            },
            {
              name: 'Other non-cash items',
              field: 'annualOtherNonCashItems',
              fieldTrailing: 'trailingOtherNonCashItems',
              calc: false,
            },
            {
              name: 'Changes working capital',
              field: 'annualChangeInWorkingCapital',
              fieldTrailing: 'trailingChangeInWorkingCapital',
              calc: false,
            },
          ],
        },
        {
          name: 'Investing cashflow',
          field: 'annualInvestingCashFlow',
          fieldTrailing: 'trailingInvestingCashFlow',
          expansion: true,
          calc: false,
          subRows: [
            {
              name: 'Capital expenditure',
              field: 'annualCapitalExpenditure',
              fieldTrailing: 'trailingCapitalExpenditure',
              calc: false,
            },
            {
              name: 'Purchase of business',
              field: 'annualPurchaseOfBusiness',
              fieldTrailing: 'trailingPurchaseOfBusiness',
              calc: false,
            },
            {
              name: 'Purchase of investment',
              field: 'annualPurchaseOfInvestment',
              fieldTrailing: 'trailingPurchaseOfInvestment',
              calc: false,
            },
            {
              name: 'Sale of investment',
              field: 'annualSaleOfInvestment',
              fieldTrailing: 'trailingSaleOfInvestment',
              calc: false,
            },
            {
              name: 'Net ohter investing changes',
              field: 'annualNetOtherInvestingChanges',
              fieldTrailing: 'trailingNetOtherInvestingChanges',
              calc: false,
            },
          ],
        },
        {
          name: 'Financing cashflow',
          field: 'annualCashFlowFromContinuingFinancingActivities',
          fieldTrailing: 'trailingCashFlowFromContinuingFinancingActivities',
          expansion: true,
          calc: false,
          subRows: [
            {
              name: 'Cash dividends paid',
              field: 'annualCashDividendsPaid',
              fieldTrailing: 'trailingCashDividendsPaid',
              calc: false,
            },
            {
              name: 'Repurchase of capital stock',
              field: 'annualRepurchaseOfCapitalStock',
              fieldTrailing: 'trailingRepurchaseOfCapitalStock',
              calc: false,
            },
            {
              name: 'Repayment of debt',
              field: 'annualRepaymentOfDebt',
              fieldTrailing: 'trailingRepaymentOfDebt',
              calc: false,
            },
          ],
        },
        {
          name: 'End cash position',
          field: 'annualEndCashPosition',
          fieldTrailing: 'trailingEndCashPosition',
          expansion: true,
          calc: false,
          subRows: [
            {
              name: 'Beginning cash position',
              field: 'annualBeginningCashPosition',
              fieldTrailing: 'trailingBeginningCashPosition',
              calc: false,
            },
          ],
        },
        {
          name: 'Free cashflow',
          field: 'annualFreeCashFlow',
          fieldTrailing: 'trailingFreeCashFlow',
          expansion: false,
          calc: false,
          subRows: [],
        },
      ]
      break
    default:
      console.log('select a tab')
  }

  const rowsStructrue = {
    rows,
    mainRows,
  }

  return rowsStructrue
}

// define row and subrow structe. All raws I want to display in the tables
const columnsFinancialTables = computed(() => {
  // main left folumn
  let columns = [
    {
      name: 'name',
      required: true,
      label: '',
      align: 'left',
      field: (row) => row.name,
      format: (val) => `${val}`,
    },
  ]

  // variable right columns, depending on the amount of data
  // loop all objects in the financialData.value[slide.value] to get the first objet that contains 'annual'
  // and is not empty, in that object, gets all !== null arrays and get the date which will be used as columns
  // and added to the const columns
  try {
    let financialDataKeys = []
    if (radioSelection.value === 'annual') {
      financialDataKeys = Object.keys(financialData.value.entries)
        .filter((item) => item.includes('annual'))
        .sort()
    } else {
      financialDataKeys = Object.keys(financialData.value.entries)
        .filter((item) => item.includes('trailing'))
        .sort()
    }

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

  if (radioSelection.value === 'trailing') {
    // Clone the array to avoid modifying the original
    const clonedColumns = [...columns]
    const firstElement = clonedColumns.shift()
    const lastElement = clonedColumns.pop()
    const resultArray = [firstElement, lastElement]
    columns = resultArray
  }

  return columns
})

const rowsFinancialTables = computed(() => {
  // get all data from which we will extract the row and subrow data
  const apiData = financialData.value
  const currency = financialData.value.currency

  // define the row and subrow structure
  const rowData = rowsStructureFunction(slide.value)
  const rows = rowData.rows
  const mainRows = rowData.mainRows

  // populate the rows and subrows
  mainRows.forEach((row) => {
    // main rows basic data
    const objectToRows = {}
    objectToRows.name = row.name
    objectToRows.expansion = row.expansion
    objectToRows.field = radioSelection.value === 'annual' ? row.field : row.fieldTrailing
    objectToRows.raw = {}

    if (row.calc === true) {
      // if to calculate fields that are not directly available in rapidApid
      switch (row.name) {
        case 'Total equity': {
          try {
            let totalAssets = []
            let totalLiabilities = []
            if (radioSelection.value === 'annual') {
              totalAssets = rows.mainRows.find((element) => element.field === 'annualTotalAssets')
              totalLiabilities = rows.mainRows.find(
                (element) => element.field === 'annualTotalLiabilitiesNetMinorityInterest',
              )
            } else {
              totalAssets = rows.mainRows.find(
                (element) => element.fieldTrailing === 'trailingTotalAssets',
              )
              totalLiabilities = rows.mainRows.find(
                (element) =>
                  element.fieldTrailing === 'trailingTotalLiabilitiesNetMinorityInterest',
              )
            }

            const dates = Object.keys(totalAssets.raw)
            dates.forEach((date) => {
              const totalEquity = totalAssets.raw[date] - totalLiabilities.raw[date]
              objectToRows[date] = numberToCurrency(totalEquity, currency, 0)
            })
            rows.mainRows.push(objectToRows)
          } catch (e) {
            console.log(e)
            objectToRows.field = 'n.a'
            objectToRows.name = 'data not available'
            objectToRows.expansion = false
            objectToRows.raw = {}
            rows.mainRows.push(objectToRows)
          }
          break
        }
      }
    } else {
      // data directly extracted from rapidApi
      try {
        const data =
          radioSelection.value === 'annual'
            ? apiData.entries[row.field]
            : apiData.entries[row.fieldTrailing]

        // main rows populate data
        data.forEach((entry) => {
          if (entry !== null) {
            const date = entry.asOfDate
            const entryValueRaw = entry.reportedValue.raw / 1000000
            const entryValue = numberToCurrency(entryValueRaw, currency, 0)
            objectToRows.raw[date] = entryValueRaw
            objectToRows[date] = entryValue
          }
        })
        rows.mainRows.push(objectToRows)

        // subrows populate data
        if (row.subRows !== []) {
          row.subRows.forEach((subRow) => {
            const data = apiData.entries[subRow.field]
            const objectToSubRows = {
              raw: {},
            }
            objectToSubRows.name = subRow.name
            data.forEach((entry) => {
              try {
                if (entry !== null) {
                  const date = entry.asOfDate
                  const entryValueRaw = entry.reportedValue.raw / 1000000
                  const entryValue = numberToCurrency(entryValueRaw, currency, 0)
                  objectToSubRows.raw[date] = entryValueRaw
                  objectToSubRows[date] = entryValue
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
    }
  })

  return rows
})

// Watch the `symbol` prop
// rowsFinancialTables was not being updated correctly, using this watcher everything works, it is a hack but it works.
watch(
  () => props.symbol,
  (newSymbol, oldSymbol) => {
    const oldSlideValue = slide.value
    slide.value = ''
    slide.value = oldSlideValue
  },
  { immediate: true },
)
</script>

<!------------------------------------------------------------------------------------------------------->
<!-------------------------------------------- STYLE ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<style scoped></style>
