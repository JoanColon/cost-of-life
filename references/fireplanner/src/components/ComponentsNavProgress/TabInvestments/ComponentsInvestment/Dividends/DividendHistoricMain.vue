<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------ TEMPLATE --------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<template>
  <div style="max-width: 1000px; margin: auto">
    <!------------------------------ CHARTS ------------------------------------>
    <DividendHistoricChart :investmentDetailName="investmentDetailName" />

    <!------------------------- ADD / DELETE BUTTONS --------------------------->
    <div style="display: flex; width: 100%; justify-content: space-around">
      <q-btn
        flat
        label="Upload dividends"
        no-caps
        style="color: orange"
        v-close-popup
        @click="openDividendDialog = true"
      />

      <q-btn
        flat
        label="Delete dividends"
        no-caps
        style="color: red"
        v-close-popup
        @click="openDeleteDividendDialog = true"
      />

      <!---------------------------- Upload dividend dialog ------------------------------------->
      <q-dialog v-model="openDividendDialog">
        <q-card style="width: 500px; max-width: 80vw; height: 100vh">
          <!-- title -->
          <q-card-section class="row items-center q-pb-none">
            <div class="text-h6">Add dividends</div>
            <q-space></q-space>
            <q-btn icon="close" flat round dense v-close-popup />
          </q-card-section>

          <!------------------------ add data from form -------------------------------------->
          <q-card-section>
            <div class="text-subtitle1 text-weight-medium text-center">Either add new entry:</div>
            <q-form
              class="q-pr-md"
              style="width: 100%; display: block"
              @submit.prevent="onSubmitDividend"
            >
              <!-- symbol -->
              <q-select
                v-model="symbolSelected"
                :options="symbolSelectOptions"
                label="Symbol"
                class="q-ml-md"
                use-input
                hide-selected
                fill-input
                input-debounce="0"
              />

              <!-- dividend amount -->
              <q-input
                class="q-ml-md"
                v-model.number="dividendAmount"
                type="number"
                label="Dividend amount"
              />

              <!-- date -->
              <q-input class="q-ml-md" v-model="date" type="date" label="date" />

              <div class="q-mt-md q-mb-sm q-mr-xs float-right">
                <q-btn
                  style="height: 75%"
                  label="Save"
                  type="submit"
                  rounded
                  color="orange"
                  no-caps
                />
              </div>
            </q-form>
          </q-card-section>

          <!------------------------ add data from excel -------------------------------------->
          <q-card-section class="q-mt-lg">
            <div class="text-subtitle1 text-center text-weight-medium">
              Or add in bulk form excel:
            </div>
          </q-card-section>

          <q-card-section>
            <q-list>
              <!-- export excel -->
              <q-item clickable v-ripple>
                <q-item-section avatar>
                  <q-icon color="black" name="looks_one" />
                </q-item-section>

                <q-item-section caption>
                  <q-item-label> Export exel</q-item-label>
                </q-item-section>

                <q-item-section side>
                  <q-btn
                    class="q-mt-sm q-mr-sm"
                    style="height: 75%"
                    label="Export"
                    rounded
                    color="orange"
                    no-caps
                    @click="exportToExcel"
                  />
                </q-item-section>
              </q-item>

              <!-- drag and drop excel -->
              <q-item>
                <q-item-section avatar>
                  <q-icon color="black" name="looks_two" />
                </q-item-section>

                <q-item-section>
                  <q-item-label>Once, the data is entered, upalod the file</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-file
                    borderless
                    v-model="file"
                    label="Upload"
                    accept=".xlsx"
                    style="width: 100px"
                    @update:model-value="fileAdded()"
                  >
                    <template v-slot:prepend>
                      <q-icon name="cloud_upload" />
                    </template>
                  </q-file>
                </q-item-section>
              </q-item>

              <!-- Save excel data -->
              <q-item>
                <q-item-section avatar>
                  <q-icon color="black" name="looks_3" />
                </q-item-section>

                <q-item-section style="width: 90%">
                  <q-item-label>Save data to database</q-item-label>
                </q-item-section>

                <q-item-section side>
                  <q-btn
                    class="q-mt-sm q-mr-sm"
                    style="height: 75%"
                    label="Save"
                    rounded
                    color="orange"
                    no-caps
                    @click="AddDividend()"
                  />
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>
      </q-dialog>

      <!---------------------------- Delete dividend dialog ------------------------------------->
      <q-dialog v-model="openDeleteDividendDialog">
        <q-card style="width: 100%">
          <!-- title -->
          <q-card-section class="row items-center q-pb-none">
            <div class="text-h6">Delete dividends</div>
            <q-space></q-space>
            <q-btn icon="close" flat round dense v-close-popup />
          </q-card-section>

          <q-card-section>
            <!-- symbol -->
            <q-select
              v-model="allSymbolSelected"
              :options="allSymbolSelectOptions"
              label="Symbol"
              class="q-ml-md"
              use-input
              hide-selected
              fill-input
              input-debounce="0"
            />
          </q-card-section>

          <q-card-section>
            <!-- q-table -->
            <q-table :rows="rowsDelete" :columns="columnsDelete" row-key="name" dense>
              <!-- slot for the delete button in the delete row -->
              <template v-slot:body-cell-delete="props">
                <q-td :propsDeleteId="props">
                  <q-btn
                    dense
                    round
                    flat
                    color="red"
                    @click="((propsDeleteId = props.row), deleteRow(propsDeleteId))"
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
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useQuasar } from 'quasar'
import { db } from 'src/js/firebase'
import { doc, setDoc, updateDoc, deleteField } from 'firebase/firestore'
import ExcelJS from 'exceljs'
import { v4 as uuidv4 } from 'uuid'

