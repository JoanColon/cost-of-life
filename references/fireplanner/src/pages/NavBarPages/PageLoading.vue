<template>
  <q-page>
    <div class="fixed-center">
      <div class="text-h5">Loading userdata from database</div>
      <q-spinner color="primary" size="3em" :thickness="2" style="margin: auto; width: 100%" />
    </div>
  </q-page>
</template>

<script setup>
// general vue imports
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'

// import and declare stores
import { updateMarketData, updateCryptoData } from 'src/js/rapidApiCall.js'

// import and declare stores
import { useStoreUserSettings } from 'src/stores/storeUserSettings'
import { useStoreKeyMetrics } from 'src/stores/storeKeyMetrics'
import { useStoreNetWorth } from 'src/stores/storeNetWorth'
import { useStorePlanData } from 'src/stores/storePlanData'
import { useStoreSavings } from 'src/stores/storeSavings'
import { useStoreInvestmentsGlobal } from 'src/stores/storeInvestmentsGlobal'
import { useStoreInvestments } from 'src/stores/storeInvestments'
const storeUserSettings = useStoreUserSettings()
const storeKeyMetrics = useStoreKeyMetrics()
const storeNetWorth = useStoreNetWorth()
const storePlanData = useStorePlanData()
const storeSavings = useStoreSavings()
const storeInvestmentsGlobal = useStoreInvestmentsGlobal()
const storeInvestments = useStoreInvestments()

const router = useRouter()
const $q = useQuasar()

async function getStoreData() {
  // revised
  storeUserSettings.getUserSettingsSnapShot()
  storeKeyMetrics.getkeyMetricsDoc()
  storeNetWorth.getNetworthDoc()
  storeSavings.getSavingsDoc()

  // new investments store
  storeInvestments.getAllOrders()
  storeInvestments.getNetworthAssetsDoc()

  // to revise
  storeInvestmentsGlobal.getCurrencyExchange()
  await storePlanData.getPlanNames()
  await storePlanData.getPlanData()

  console.log('data received from firebase')
  return 'data from store received'
}

// ---------------------------------
function updateRapidApiDataOnAppLaunch() {
  try {
    const rapidApiSymbols = storeInvestments.getRapidApiSymbols
    const yahooFinanceUpdatePreference =
      storeUserSettings.userSettings.updateApiPreferences.yahooFinance
    const coinRankingUpdatePreference =
      storeUserSettings.userSettings.updateApiPreferences.coinRanking

    if (yahooFinanceUpdatePreference === 'always' && coinRankingUpdatePreference === 'always') {
      updateMarketData(rapidApiSymbols)
      updateCryptoData(rapidApiSymbols)

      // notify that form saving was done succesfully
      $q.notify({
        message: 'market data updated',
        color: 'positive',
        icon: 'check_circle',
        timeout: 1000,
      })
      return 'All rapidApi data updated succesfully'
    } else if (
      yahooFinanceUpdatePreference === 'always' &&
      coinRankingUpdatePreference === 'never'
    ) {
      updateMarketData(rapidApiSymbols)
      // notify that form saving was done succesfully
      $q.notify({
        message: 'market data updated',
        color: 'positive',
        icon: 'check_circle',
        timeout: 1000,
      })
      return 'YahooFinance rapidApi data updated succesfully'
    } else if (
      yahooFinanceUpdatePreference === 'never' &&
      coinRankingUpdatePreference === 'always'
    ) {
      updateCryptoData(rapidApiSymbols)

      $q.notify({
        message: 'market data updated',
        color: 'positive',
        icon: 'check_circle',
        timeout: 1000,
      })
      return 'CoinRanking rapidApi data updated succesfully'
    } else {
      console.log('no update needed')
      $q.notify({
        message: 'A problem has ocurred, market data was not updated',
        color: 'negative',
        icon: 'check_circle',
        timeout: 2000,
      })
    }
  } catch {
    console.log('waiting')
  }
}

// When the user is logged is initially redirected to the home page, in this moment we upload the needed data from firestore
onMounted(() => {
  getStoreData()
  setTimeout(() => {
    router.push('/home')
    updateRapidApiDataOnAppLaunch()
  }, 2250)
})
</script>

<style scoped></style>
