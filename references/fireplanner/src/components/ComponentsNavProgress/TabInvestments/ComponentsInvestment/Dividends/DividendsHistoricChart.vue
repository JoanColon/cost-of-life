<!-- eslint-disable no-lone-blocks -->
<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------ TEMPLATE --------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<template>
  <div style="max-width: 1000px; margin: auto">
    <!----------------------------- Select dividend information ------------------------------------>
    <div class="q-pa-none q-mt-lg" style="display: flex; justify-content: space-evenly; width: 95%">
      <q-radio v-model="diviInfoRadioBtn" val="year" label="Portofolio" color="orange" />
      <q-radio v-model="diviInfoRadioBtn" val="symbol" label="Symbol" color="orange" />
    </div>

    <!----------------------------- Annual dividends chart ------------------------------------>
    <div v-if="diviInfoRadioBtn === 'year'">
      <div class="q-my-md q-ml-lg text-body1" style="margin-right: 10px">
        <strong>Dividends since inception: </strong>The portofolio has generated
        {{ totalIncome }} in passive income
      </div>

      <GChart
        type="ColumnChart"
        :data="chartDividendsYear"
        :options="chartDividendsYearOptions"
        :events="chartEvents"
      />

      <!----------------------------- Detail year dividends chart ------------------------------->
      <div class="q-ml-lg text-body1" style="display: flex; align-items: center">
        <span style="margin-right: 10px"
          ><q-select borderless v-model="showDetailYear" :options="yearList[0]"
        /></span>
        passive income was {{ showDetailAmount }}
      </div>

      <div style="width: 100%">
        <q-carousel
          v-model="chartSlide"
          swipeable
          animated
          control-color="orange"
          navigation
          padding
          height="400px"
        >
          <q-carousel-slide name="treeMapChart">
            <GChart
              type="TreeMap"
              :settings="chartTreeSettings"
              :data="chartDividendAnnualDetail[1]"
              :options="chartTreeOptions"
            />
          </q-carousel-slide>

          <q-carousel-slide name="columnChart">
            <GChart
              type="ColumnChart"
              :data="chartDividendAnnualDetail[0]"
              :options="chartDividendsYearDetailOptions"
            />
          </q-carousel-slide>
        </q-carousel>
      </div>
    </div>

    <!----------------------------- Dividends received by Symbol ------------------------------->
    <div v-else>
      <div class="q-ml-lg text-body1" style="display: flex; align-items: center">
        <span style="margin-right: 10px"><strong>Income received from:</strong></span>
        <q-btn class="q-mr-md" flat size="sm" icon="arrow_back" @click="minusSymbolDetail()" />
        <q-select borderless style="width: 75px" v-model="symbolDetail" :options="symbolOptions" />
        <q-btn class="q-mr-md" flat size="sm" icon="arrow_forward" @click="addSymbolDetail()" />
      </div>
      <!-- <q-select v-model="symbolDetail" :options="symbolOptions" label="Standard" /> -->
      <q-carousel
        v-model="symbolChartSlide"
        swipeable
        animated
        control-color="orange"
        navigation
        padding
        height="400px"
      >
        <q-carousel-slide name="symbolCurrency">
          <GChart
            type="ColumnChart"
            :data="chartDividendsSymbol.dataSymbolCurrency"
            :options="chartDividendsSymbol.OptionsSymbolCurrency"
          />
        </q-carousel-slide>

        <q-carousel-slide name="baseCurrency">
          <GChart
            type="ColumnChart"
            :data="chartDividendsSymbol.dataBaseCurrency"
            :options="chartDividendsSymbol.OptionsBaseCurrency"
          />
        </q-carousel-slide>
      </q-carousel>

      <!-- symbol information -->
      <div>
        <div class="text-body1 q-my-sm q-ml-lg">
          <strong>{{ symbolDetail }} Summary information:</strong>
        </div>
        <q-markup-table v-if="$q.screen.width > 450" class="q-mb-lg">
          <thead>
            <tr>
              <th class="text-center">Market value</th>
              <th class="text-center">Total invested</th>
              <th class="text-center">Total sold</th>
              <th class="text-center">Realised capital gains</th>
              <th class="text-center">Unrealized capital gains</th>
              <th class="text-center">Gross income</th>
              <th class="text-center">TOTAL gross return</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="text-center">{{ tableDividendSymbol.symbolMarketValueFormatted }}</td>
              <td class="text-center">{{ tableDividendSymbol.totalBuysFormatted }}</td>
              <td class="text-center">{{ tableDividendSymbol.totalSellsFormatted }}</td>
              <td class="text-center">{{ tableDividendSymbol.realizedCapitalGainsFormatted }}</td>
              <td class="text-center">{{ tableDividendSymbol.unrealizedCapitalGainsFormatted }}</td>
              <td class="text-center">{{ tableDividendSymbol.grossDividendsFormatted }}</td>
              <td class="text-center">{{ tableDividendSymbol.totalGrossReturnFormatted }}</td>
            </tr>
          </tbody>
        </q-markup-table>

        <q-list v-else dense>
          <q-item>
            <q-item-section avatar><q-icon color="orange" name="check" /></q-item-section>
            <q-item-section
              >Market value: {{ tableDividendSymbol.symbolMarketValueFormatted }}
            </q-item-section>
          </q-item>

          <q-item>
            <q-item-section avatar><q-icon color="orange" name="check" /></q-item-section>
            <q-item-section
              >Total invested: {{ tableDividendSymbol.totalBuysFormatted }}
            </q-item-section>
          </q-item>

          <q-item>
            <q-item-section avatar><q-icon color="orange" name="check" /></q-item-section>
            <q-item-section
              >Total sold: {{ tableDividendSymbol.totalSellsFormatted }}
            </q-item-section>
          </q-item>

          <q-item>
            <q-item-section avatar><q-icon color="orange" name="check" /></q-item-section>
            <q-item-section
              >Realized capital gains: {{ tableDividendSymbol.realizedCapitalGainsFormatted }}
            </q-item-section>
          </q-item>

          <q-item>
            <q-item-section avatar><q-icon color="orange" name="check" /></q-item-section>
            <q-item-section
              >Unrealized capital gains: {{ tableDividendSymbol.unrealizedCapitalGainsFormatted }}
            </q-item-section>
          </q-item>

          <q-item>
            <q-item-section avatar><q-icon color="orange" name="check" /></q-item-section>
            <q-item-section
              >Gross income: {{ tableDividendSymbol.grossDividendsFormatted }}
            </q-item-section>
          </q-item>

          <q-item>
            <q-item-section avatar><q-icon color="orange" name="check" /></q-item-section>
            <q-item-section
              >TOTAL gross return: {{ tableDividendSymbol.totalGrossReturnFormatted }}
            </q-item-section>
          </q-item>
        </q-list>
      </div>
    </div>
  </div>