// import components
import DividendHistoricChart from 'src/components/ComponentsNavProgress/TabInvestments/ComponentsInvestment/Dividends/DividendsHistoricChart.vue'

// import helper functions
import { formatTimestampToDate } from 'src/js/helperFunctions.js'

// import and declare stores
import { useStoreAuth } from 'src/stores/storeAuth'
import { useStoreInvestments } from 'src/stores/storeInvestments'
import { useStoreInvestmentsGlobal } from 'src/stores/storeInvestmentsGlobal'
import { useStoreUserSettings } from 'src/stores/storeUserSettings'
const storeAuth = useStoreAuth()
const storeInvestments = useStoreInvestments()
const storeInvestmentsGlobal = useStoreInvestmentsGlobal()
const storeUserSettings = useStoreUserSettings()

// declare useQuasar (to use the "notify" plugin)
const $q = useQuasar()

// get props form InvestmentMainComponent
const props = defineProps(['investmentDetailName'])
const investmentDetailName = props.investmentDetailName

// get reactive data from stores
const { getRapidApiSymbols, getAllSymbols, getDailyData, getDividends } =
  storeToRefs(storeInvestments)
const symbols = getRapidApiSymbols.value.yahooFinanceSymbolsCategories[investmentDetailName]
const { currencyExchange } = storeToRefs(storeInvestmentsGlobal)
const { userSettings } = storeToRefs(storeUserSettings)

// open dividend dialgo
const openDividendDialog = ref(false)
const openDeleteDividendDialog = ref(false)

// ----------------------------------------------------------------------------------------
// ---------------------------------- Manual entry ----------------------------------------
// ----------------------------------------------------------------------------------------
const symbolSelectOptions =
  getRapidApiSymbols.value.yahooFinanceSymbolsCategories[investmentDetailName]
const symbolSelected = ref('')
const dividendAmount = ref(0)
const currentDate = new Date().toJSON().slice(0, 10)
const date = ref(currentDate)

async function onSubmitDividend() {
  // calculate dividend in base currency
  const symbolCurrency = symbolCurrencyArray.find((item) => item.symbol === symbolSelected.value)
  if (symbolCurrency.currency === 'GBp') {
    symbolCurrency.currency = 'GBP'
  }

  const currencyExchageRate = currencyExchange.value[symbolCurrency.currency]
  const userCurrency = userSettings.value.currency
  const userCurrencyExchangeRate = currencyExchange.value[userCurrency]
  const dividendBaseCurrency =
    (dividendAmount.value / currencyExchageRate) * userCurrencyExchangeRate

  // save to firestore database
  const uuid = uuidv4()

  const newDividend = {
    date: new Date(date.value).getTime(),
    dividend: dividendAmount.value,
    dividendBaseCurrency,
  }

  await updateDoc(doc(db, 'users', storeAuth.user.id, investmentDetailName, symbolSelected.value), {
    [`dividends.${uuid}`]: newDividend,
  })

  $q.notify({
    message: 'dividens saved to database',
    color: 'positive',
    icon: 'check_circle',
    timeout: 5000,
  })
}

