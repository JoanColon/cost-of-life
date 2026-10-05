<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------ TEMPLATE --------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<template>
  <div style="max-width: 1000px">
    <div class="q-mt-md text-subtitle2 text-center">Historic dividend chart of {{ symbol }}</div>
    <div>
      <GChart type="ColumnChart" :data="chartData.chartData" :options="chartData.chartOptions" />

      <div>
        <q-range
          class="q-pl-md"
          v-model="zoomYears"
          :min="0"
          :max="totalNumberYears"
          color="orange"
          style="width: 100%"
        />
      </div>
    </div>
  </div>
</template>

<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------- SCRIPT ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<script setup>
import { ref, computed, watch } from 'vue'
import { GChart } from 'vue-google-charts'
import { storeToRefs } from 'pinia'

// import own functions
import { formatUnixTimestampToDate, currencyStringToSymbol } from 'src/js/helperFunctions'

// import stores
import { useStoreInvestments } from 'src/stores/storeInvestments'
const storeInvestments = useStoreInvestments()

// get reactive data from stores
const { getAnalysisCharts } = storeToRefs(storeInvestments)

const props = defineProps({
  symbol: String,
})

// ----------------------------------------- chart data ---------------------------------------
const chartData = computed(() => {
  try {
    const symbolData =
      getAnalysisCharts.value.detailBrokerageAccount[props.symbol].analysisChartData[0]
    const currency = getAnalysisCharts.value.detailBrokerageAccount[props.symbol].currency

    const chartData = [['month', 'dividend']]

    const dividendData = symbolData.events.dividends
    const dividendDataKeys = Object.keys(dividendData)
    const dividendArray = []

    for (let i = 0; i < dividendDataKeys.length; i++) {
      const date = formatUnixTimestampToDate(dividendData[dividendDataKeys[i]].date, 4)
      const amount = dividendData[dividendDataKeys[i]].amount
      dividendArray.push([date, amount])
    }

    const dividendByYear = dividendArray.reduce((acc, [date, value]) => {
      const year = date.split('/')[1]
      if (!acc[year]) {
        acc[year] = 0
      }
      acc[year] += value
      return acc
    }, {})

    const years = Object.keys(dividendByYear)
    for (let i = zoomYears.value.min; i < years.length; i++) {
      chartData.push([years[i], dividendByYear[years[i]]])
    }

    const chartOptions = {
      chartArea: {
        left: 75,
        right: 30,
        top: 15,
        bottom: 60,
      },
      vAxis: {
        title: `dividend (${currencyStringToSymbol(currency)})`,
      },
      legend: { position: 'none' },
      width: '80%',
      height: 400,
    }

    const chartInfo = {
      chartData,
      chartOptions,
      dividendByYear,
    }

    return chartInfo
  } catch (e) {
    const chartData = [
      ['month', 'dividend'],
      ['1', 0],
    ]

    const chartOptions = {
      chartArea: {
        left: 75,
        right: 30,
        top: 15,
        bottom: 60,
      },
      vAxis: {
        title: 'dividend ()',
      },
      legend: { position: 'none' },
      width: '80%',
      height: 400,
    }
    const chartInfo = {
      chartData,
      chartOptions,
    }
    return chartInfo
  }
})

// -------------------------- zoom --------------------------------
const totalNumberYears = computed(() => {
  try {
    const totalNumberYears = Object.keys(chartData.value.dividendByYear).length
    return totalNumberYears
  } catch {
    const totalNumberYears = 0
    return totalNumberYears
  }
})

const zoomYears = ref({
  min: 0,
  max: 100,
})

watch(props, () => {
  zoomYears.value.min = 0
  zoomYears.value.max = totalNumberYears.value
})
</script>

<!------------------------------------------------------------------------------------------------------->
<!-------------------------------------------- STYLE ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<style scoped></style>