</template>

<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------- SCRIPT ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<!-- eslint-disable no-unused-vars -->
<script setup>
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { GChart } from 'vue-google-charts'
import { useQuasar } from 'quasar'
import * as math from 'mathjs'

// import helper functions
import {
  currencyStringToSymbol,
  numberToCurrency,
  numberToPercentage,
  GBpToGBP,
} from 'src/js/helperFunctions.js'
import { calculateFifoPosition } from 'src/js/investmentsFunctions'

// import and declare stores
import { useStoreUserSettings } from 'src/stores/storeUserSettings'
import { useStoreInvestments } from 'src/stores/storeInvestments'
const storeInvestments = useStoreInvestments()
const storeUserSettings = useStoreUserSettings()

// get reactive data from stores
const { getDividends, getBrokerageData } = storeToRefs(storeInvestments)
const { currencyString, userSettings } = storeToRefs(storeUserSettings)
const baseCurrencySymbol = currencyString.value
const currency = userSettings.value.currency
const taxRate = userSettings.value.taxRate

// declare useQuasar (to use the "notify" plugin)
const $q = useQuasar()

// get props form InvestmentMainComponent
const props = defineProps(['investmentDetailName'])
const investmentDetailName = props.investmentDetailName

const diviInfoRadioBtn = ref('year')

