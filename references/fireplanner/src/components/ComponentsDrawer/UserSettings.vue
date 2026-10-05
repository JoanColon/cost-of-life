<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------ TEMPLATE --------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<template>
  <div style="max-width: 1000px; width: 95%; margin: auto; display: block; margin-top: 30px">
    <q-list style="marging-top: 0">
      <!--------------------------------------------------------------------------------------------------------->
      <!-----------------------------------------------ACCOUNT SETTINGS ----------------------------------------->
      <!--------------------------------------------------------------------------------------------------------->
      <q-expansion-item
        class="rounded-borders q-mb-sm q-mt-none q-mt-md shadow-1 white-container"
        style="width: 100%; display: block"
        expand-separator
        icon="perm_identity"
        label="Account settings"
      >
        <q-card>
          <!------------------------------------------ Choose your name ----------------------------------------->
          <q-card-section>
            <div>
              <p class="text-h6">Choose a user name</p>

              <!-- user name -->
              <q-input v-model="userNameModel" label="User name" style="width: 95%" />

              <q-btn
                class="q-mt-sm q-mr-sm q-mb-md"
                style="height: 75%"
                label="Save"
                rounded
                color="orange"
                no-caps
                @click="saveUserName()"
              />
            </div>
          </q-card-section>

          <!------------------------------------ Choose your base currency ----------------------------------------->
          <q-card-section>
            <div>
              <p class="text-h6">Select base currency</p>

              <q-select
                class="q-ml-md q-pb-md"
                style="width: 95%"
                v-model="currencyModel"
                use-input
                hide-selected
                fill-input
                input-debounce="0"
                :options="optionsSelectCurrency"
                label="Select currency"
              />

              <q-btn
                class="q-mt-sm q-mr-sm q-mb-md"
                style="height: 75%"
                label="Save"
                rounded
                color="orange"
                no-caps
                @click="saveBaseCurrency()"
              />
            </div>
          </q-card-section>

          <!------------------------------------------ Select tax rate ----------------------------------------->
          <q-card-section>
            <div>
              <p class="text-h6">Select average tax rate</p>
              <p>
                This tax rate in % (e.g., 21%) will be used to calculate the net income of your
                passive income (e.g., dividends, saving interest, etc.)
              </p>

              <!-- select currncy -->
              <q-input
                v-model="taxRateModel"
                label="Average tax rate for passive income"
                type="number"
                style="width: 95%"
              />

              <q-btn
                class="q-mt-sm q-mr-sm q-mb-md"
                style="height: 75%"
                label="Save"
                rounded
                color="orange"
                no-caps
                @click="saveTaxRate()"
              />
            </div>
          </q-card-section>
        </q-card>
      </q-expansion-item>

      <!--------------------------------------------------------------------------------------------------------->
      <!---------------------------------------------------- API KEYS ------------------------------------------->
      <!--------------------------------------------------------------------------------------------------------->
      <q-expansion-item
        class="rounded-borders q-mb-sm q-mt-none q-mt-md shadow-1 white-container"
        style="width: 100%; display: block"
        expand-separator
        icon="key"
        label="API keys"
      >
        <q-card>
          <q-card-section>
            <div style="width: 100%; display: block">
              <p class="text-h6">Save API Keys</p>
              <p>
                To obtain API keys, you will need to create an account into
                <a href="https://rapidapi.com/hub"><strong>rapidApi</strong></a
                >, and then subscribe to YahooFinance (Yahu Financials by Api Dojo) and Coinranking.
                You can use "basic plans" for free with hard limit and rate limit API calls.
              </p>
              <p class="text-bold q-mb-none q-pb-none">Yahoo Finance API key</p>
              <p>Used to get stocks, bonds, reits & etf data</p>

              <!-- --------------------------- Yahoo finance API key --------------------------------->
              <q-input
                v-model="yahooFinanceRapidApiKey"
                label="YahooFinance rapidApi key"
                style="width: 95%"
              />

              <q-btn
                class="q-mt-sm q-mr-sm"
                style="height: 75%"
                label="Save"
                rounded
                color="orange"
                no-caps
                @click="saveYahooFinanceKey()"
              />

              <q-btn
                class="q-mt-sm q-mr-sm"
                style="height: 75%"
                label="Delete"
                rounded
                color="red"
                no-caps
                @click="deleteYahooFinanceKey()"
              />

              <div class="q-gutter-sm">
                <q-radio
                  v-model="updateYahooFinanceModel"
                  val="never"
                  label="Updated by a user action"
                />
                <q-radio
                  v-model="updateYahooFinanceModel"
                  val="always"
                  label="Updated on app launch"
                />
              </div>

              <!-- --------------------------- Coin ranking API key --------------------------------->
              <p class="q-mt-lg q-mb-none q-pb-none text-bold">Coinranking API key</p>
              <p>Used to get cryptocurrency data</p>
              <q-input
                v-model="cryptoRapidApiKey"
                label="Coinranking rapidApi key"
                style="width: 95%"
              />

              <q-btn
                class="q-mt-sm q-mr-sm q-mb-md"
                style="height: 75%"
                label="Save"
                rounded
                color="orange"
                no-caps
                @click="saveCryptoKey()"
              />

              <q-btn
                class="q-mt-sm q-mr-sm q-mb-md"
                style="height: 75%"
                label="Delete"
                rounded
                color="red"
                no-caps
                @click="deleteCrytpoKey()"
              />

              <div class="q-gutter-sm">
                <q-radio
                  v-model="updateCoinRankingModel"
                  val="never"
                  label="Updated by a user action"
                />
                <q-radio
                  v-model="updateCoinRankingModel"
                  val="always"
                  label="Updated on app launch"
                />
              </div>
            </div>
          </q-card-section>
        </q-card>
      </q-expansion-item>
    </q-list>
  </div>