// ----------------------------------------------------------------------------------------
// ---------------------------------- EXCEL EXPORT ----------------------------------------
// ----------------------------------------------------------------------------------------
const portofolioSymbols = computed(() => {
  const dataArray = []
  symbols.forEach((symbol) => {
    const obj = {}
    obj['YahooFinance symbol'] = symbol
    obj['Broker symbol'] = ''
    dataArray.push(obj)
  })
  return dataArray
})

const symbolCurrencyArray = getDailyData.value.dailyYahooFinanceData.map((obj) => {
  const symbol = Object.keys(obj)[0]
  const data = {
    symbol,
    currency: obj[symbol].currency,
  }
  return data
})

// ------------------------------ export excel -------------------------------
function exportToExcel() {
  const workbook = new ExcelJS.Workbook()
  const wsSymbols = workbook.addWorksheet('Symbols')
  const wsOtherSymbols = workbook.addWorksheet('OtherSymbols')
  const wsDividends = workbook.addWorksheet('Dividends')
  const wsCurrencyExchange = workbook.addWorksheet('CurrencyExchange')

  // --------------------- Worksheet symbols -----------------------------------
  // Add header rows
  const headersSymbols = Object.keys(portofolioSymbols.value[0])
  wsSymbols.addRow(headersSymbols)

  // Add data rows
  portofolioSymbols.value.forEach((row) => {
    const values = headersSymbols.map((header) => row[header])
    wsSymbols.addRow(values)
  })

  // --------------------- Worksheet dividends -----------------------------------
  const headerOtherSymbols = ['YahooFinance symbol', 'Broker symbol', 'Currency']
  wsOtherSymbols.addRow(headerOtherSymbols)

  // --------------------- Worksheet dividends -----------------------------------
  const headersDividends = ['Symbol', 'Date', 'Dividend']
  wsDividends.addRow(headersDividends)

  // --------------------- Worksheet currency exchange -----------------------------------
  const headersCurrency = ['Currency', 'Exchange rate']

  // This code uses the map function to extract the currency field from each object in the array and then uses the Set object to remove duplicates. Finally, the spread operator (...) is used to convert the set back into an array.
  const uniqueCurrencies = [...new Set(symbolCurrencyArray.map((item) => item.currency))]

  wsCurrencyExchange.addRow(headersCurrency)
  uniqueCurrencies.forEach((currency) => {
    const values = [currency, '']
    wsCurrencyExchange.addRow(values)
  })

  // Create a Blob from the workbook
  workbook.xlsx.writeBuffer().then((buffer) => {
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    // Create a download link and trigger the download
    const link = document.createElement('a')
    link.href = window.URL.createObjectURL(blob)
    link.download = 'exported_data.xlsx'
    link.click()
  })
}

// ----------------------------------------------------------------------------------------
// ---------------------------------- IMPORT EXPORT ---------------------------------------
// ----------------------------------------------------------------------------------------
const file = ref(null)
function fileAdded() {
  $q.notify({
    message: 'excel data uploaded on memory, click "Upload Excel" to save the data',
    color: 'positive',
    icon: 'check_circle',
    timeout: 5000,
  })
}

function readExcel() {
  if (file.value) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (event) => {
        const excelData = event.target.result
        const processedExcelData = processExcelData(excelData)
        resolve(processedExcelData)
      }

      reader.onerror = (event) => {
        console.error('Error reading the file:', event.target.error)
      }

      reader.readAsArrayBuffer(file.value)
    })
  }
}