// #####################################################################################
// ---------------------------- Annual dividends chart ---------------------------------
// #####################################################################################
const chartDividendsYear = computed(() => {
  // STEP 1 - create the chart data constant with the needed colums
  const data = [['Year', 'Annual Income']]

  // STEP 2 - populate the chartData with yearly data
  try {
    const annualDividends = getDividends.value.byYear[investmentDetailName]
    const yearKeys = Object.keys(annualDividends)
    yearKeys.forEach((year) => {
      const newRow = []
      const sumByYear = annualDividends[year].reduce((acc, currentValue) => {
        const { year, dividendBaseCurrency } = currentValue
        acc[year] = (acc[year] || 0) + dividendBaseCurrency
        return acc
      }, {})
      newRow.push(Object.keys(sumByYear)[0])
      newRow.push(sumByYear[year])
      data.push(newRow)
    })

    return data
  } catch {
    const newRow = ['0', 0]
    data.push(newRow)
    return data
  }
})

// STEP 3 - calculate the total income received since portofolio inception
const totalIncome = computed(() => {
  try {
    const data = chartDividendsYear.value

    const incomeReceived = data
      .slice(1) // Remove the first item
      .reduce((acc, curr) => acc + curr[1], 0) // Sum the values of the remaining items

    const incomeReceivedFormatted = incomeReceived.toLocaleString('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    })

    return incomeReceivedFormatted
  } catch {
    return 0
  }
})

// bar chart options
const chartDividendsYearOptions = {
  legend: { position: 'none' },
  seriesType: 'bars',
  isStacked: true,
  vAxis: {
    title: `Dividends (${baseCurrencySymbol}/year)`,
  },
  chartArea: {
    left: 60,
    right: 30,
    top: 15,
    bottom: 50,
  },
  height: 300,
}

// chart events
const chartEvents = {
  ready: () => {},
  click: (event) => {
    try {
      const targetId = event.targetID
      const id = targetId[targetId.length - 1]
      const idNumb = parseInt(id) + 1
      const year = chartDividendsYear.value[idNumb][0]
      showDetailYear.value = year
    } catch {
      console.log('wrong click')
    }
  },
}

// #####################################################################################
// ---------------------------- Annual DETAILED dividend chart --------------------------
// #####################################################################################
// name of the slide to show in the carousel
const chartSlide = ref('treeMapChart')

// get Last year to show as initial value
const yearList = computed(() => {
  try {
    const data = chartDividendsYear.value
    const yearList = []
    for (let i = 1; i < data.length; i++) {
      const year = data[i][0]
      yearList.push(year)
    }
    const lastYear = data[data.length - 1][0]
    return [yearList, lastYear]
  } catch {
    return ['0', '0']
  }
})

const showDetailYear = ref(yearList.value[1])
const showDetailAmount = computed(() => {
  const dividendAmount = chartDividendsYear.value
    .find((entry) => entry[0] === showDetailYear.value)[1]
    .toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 0 })
  return dividendAmount
})

// get chart data
const chartDividendAnnualDetail = computed(() => {
  const year = showDetailYear.value

  // STEP 1 - create the chart data constant with the needed colums
  // chart data for columnChart
  const chartData = [['Symbol', 'Annual income']]

  // chart data for the treeMap chart
  const chartTreeData = [
    ['Symbol', 'Parent', 'Annual income'],
    ['Portofolio', null, 0],
  ]

  try {
    // STEP 2 - populate the chartData with yearly data
    const annualDividendsDetail = getDividends.value.byYear[investmentDetailName][year]
    const sumBySymbol = annualDividendsDetail.reduce((acc, currentValue) => {
      const { symbol, dividendBaseCurrency } = currentValue
      acc[symbol] = (acc[symbol] || 0) + dividendBaseCurrency
      return acc
    }, {})

    const symbolKeys = Object.keys(sumBySymbol)
    const dataArray = []
    const dataTreeArray = []
    symbolKeys.forEach((key) => {
      const newRow = []
      const newTreeRow = []
      newRow.push(key)
      newRow.push(sumBySymbol[key])
      dataArray.push(newRow)

      newTreeRow.push(key)
      newTreeRow.push('Portofolio')
      newTreeRow.push(sumBySymbol[key])
      dataTreeArray.push(newTreeRow)
    })

    dataArray.sort((a, b) => b[1] - a[1]) // Sort based on income in descending order
    dataArray.forEach((entry) => chartData.push(entry))
    dataTreeArray.forEach((entry) => chartTreeData.push(entry))

    return [chartData, chartTreeData]
  } catch {
    chartData.push(['n.a', 0])
    chartTreeData.push(['n.a', 'Portofolio', 0])
    return [chartData, chartTreeData]
  }
})

