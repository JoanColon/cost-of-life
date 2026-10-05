<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------ TEMPLATE --------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<template>
  <div style="max-width: 1000px">
    <div class="q-mt-md text-subtitle2 text-center">Candelstick chart of {{ symbol }}</div>

    <div>
      <!-- <p style="text-align:center"><strong>Dividends distribution</strong></p> -->
      <GChart
        :settings="{ packages: ['corechart'] }"
        type="CandlestickChart"
        :data="chartData.chartData"
        :options="chartData.chartOptions"
      />

      <div style="display: flex">
        <q-badge class="q-mr-md" color="secondary">
          Month: {{ zoom.min }} to {{ zoom.max }}
        </q-badge>

        <q-range
          v-model="zoom"
          :min="0"
          :max="totalNumberMonths"
          color="orange"
          style="width: 80%"
        />
      </div>
    </div>

    <!-- {{chartData.chartData}} -->
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

// ----------------------------------------- zoom data ---------------------------------------
const totalNumberMonths = computed(() => {
  try {
    const symbolData =
      getAnalysisCharts.value.detailBrokerageAccount[props.symbol].analysisChartData[0]
    const totalNumberMonths = symbolData.timestamp.length
    return totalNumberMonths
  } catch {
    const totalNumberMonths = 0
    return totalNumberMonths
  }
})

const zoom = ref({
  min: 0,
  max: totalNumberMonths.value,
})

watch(props, () => {
  zoom.value.min = 0
  zoom.value.max = totalNumberMonths.value
})

// ----------------------------------------- chart data ---------------------------------------
const chartData = computed(() => {
  try {
    const symbolData =
      getAnalysisCharts.value.detailBrokerageAccount[props.symbol].analysisChartData[0]
    const currency = getAnalysisCharts.value.detailBrokerageAccount[props.symbol].currency

    const chartData = [['month', '', '', '', '']]

    for (let i = zoom.value.min; i < zoom.value.max - 1; i++) {
      const newRow = []

      // add date and LOCH
      const date = formatUnixTimestampToDate(symbolData.timestamp[i], 2)
      const low = symbolData.indicators.quote[0].low[i]
      const open = symbolData.indicators.quote[0].open[i]
      const close = symbolData.indicators.quote[0].close[i]
      const high = symbolData.indicators.quote[0].high[i]

      newRow.push(date, low, open, close, high)

      // add row to chartData
      chartData.push(newRow)
    }

    const chartOptions = {
      legend: 'none',
      candlestick: {
        fallingColor: { strokeWidth: 0, fill: '#a52714' }, // red
        risingColor: { strokeWidth: 0, fill: '#0f9d58' }, // green
      },
      chartArea: {
        left: 75,
        right: 30,
        top: 15,
        bottom: 60,
      },
      vAxis: {
        title: `price (${currencyStringToSymbol(currency)})`,
      },
      explorer: {
        actions: ['dragToZoom', 'rightClickToReset'],
        axis: 'both', // Allow zoom along the x-axis
        keepInBounds: true,
        maxZoomIn: 4.0, // Max zoom level
      },
      width: '80%',
      height: 400,
    }

    const chartInfo = {
      chartData,
      chartOptions,
    }

    return chartInfo
  } catch (e) {
    const chartData = [
      ['month', '', '', '', ''],
      ['1', 0, 0, 0, 0],
    ]

    const chartOptions = {
      legend: 'none',
      chartArea: {
        left: 75,
        right: 30,
        top: 15,
        bottom: 60,
      },
      vAxis: {
        title: 'price',
      },
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
</script>

<!------------------------------------------------------------------------------------------------------->
<!-------------------------------------------- STYLE ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<style scoped></style>