async function processExcelData(excelData) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(excelData)

  // STEP 1. Read excel data from each worksheet
  const wsSymbols = workbook.worksheets[0]
  const wsOtherSymbols = workbook.worksheets[1]
  const wsDividends = workbook.worksheets[2]
  const wsCurrencyExchange = workbook.worksheets[3]

  // STEP 2. Create an Object (dividendObj) with all Symbols and the dividends per each symbol
  // first create an array of dividends from the wsDividends list
  const dividendArray = []
  wsDividends.eachRow((row, rowNumber) => {
    if (rowNumber !== 1) {
      const date = Date.parse(row.values[2])
      const obj = {
        brokerSymbol: row.values[1],
        date,
        dividend: row.values[3],
      }

      dividendArray.push(obj)
    }
  })

  // reduce the dividendArray to group each dividend in their respective symbol
  const dividendObj = dividendArray.reduce((acc, item) => {
    // object destructuring into two variables, one is the brokerSymbol and the other is the rest of the object
    const { brokerSymbol, date, dividend } = item

    if (!acc[brokerSymbol]) {
      acc[brokerSymbol] = {}
      acc[brokerSymbol].dividends = {}
    }

    const uuid = uuidv4()
    const newDividend = { date, dividend }
    acc[brokerSymbol].dividends[uuid] = newDividend

    return acc
  }, {})

  // STEP 3. Iterate through wsSymbols & wsOtherSymbols to add the YahooFinanceSymbol, the BrokerSymbol & in wsOtherSymbols also the currency
  const dividendObjKeys = Object.keys(dividendObj)
  wsSymbols.eachRow((row, rowNumber) => {
    if (rowNumber !== 1) {
      const brokerSymbol = row.values[2]
      if (dividendObjKeys.includes(brokerSymbol)) {
        dividendObj[brokerSymbol].yahooFinanceSymbol = row.values[1]
        dividendObj[brokerSymbol].brokerSymbol = brokerSymbol
      }
    }
  })

  wsOtherSymbols.eachRow((row, rowNumber) => {
    if (rowNumber !== 1) {
      const brokerSymbol = row.values[2]
      if (dividendObjKeys.includes(brokerSymbol)) {
        dividendObj[brokerSymbol].yahooFinanceSymbol = row.values[1]
        dividendObj[brokerSymbol].brokerSymbol = brokerSymbol
        dividendObj[brokerSymbol].currency = row.values[3]
      }
    }
  })

  // Iterate through wsCurrencyExcange
  const currencyObj = {}
  wsCurrencyExchange.eachRow((row, rowNumber) => {
    if (rowNumber !== 1) {
      currencyObj[row.values[1]] = {
        currency: row.values[1],
        exchangeRate: row.values[2],
      }
    }
  })

  const processedExcelData = {
    dividendObj,
    currencyObj,
  }

  return processedExcelData
}

// -----------------------------------------------------
async function AddDividend() {
  readExcel().then((processedExcelData) => {
    const symbols = getRapidApiSymbols.value.yahooFinanceSymbolsCategories[investmentDetailName]
    const dividendBrokerSymbols = Object.keys(processedExcelData.dividendObj)
    const dividendObj = processedExcelData.dividendObj
    const currencyObj = processedExcelData.currencyObj

    dividendBrokerSymbols.forEach(async (symbol) => {
      const yahooFinanceSymbol = processedExcelData.dividendObj[symbol].yahooFinanceSymbol
      if (symbols.includes(yahooFinanceSymbol)) {
        const symbolObject = dividendObj[symbol]
        const symbolCurrency = symbolCurrencyArray.find(
          (item) => item.symbol === yahooFinanceSymbol,
        )
        const exchangeRate = currencyObj[symbolCurrency.currency].exchangeRate
        const symbolObjectDividendsKeys = Object.keys(symbolObject.dividends)
        symbolObjectDividendsKeys.forEach((entry) => {
          symbolObject.dividends[entry].dividendBaseCurrency =
            symbolObject.dividends[entry].dividend / exchangeRate
        })

        const dividendsToSaveKeys = Object.keys(symbolObject.dividends)
        dividendsToSaveKeys.forEach(async (key) => {
          await updateDoc(
            doc(db, 'users', storeAuth.user.id, investmentDetailName, yahooFinanceSymbol),
            {
              [`dividends.${key}`]: symbolObject.dividends[key],
            },
          )
        })
        // save to firestore database

        $q.notify({
          message: 'dividens saved to database',
          color: 'positive',
          icon: 'check_circle',
          timeout: 5000,
        })
      } else {
        const symbolObject = dividendObj[symbol]
        const symbolCurrency = symbolObject.currency
        const exchangeRate = currencyObj[symbolCurrency].exchangeRate
        const symbolObjectDividendsKeys = Object.keys(symbolObject.dividends)
        symbolObjectDividendsKeys.forEach((entry) => {
          symbolObject.dividends[entry].dividendBaseCurrency =
            symbolObject.dividends[entry].dividend / exchangeRate
        })
        const dividends = symbolObject.dividends

        const allSymbols = getAllSymbols.value.yahooFinanceSymbolsCategories[investmentDetailName]
        console.log(allSymbols)

        if (allSymbols.includes(yahooFinanceSymbol)) {
          const dividendsToSaveKeys = Object.keys(symbolObject.dividends)
          dividendsToSaveKeys.forEach(async (key) => {
            await updateDoc(
              doc(db, 'users', storeAuth.user.id, investmentDetailName, yahooFinanceSymbol),
              {
                [`dividends.${key}`]: symbolObject.dividends[key],
              },
            )
          })
        } else {
          const generalInfo = {
            symbol: yahooFinanceSymbol,
            sector: '',
            superSector: '',
            country: 'US',
          }

          const userInfo = {
            userStockPrice: 0.0,
            userStockDividend: 0.0,
            userStockPriceCheckBox: false,
            userStockDividendCheckBox: false,
            userRegion: '',
            userRegionCheckBox: false,
          }

          await setDoc(
            doc(db, 'users', storeAuth.user.id, investmentDetailName, yahooFinanceSymbol),
            {
              generalInfo,
              userInfo,
              orderInfo: {},
              apiData: {},
              dividends,
            },
          )
        }

        $q.notify({
          message: 'dividens saved to database',
          color: 'positive',
          icon: 'check_circle',
          timeout: 5000,
        })
      }
    })
  })
}