// tree chart options
const chartTreeOptions = {
  minColor: '#EAEEFF',
  midColor: '#929BD1',
  maxColor: '#3366CC',
  headerHeight: 0,
  fontColor: 'black',
  width: '100%',
  height: 325,
  eventsConfig: {
    highlight: ['click'],
    unhighlight: ['mouseout'],
    rollup: ['contextmenu'],
    drilldown: ['dblclick'],
  },
}

const chartTreeSettings = {
  packages: ['treemap'],
}

// bar chart options
const chartDividendsYearDetailOptions = {
  legend: { position: 'none' },
  seriesType: 'bars',
  isStacked: true,
  vAxis: {
    title: `Dividends (${baseCurrencySymbol}/year)`,
  },
  chartArea: {
    left: 60,
    right: 5,
    top: 5,
    bottom: 30,
  },
  height: 300,
}

// #####################################################################################
// ---------------------------- SYMBOL DIVIDEND SECTION --------------------------------
// #####################################################################################

// --------------------------------- General data ---------------------------------------
const symbolChartSlide = ref('symbolCurrency') // symbol currency or base currency view in the chart (e.g., € vs $)

const symbolOptions = Object.keys(getDividends.value.byCompany[investmentDetailName])
const symbolDetail = ref(symbolOptions[0])

// functions to move the symbols without needed to select them
let symbolDetailPosition = 0
function addSymbolDetail() {
  const position = symbolOptions.indexOf(symbolDetail.value)
  const maxLenght = symbolOptions.length - 1

  if (symbolDetailPosition < maxLenght) {
    symbolDetailPosition = position + 1
    symbolDetail.value = symbolOptions[symbolDetailPosition]
  }
}

function minusSymbolDetail() {
  const position = symbolOptions.indexOf(symbolDetail.value)

  if (symbolDetailPosition !== 0) {
    symbolDetailPosition = position - 1
    symbolDetail.value = symbolOptions[symbolDetailPosition]
  }
}

// get dividend array by Symbol and symbol currency (to be used in dividend chart and dividend table)
const dividendArray = computed(() => {
  const symbol = computed(() => symbolDetail.value)

  // get an array of dividends entries by symbol
  const annualDividends = getDividends.value.byCompany[investmentDetailName]
  const dividendObject = annualDividends[symbol.value].dividends
  const dividendObjKeys = Object.keys(dividendObject)
  const dividendArray = []
  dividendObjKeys.forEach((key) => {
    dividendArray.push(dividendObject[key])
  })

  return dividendArray
})

// get currency of selected symbol
const symbolCurrency = computed(() => {
  const symbolGetBrokerageData = getBrokerageData.value[0][investmentDetailName].find(
    (element) => element.symbol === symbolDetail.value,
  )

  const symbolCurrencyString =
    symbolGetBrokerageData && symbolGetBrokerageData.currency ? symbolGetBrokerageData.currency : ''

  const symbolCurrency = currencyStringToSymbol(symbolCurrencyString)

  const currencyData = {
    symbolCurrencyString,
    symbolCurrency,
  }

  return currencyData
})