</template>

<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------- SCRIPT ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<!-- eslint-disable no-unused-vars -->
<script setup>
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useQuasar } from 'quasar'
import { db } from 'src/js/firebase'
import { doc, updateDoc } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'

// import and declare stores
import { useStoreAuth } from 'src/stores/storeAuth'
import { useStoreUserSettings } from 'src/stores/storeUserSettings'
import { useStoreInvestmentsGlobal } from 'src/stores/storeInvestmentsGlobal'
const storeAuth = useStoreAuth()
const storeUserSettings = useStoreUserSettings()
const storeInvestmentsGlobal = useStoreInvestmentsGlobal()

// declare useQuasar (to use the "notify" plugin)
const $q = useQuasar()

// needed to call a firebase function
const functions = getFunctions()

// ---------------------------------------------------------------------------------------------
// ---------------------------------------- user name ------------------------------------------
// ---------------------------------------------------------------------------------------------
const { userSettings } = storeUserSettings

const userNameModel = ref(userSettings.userName)

async function saveUserName() {
  await updateDoc(doc(db, 'users', storeAuth.user.id), {
    userName: userNameModel.value,
  })

  // notify that form saving was done succesfully
  $q.notify({
    message: 'User name updated',
    color: 'positive',
    icon: 'check_circle',
    timeout: 1000,
  })
}

// ---------------------------------------------------------------------------------------------
// ---------------------------------------- select base currency -------------------------------
// ---------------------------------------------------------------------------------------------
const currencyModel = ref(userSettings.currency)

const { currencyExchange } = storeToRefs(storeInvestmentsGlobal)

const optionsSelectCurrency = computed(() => {
  const currencyList = Object.keys(currencyExchange.value)
  return currencyList
})

// save base currency to firestore ddbb
async function saveBaseCurrency() {
  await updateDoc(doc(db, 'users', storeAuth.user.id), {
    currency: currencyModel.value,
  })

  // notify that form saving was done succesfully
  $q.notify({
    message: 'Base currency updated',
    color: 'positive',
    icon: 'check_circle',
    timeout: 1000,
  })
}