// ----------------------------------------------------------------------------------------
// ---------------------------------- DELETE DIVIDENDS ------------------------------------
// ----------------------------------------------------------------------------------------
const allSymbolSelectOptions =
  getAllSymbols.value.yahooFinanceSymbolsCategories[investmentDetailName]
const allSymbolSelected = ref(allSymbolSelectOptions[0])

const columnsDelete = [
  {
    name: 'date',
    label: 'Date',
    field: (row) => row.date,
    format: (val) => `${val}`,
    align: 'center',
    sortable: true,
  },
  {
    name: 'dividendAmount',
    label: 'Amount',
    field: 'dividendAmount',
    align: 'center',
    sortable: true,
    format: (val) => `${val.toLocaleString('en-US', { maximumFractionDigits: 1 })}`,
  },
  // {
  //   name: 'dividendBaseCurrency',
  //   label: 'Dividend base currency',
  //   field: 'dividendBaseCurrency',
  //   align: 'center',
  //   format: val => `${val.toLocaleString('en-US', { maximumFractionDigits: 1 })}`
  // },
  { name: 'delete', label: 'Delete', field: '', align: 'center' },
]

const rowsDelete = computed(() => {
  // final result
  const dividendEntries = []

  // get rowsData
  const dividendsObject =
    getDividends.value.byCompany[investmentDetailName][allSymbolSelected.value].dividends
  const dividendsObjectKeys = Object.keys(dividendsObject)
  dividendsObjectKeys.forEach((key) => {
    const newEntry = {}
    newEntry.uuid = key
    newEntry.date = formatTimestampToDate(dividendsObject[key].date)
    newEntry.dividendAmount = dividendsObject[key].dividend
    // newEntry.dividendBaseCurrency = dividendsObject[key].dividendBaseCurrency
    dividendEntries.push(newEntry)
  })

  return dividendEntries
})

// delete row
async function deleteRow(propsDeleteId) {
  const id = propsDeleteId.uuid

  const orderRef = doc(
    db,
    'users',
    storeAuth.user.id,
    investmentDetailName,
    allSymbolSelected.value,
  )
  await updateDoc(orderRef, {
    [`dividends.${id}`]: deleteField(),
  })

  // notify that form saving was done succesfully
  $q.notify({
    message: 'order deleted from database',
    color: 'warning',
    icon: 'check_circle',
    timeout: 1000,
  })
}
</script>

<!------------------------------------------------------------------------------------------------------->
<!-------------------------------------------- STYLE ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<style scoped></style>