// -------------------------------------------------------------------------------------
// ---------------------------- Symbol dividends chart ---------------------------------
// -------------------------------------------------------------------------------------
const chartDividendsSymbol = computed(() => {
  // STEP 1 - create the chart data constant with the needed colums
  const dataSymbolCurrency = [['Year', 'Annual income']]

  const dataBaseCurrency = [['Year', 'Annual income']]

  // STEP 2 - populate the chart data (dividendArray imported from computed above)
  // populate chart for dividends receivedn in Symbol currency
  const sumByYearSymbolCurrency = dividendArray.value.reduce((acc, currentValue) => {
    const { date, dividend } = currentValue
    const year = new Date(date).getFullYear()
    acc[year] = (acc[year] || 0) + dividend
    return acc
  }, {})

  const sumByYearKeysSymbolCurrency = Object.keys(sumByYearSymbolCurrency).forEach((key) => {
    const newRow = []
    newRow.push(key)
    newRow.push(sumByYearSymbolCurrency[key])
    dataSymbolCurrency.push(newRow)
  })

  // populate chart for dividends receivedn in Symbol currency base currency
  const sumByYearBaseCurrency = dividendArray.value.reduce((acc, currentValue) => {
    const { date, dividendBaseCurrency } = currentValue
    const year = new Date(date).getFullYear()
    acc[year] = (acc[year] || 0) + dividendBaseCurrency
    return acc
  }, {})

  const sumByYearKeysBaseCurrency = Object.keys(sumByYearBaseCurrency).forEach((key) => {
    const newRow = []
    newRow.push(key)
    newRow.push(sumByYearBaseCurrency[key])
    dataBaseCurrency.push(newRow)
  })

  // STEP 3 - chart options, needed inside the computed because of changing depending on the symbol
  const OptionsSymbolCurrency = {
    legend: { position: 'none' },
    seriesType: 'bars',
    vAxis: {
      title: `Dividends (${symbolCurrency.value.symbolCurrency}/year)`, // symbolCurrency imported from computed above
    },
    chartArea: {
      left: 80,
      right: 25,
      top: 15,
      bottom: 30,
    },
    height: 300,
  }

  const OptionsBaseCurrency = {
    legend: { position: 'none' },
    seriesType: 'bars',
    vAxis: {
      title: `Dividends (${baseCurrencySymbol}/year)`,
    },
    chartArea: {
      left: 80,
      right: 25,
      top: 15,
      bottom: 30,
    },
    height: 300,
  }

  // STEP 5 - Returned data
  const returnData = {
    dataBaseCurrency,
    dataSymbolCurrency,
    OptionsSymbolCurrency,
    OptionsBaseCurrency,
  }

  return returnData
})

