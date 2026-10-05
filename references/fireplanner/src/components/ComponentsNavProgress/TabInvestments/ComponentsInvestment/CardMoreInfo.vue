<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------ TEMPLATE --------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<template>
  <div>
    <q-card style="width: 500px; max-width: 80vw">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">
          <strong>{{ propsInfo.symbol }}</strong> information
        </div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <q-table
          class="q-my-md q-mx-sm"
          :rows="symbolInfo"
          :columns="columnsInfo"
          :rows-per-page-options="[50]"
          row-key="shortName"
          dense
        />
      </q-card-section>
    </q-card>
  </div>
</template>

<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------- SCRIPT ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<script setup>
import { ref, computed } from 'vue'

// import and declare stores
import { useStoreInvestments } from 'src/stores/storeInvestments'
const storeInvestments = useStoreInvestments()

// props recieved from parent company (investmentTable component)
const props = defineProps(['moreInfoProps'])
const propsInfo = ref(props.moreInfoProps.propsInfo)
const investmentDetailName = ref(props.moreInfoProps.investmentDetailName)
const symbol = propsInfo.value.symbol

// get getter from store
const dailyData = storeInvestments.getDailyData
const dailymarketData = dailyData.dailyYahooFinanceData
const dailycryptoData = dailyData.dailyCryptoData

// ----------------------------- computed values to fill the table ---------------------------------------------------
const columnsInfo = ref([
  {
    name: 'field',
    label: 'Field',
    field: (row) => row.field,
    format: (val) => `${val}`,
    align: 'left',
  },
  { name: 'value', label: 'Value', field: 'value', format: (val) => `${val}`, align: 'center' },
])

const symbolInfo = computed(() => {
  const symbolInfo = []

  if (
    investmentDetailName.value === 'detailBrokerageAccount' ||
    investmentDetailName.value === 'detailRealEstate' ||
    investmentDetailName.value === 'detailFixedIncome'
  ) {
    const symbolData = dailymarketData.find((element) => Object.keys(element)[0] === symbol)
    const currencyInfo = symbolData[symbol].currency

    const price =
      typeof symbolData[symbol].regularMarketPrice !== 'undefined'
        ? symbolData[symbol].regularMarketPrice.toLocaleString('en-US', {
            style: 'currency',
            currency: currencyInfo,
            maximumFractionDigits: 2,
          })
        : 'Not available'
    const fiftyDayAverage =
      typeof symbolData[symbol].fiftyDayAverage !== 'undefined'
        ? symbolData[symbol].fiftyDayAverage.toLocaleString('en-US', {
            style: 'currency',
            currency: currencyInfo,
            maximumFractionDigits: 2,
          })
        : 'Not available'
    const twoHundredDayAverage =
      typeof symbolData[symbol].twoHundredDayAverage !== 'undefined'
        ? symbolData[symbol].twoHundredDayAverage.toLocaleString('en-US', {
            style: 'currency',
            currency: currencyInfo,
            maximumFractionDigits: 2,
          })
        : 'Not available'
    const beta =
      typeof symbolData[symbol].beta !== 'undefined'
        ? symbolData[symbol].beta.toLocaleString('en-US', { maximumFractionDigits: 2 })
        : 'Not available'
    const ebitda =
      typeof symbolData[symbol].ebitda !== 'undefined'
        ? symbolData[symbol].ebitda.toLocaleString('en-US', {
            style: 'currency',
            currency: currencyInfo,
            maximumFractionDigits: 0,
          })
        : 'Not available'
    const epsCurrentYear =
      typeof symbolData[symbol].epsCurrentYear !== 'undefined'
        ? symbolData[symbol].epsCurrentYear.toLocaleString('en-US', {
            style: 'currency',
            currency: currencyInfo,
            maximumFractionDigits: 2,
          })
        : 'Not available'
    const epsForward =
      typeof symbolData[symbol].epsForward !== 'undefined'
        ? symbolData[symbol].epsForward.toLocaleString('en-US', {
            style: 'currency',
            currency: currencyInfo,
            maximumFractionDigits: 2,
          })
        : 'Not available'
    const per =
      typeof symbolData[symbol].priceEpsCurrentYear !== 'undefined'
        ? symbolData[symbol].priceEpsCurrentYear.toLocaleString('en-US', {
            maximumFractionDigits: 1,
          })
        : 'Not available'
    const forwardPE =
      typeof symbolData[symbol].forwardPE !== 'undefined'
        ? symbolData[symbol].forwardPE.toLocaleString('en-US', { maximumFractionDigits: 1 })
        : 'Not available'
    const dividendRate =
      typeof symbolData[symbol].dividendRate !== 'undefined'
        ? symbolData[symbol].dividendRate.toLocaleString('en-US', {
            style: 'currency',
            currency: currencyInfo,
            maximumFractionDigits: 2,
          })
        : 'Not available'
    const dividendYield =
      typeof symbolData[symbol].dividendYield !== 'undefined'
        ? (symbolData[symbol].dividendYield / 100).toLocaleString('en-US', {
            style: 'percent',
            maximumFractionDigits: 2,
          })
        : 'Not available'

    const symbolInfoToPush = [
      { field: 'Short name', value: symbolData[symbol].shortName },
      { field: 'Currency', value: currencyInfo },
      { field: 'Country', value: symbolData[symbol].region },
      { field: 'Current price', value: price },
      { field: '50 days average', value: fiftyDayAverage },
      { field: '200 days average', value: twoHundredDayAverage },
      { field: 'Beta', value: beta },
      { field: 'EBITDA', value: ebitda },
      { field: 'EPS current year', value: epsCurrentYear },
      { field: 'Forward EPS', value: epsForward },
      { field: 'PER', value: per },
      { field: 'Forward PER', value: forwardPE },
      { field: 'Dividend rate', value: dividendRate },
      { field: 'Dividend yield', value: dividendYield },
    ]

    symbolInfoToPush.forEach((element) => {
      symbolInfo.push(element)
    })
  } else {
    const symbolData = dailycryptoData.find((element) => Object.keys(element)[0] === symbol)
    const name =
      symbolData[symbol].name !== 'undefined'
        ? symbolData[symbol].name.toLocaleString('en-US')
        : 'Not available'
    const price =
      symbolData[symbol].price !== 'undefined'
        ? parseFloat(symbolData[symbol].price).toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 2,
          })
        : 'Not available'
    const volume24h =
      symbolData[symbol]['24hVolume'] !== 'undefined'
        ? parseFloat(symbolData[symbol]['24hVolume']).toLocaleString('en-US', {
            maximumFractionDigits: 1,
          })
        : 'Not available'
    const coinrankingUrl =
      symbolData[symbol].coinrankingUrl !== 'undefined'
        ? symbolData[symbol].coinrankingUrl.toLocaleString('en-US')
        : 'Not available'
    const marketCap =
      symbolData[symbol].marketCap !== 'undefined'
        ? parseFloat(symbolData[symbol].marketCap).toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 1,
          })
        : 'Not available'

    const symbolInfoToPush = [
      { field: 'Name', value: name },
      { field: 'Price', value: price },
      { field: 'Currency', value: 'USD' },
      { field: '24h volume', value: volume24h },
      { field: 'Market cap', value: marketCap },
      { field: 'Coinranking url', value: coinrankingUrl },
    ]

    symbolInfoToPush.forEach((element) => {
      symbolInfo.push(element)
    })
  }

  return symbolInfo
})
</script>

<!------------------------------------------------------------------------------------------------------->
<!-------------------------------------------- STYLE ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<style scoped></style>