// ---------------------------------------------------------------------------------------------
// ---------------------------------------- select tax rate ------------------------------------
// ---------------------------------------------------------------------------------------------
const taxRateModel = ref(userSettings.taxRate * 100)

// save base currency to firestore ddbb
async function saveTaxRate() {
  await updateDoc(doc(db, 'users', storeAuth.user.id), {
    taxRate: taxRateModel.value / 100,
  })

  // notify that form saving was done succesfully
  $q.notify({
    message: 'Tax rate updated',
    color: 'positive',
    icon: 'check_circle',
    timeout: 1000,
  })
}

// ---------------------------------------------------------------------------------------------
// ---------------------------------- submit form "apikeys" to firebase ------------------------
// ---------------------------------------------------------------------------------------------
const yahooFinanceRapidApiKey = ref('')
const cryptoRapidApiKey = ref('')

// ---------------- Yahoo Finance API Keys ----------------------
function saveYahooFinanceKey() {
  const yahooAPIkey = {
    apiKey: yahooFinanceRapidApiKey.value,
    path: 'apiKeys.yahooFinanceRapidApiKey',
  }
  const saveApiKeys = httpsCallable(functions, 'saveApiKeys')
  saveApiKeys(yahooAPIkey).then((result) => {
    console.log(result)

    // notify that form saving was done succesfully
    $q.notify({
      message: 'Yahoo finance API key addded to database',
      color: 'positive',
      icon: 'check_circle',
      timeout: 1000,
    })
  })
}

async function deleteYahooFinanceKey() {
  const yahooAPIkey = ''

  await updateDoc(doc(db, 'users', storeAuth.user.id), {
    'apiKeys.yahooFinanceRapidApiKey': yahooAPIkey,
  })

  // notify that form saving was done succesfully
  $q.notify({
    message: 'Yahoo finance API key deleted from database',
    color: 'positive',
    icon: 'check_circle',
    timeout: 1000,
  })
}

// ------------------------ Crypto API Keys -------------------------
async function saveCryptoKey() {
  const cryptoKey = {
    apiKey: cryptoRapidApiKey.value,
    path: 'apiKeys.CoinrankingRapidApiKey',
  }
  const saveApiKeys = httpsCallable(functions, 'saveApiKeys')
  saveApiKeys(cryptoKey).then((result) => {
    console.log(result)

    // notify that form saving was done succesfully
    $q.notify({
      message: 'Yahoo finance API key addded to database',
      color: 'positive',
      icon: 'check_circle',
      timeout: 1000,
    })
  })
}

async function deleteCrytpoKey() {
  const cryptoKey = ''

  await updateDoc(doc(db, 'users', storeAuth.user.id), {
    'apiKeys.CoinrankingRapidApiKey': cryptoKey,
  })

  // notify that form saving was done succesfully
  $q.notify({
    message: 'Crypto API key deleted from database',
    color: 'positive',
    icon: 'check_circle',
    timeout: 1000,
  })
}

//  ------------------------ update preferences ----------------------------
const updateYahooFinanceModel = ref(userSettings.updateApiPreferences.yahooFinance || '')
const updateCoinRankingModel = ref(userSettings.updateApiPreferences.coinRanking || '')

async function rapidApiUpdatePreferences() {
  await updateDoc(doc(db, 'users', storeAuth.user.id), {
    updateApiPreferences: {
      yahooFinance: updateYahooFinanceModel.value,
      coinRanking: updateCoinRankingModel.value,
    },
  })

  // notify that form saving was done succesfully
  $q.notify({
    message: 'update Api preferences saved correctly',
    color: 'positive',
    icon: 'check_circle',
    timeout: 1000,
  })
}

watch([updateYahooFinanceModel, updateCoinRankingModel], (newValue) => {
  rapidApiUpdatePreferences()
})
</script>

<!------------------------------------------------------------------------------------------------------->
<!-------------------------------------------- STYLE ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<style scoped></style>