// -------------------------------------------------------------------------------------
// ---------------------------- Symbol dividends table ---------------------------------
// -------------------------------------------------------------------------------------
const tableDividendSymbol = computed(() => {
  const symbolInfo = storeInvestments.allOrderList[investmentDetailName].find(
    (element) => element.generalInfo.symbol === symbolDetail.value,
  )
  const orderInfo = symbolInfo.orderInfo
  const orderInfoKeys = Object.keys(orderInfo)
  const fifoPosition = calculateFifoPosition(orderInfo)

  // ------------------ calculations for the symbol currency --------------------------
  // get total invested & total sold
  const totalBuysArray = []
  const totalSharesBoughtArray = []
  const totalSellArray = []
  const totalSharesSoldArray = []
  orderInfoKeys.forEach((key) => {
    if (orderInfo[key].buyOrSell === 'Buy') {
      totalBuysArray.push(orderInfo[key].totalTransaction)
      totalSharesBoughtArray.push(orderInfo[key].shareAmount)
    } else {
      totalSellArray.push(orderInfo[key].totalTransaction)
      totalSharesSoldArray.push(orderInfo[key].shareAmount)
    }
  })

  const totalBuysSum = math.sum(totalBuysArray)
  let totalBuys = typeof totalBuysSum === 'number' && !isNaN(totalBuysSum) ? totalBuysSum : 0
  const totalShareBuysSum = math.sum(totalSharesBoughtArray)
  const totalShareBuys =
    typeof totalShareBuysSum === 'number' && !isNaN(totalShareBuysSum) ? totalShareBuysSum : 0

  const totalSellsSum = math.sum(totalSellArray)
  let totalSells = typeof totalSellsSum === 'number' && !isNaN(totalSellsSum) ? totalSellsSum : 0
  const totalShareSellsSum = math.sum(totalSharesSoldArray)
  const totalShareSells =
    typeof totalShareSellsSum === 'number' && !isNaN(totalShareSellsSum) ? totalShareSellsSum : 0

  // market value
  const symbolCurrentPriceApi = symbolInfo.apiData.regularMarketPrice
  const symbolCurrentPrice =
    typeof symbolCurrentPriceApi === 'number' && !isNaN(symbolCurrentPriceApi)
      ? symbolCurrentPriceApi
      : 0
  let symbolMarketValue = symbolCurrentPrice * (totalShareBuys + totalShareSells) // toalShareSells is "+" because the number is negative

  // capital gains
  const realizedCapitalGains = fifoPosition.realizedCapitalGains
  let realizedCapitalGainsIsNaN = isNaN(realizedCapitalGains) ? 0 : realizedCapitalGains
  const unrealizedCapitalGains = symbolMarketValue - fifoPosition.remainingCostBasis
  let unrealizedCapitalGainsIsNaN = isNaN(unrealizedCapitalGains) ? 0 : unrealizedCapitalGains

  // check if currency is GBp
  if (symbolCurrency.value.symbolCurrencyString === 'GBp') {
    totalBuys = totalBuys / 100
    totalSells = totalSells / 100
    symbolMarketValue = symbolMarketValue / 100
    realizedCapitalGainsIsNaN = realizedCapitalGainsIsNaN / 100
    unrealizedCapitalGainsIsNaN = unrealizedCapitalGainsIsNaN / 100
  }

  // gross dividends, from computed value in general sections (dividendArray)
  const grossDividendsSymbolCurrency = dividendArray.value.reduce((sum, current) => {
    return sum + current.dividend
  }, 0)

  // Total gross return
  const investmentGains =
    symbolMarketValue + totalSells * -1 + grossDividendsSymbolCurrency - totalBuys
  const totalGrossReturn = investmentGains / totalBuys
  const totalGrossReturnIsNaN = isNaN(totalGrossReturn) ? 0 : totalGrossReturn

  // get gross dividend
  const totalBuysFormatted = numberToCurrency(
    totalBuys,
    symbolCurrency.value.symbolCurrencyString,
    1,
  )
  const totalSellsFormatted = numberToCurrency(
    totalSells,
    symbolCurrency.value.symbolCurrencyString,
    1,
  )
  const symbolMarketValueFormatted = numberToCurrency(
    symbolMarketValue,
    symbolCurrency.value.symbolCurrencyString,
    1,
  )
  const realizedCapitalGainsFormatted = numberToCurrency(
    realizedCapitalGainsIsNaN,
    symbolCurrency.value.symbolCurrencyString,
    1,
  )
  const unrealizedCapitalGainsFormatted = numberToCurrency(
    unrealizedCapitalGainsIsNaN,
    symbolCurrency.value.symbolCurrencyString,
    1,
  )
  const grossDividendsFormatted = numberToCurrency(
    grossDividendsSymbolCurrency,
    symbolCurrency.value.symbolCurrencyString,
    1,
  )
  const totalGrossReturnFormatted = numberToPercentage(totalGrossReturnIsNaN, 1)

  // object with all table information
  const otherInfoSymbolCurrency = {
    grossDividends: grossDividendsSymbolCurrency,
    grossDividendsFormatted,
    totalBuysFormatted,
    totalSellsFormatted,
    symbolMarketValueFormatted,
    realizedCapitalGainsFormatted,
    unrealizedCapitalGainsFormatted,
    totalGrossReturnFormatted,
  }

  return otherInfoSymbolCurrency
})
</script>

<!------------------------------------------------------------------------------------------------------->
<!-------------------------------------------- STYLE ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<style scoped></style>
