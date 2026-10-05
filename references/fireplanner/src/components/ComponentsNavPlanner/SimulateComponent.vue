<!-- eslint-disable object-shorthand -->
<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------ TEMPLATE --------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<template>
  <div style="max-width: 1000px; margin: auto">
    <!-------------------------------------------- Chart data section ---------------------------------------------------------->
    <div
      class="q-mb-sm q-mt-none q-py-xs shadow-1 white-container"
      style="display: block; width: 100%"
    >
      <!----------------------------------------------- CHART ------------------------------------------------------------------->
      <div class="q-mr-sm">
        <p class="q-mb-none q-pb-none" style="text-align: center; font-size: 16px">
          Simulation of <strong>"{{ planName }}"</strong>
        </p>

        <GChart type="LineChart" :data="chartData[0]" :options="chartData[2]" />
      </div>

      <div style="width: 95%">
        <!----------------------------------------------- RADIO BUTTONS ------------------------------------------------------->
        <div class="q-pa-none q-mt-sm" style="display: flex; justify-content: space-evenly">
          <q-radio v-model="radioBtn" color="orange" val="totalResults" label="Total" />
          <q-radio
            v-model="radioBtn"
            color="orange"
            val="disaggregatedResults"
            label="Disaggregated"
          />
        </div>

        <!------------------------------------------------ YERS SLIDER --------------------------------------------------------------->
        <q-item class="q-pa-none q-mt-none q-ml-xs">
          <q-item-section avatar> Number of years: </q-item-section>

          <q-item-section>
            <q-slider v-model="sliderYears" :min="0" :max="30" color="orange" label />
          </q-item-section>
        </q-item>
      </div>
    </div>

    <!-------------------------------------------- RESULTS and PARAMETERS section ----------------------------------------------->
    <div
      class="q-mb-sm q-mt-none q-py-xs shadow-1 white-container"
      style="display: block; width: 100%"
    >
      <!---------------------------------------------------- TABS ---------------------------------------------------------------->
      <div class="q-pa-none">
        <q-tabs dense v-model="tab" inline-label no-caps align="center">
          <q-tab name="results" icon="" label="Results"></q-tab>
          <q-tab name="parameters" icon="" label="Parameters"></q-tab>
        </q-tabs>
      </div>

      <!---------------------------------------- RESULTS section ------------------------------------------------------------->
      <div class="q-pa-xs q-mt-xs" v-if="tab === 'results'">
        <q-list>
          <!-- General results -->
          <q-item dense>
            <q-item-section avatar
              ><q-avatar namme="done" icon="price_check"></q-avatar
            ></q-item-section>
            <q-item-section style="font-size: 16px"
              ><p>
                Your inflation adjusted investments at year {{ sliderYears }} will be
                <strong>{{ simulatedResults.finalInvestmentAmount || 0 }}</strong>
              </p></q-item-section
            >
          </q-item>

          <!-- Fire numbers -->
          <div v-if="plannerGoal === 'F.I.R.E'">
            <q-item dense v-for="(e, i) in simulatedResults.filteredFireNumbers.length" :key="i">
              <q-item-section avatar
                ><q-avatar namme="done" icon="calendar_month"></q-avatar
              ></q-item-section>
              <q-item-section style="font-size: 16px"
                ><p>
                  You will achieve {{ simulatedResults.filteredFireNumbers[i].label }} (>{{
                    simulatedResults.filteredFireNumbers[i].amount.toLocaleString('en-US', {
                      style: 'currency',
                      currency: currency,
                      maximumFractionDigits: 0,
                    })
                  }}) in <strong>{{ simulatedResults.fireYears[i] }} years</strong>
                </p></q-item-section
              >
            </q-item>

            <q-item v-if="fireNumberCheckOwn === true" dense>
              <q-item-section avatar
                ><q-avatar namme="done" icon="calendar_month"></q-avatar
              ></q-item-section>
              <q-item-section style="font-size: 16px"
                ><p>
                  You will achieve your F.I.R.E number (>{{
                    simulatedResults.fireUserDefinedNumber.toLocaleString('en-US', {
                      style: 'currency',
                      currency: currency,
                      maximumFractionDigits: 0,
                    })
                  }}) in <strong>{{ simulatedResults.userFireYears }} years</strong>
                </p></q-item-section
              >
            </q-item>
          </div>

          <!-- Wealth numbers -->
          <div v-if="plannerGoal === 'Wealthier'">
            <q-item dense v-for="(e, i) in simulatedResults.filteredWealthNumbers.length" :key="i">
              <q-item-section avatar
                ><q-avatar namme="done" icon="calendar_month"></q-avatar
              ></q-item-section>
              <q-item-section style="font-size: 16px"
                ><p>
                  You will achieve x8.5 times your current income (>€{{
                    simulatedResults.filteredWealthNumbers[i].amount.toLocaleString('en-US', {
                      style: 'currency',
                      currency: currency,
                      maximumFractionDigits: 0,
                    })
                  }}) in <strong>{{ simulatedResults.fireYears[i] }} years</strong>
                </p></q-item-section
              >
            </q-item>

            <q-item v-if="wealthNumberCheckOwn === true" dense>
              <q-item-section avatar
                ><q-avatar namme="done" icon="calendar_month"></q-avatar
              ></q-item-section>
              <q-item-section style="font-size: 16px"
                ><p>
                  You will achieve your "wealthier" number (>€{{
                    simulatedResults.wealthUserDefinedNumber.toLocaleString('en-US', {
                      style: 'currency',
                      currency: currency,
                      maximumFractionDigits: 0,
                    })
                  }}) in <strong>{{ simulatedResults.userWealthYears }} years</strong>
                </p></q-item-section
              >
            </q-item>
          </div>

          <!-- General results -->
          <q-item dense>
            <q-item-section avatar
              ><q-avatar namme="done" icon="payments"></q-avatar
            ></q-item-section>
            <q-item-section style="font-size: 16px"
              ><p>
                Your total inflation adjusted benefits will be
                <strong>{{ simulatedResults.totalBenefits || 0 }}</strong>
              </p></q-item-section
            >
          </q-item>

          <q-item dense>
            <q-item-section avatar
              ><q-avatar namme="done" icon="savings"></q-avatar
            ></q-item-section>
            <q-item-section style="font-size: 16px"
              ><p>
                Your current investment is
                <strong>{{ simulatedResults.initialInvestmentAmount || 0 }}</strong>
              </p></q-item-section
            >
          </q-item>

          <q-item dense>
            <q-item-section avatar
              ><q-avatar namme="done" icon="savings"></q-avatar
            ></q-item-section>
            <q-item-section style="font-size: 16px"
              ><p>
                During {{ sliderYears }} years, you will invest a total of
                <strong>{{ simulatedResults.totalInvested || 0 }}</strong>
              </p></q-item-section
            >
          </q-item>
        </q-list>
      </div>

      <!---------------------------------------- PARAMETERS section ------------------------------------------------------------->
      <div class="q-pa-xs q-mt-none" v-if="tab === 'parameters'">
        <p class="q-mt-xs q-ml-xs">
          You have distributed
          <strong
            >{{
              totalAllocated.toLocaleString('en-US', {
                style: 'currency',
                currency: currency,
                maximumFractionDigits: 0,
              })
            }}/year </strong
          >({{ (totalAllocated / annualSavings) * 100 }}%) from a total savings of
          <strong
            >{{
              annualSavings.toLocaleString('en-US', {
                style: 'currency',
                currency: currency,
                maximumFractionDigits: 0,
              })
            }}/year</strong
          >
        </p>

        <q-list dense style="width: 95%">
          <!-- savings allocation -->
          <q-item v-for="item in filterAllocation" :key="item.id">
            <!-- knob -->
            <q-item-section style="max-width: 50px">
              <q-knob
                show-value
                font-size="12px"
                v-model="item.knobValue"
                :min="0"
                size="50px"
                :thickness="0.22"
                color="orange"
                track-color="grey-3"
                class="q-mt-xs q-mb-xs"
              >
                {{ item.knobValue }}%
              </q-knob>
            </q-item-section>

            <!-- add/substract buttons -->
            <q-item-section class="q-mr-lg" style="max-width: 6px">
              <q-btn
                outline
                round
                color="black"
                icon="add"
                size="6px"
                class="q-mb-sm"
                @click="item.knobValue++"
              />
              <q-btn
                outline
                round
                color="black"
                icon="remove"
                size="6px"
                @click="item.knobValue--"
              />
            </q-item-section>

            <!-- label -->
            <q-item-section>
              <q-item-label style="font-size: 14px">
                {{ item.label
                }}<strong>{{
                  ((annualSavings * item.knobValue) / 100).toLocaleString('en-US', {
                    style: 'currency',
                    currency: currency,
                    maximumFractionDigits: 0,
                  }) + '/year'
                }}</strong>
              </q-item-label>

              <q-item-label caption>
                <q-slider
                  v-model="item.rateReturn"
                  :min="0"
                  :max="0.2"
                  :step="0.001"
                  :label-value="
                    'Rate of return: ' + (item.rateReturn * 100).toLocaleString('en-US') + '%'
                  "
                  color="orange"
                  label
                />
              </q-item-label>
            </q-item-section>

            <!-- edit button -->
            <q-item-section style="max-width: 10px">
              <q-btn icon="edit" flat align="right"> </q-btn>
            </q-item-section>
          </q-item>
        </q-list>

        <q-checkbox v-model="showZerosCheck" color="orange" label="Show zeros" />
      </div>
    </div>

    <!------------------------------ buttons to reset parameters or create parameters from scratch ------------------------------>
    <!-- <div class="q-mb-sm q-mt-none q-py-xs shadow-1 white-container" style="display:flex; width: 100%; justify-content: space-between">
    <q-btn
      class="q-ma-sm"
      flat
      padding="none"
      no-caps
      style="color:#14213D; margin-left: auto; margin-right: auto"
    >
      Reset initial values
    </q-btn>

    <q-btn
      class="q-ma-sm"
      flat
      padding="none"
      no-caps
      style="color:#14213D; margin-left: auto; margin-right: auto"
    >
      Enter Initial values
    </q-btn>
  </div> -->
  </div>
</template>

<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------- SCRIPT ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<script setup>
import { ref, reactive, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { GChart } from 'vue-google-charts'
import * as math from 'mathjs'

// import and declare stores
import { useStoreUserSettings } from 'src/stores/storeUserSettings'
import { useStoreKeyMetrics } from 'src/stores/storeKeyMetrics'
import { useStoreNetWorth } from 'src/stores/storeNetWorth'
import { useStorePlanData } from 'src/stores/storePlanData'
const storeUserSettings = useStoreUserSettings()
const storeKeyMetrics = useStoreKeyMetrics()
const storeNetWorth = useStoreNetWorth()
const storePlanData = useStorePlanData()

// get reactive data from stores
const { userSettings } = storeToRefs(storeUserSettings)
const { currencyString } = storeToRefs(storeUserSettings)
const { keyMetricsDict } = storeToRefs(storeKeyMetrics)
const { netWorthDict } = storeToRefs(storeNetWorth)
const { planDataDict } = storeToRefs(storePlanData)

// stores variables
const currency = userSettings.value.currency
const currencySymbol = currencyString.value
const annualSavings = keyMetricsDict.value.savingsDict.annualSavingsRate
const fireNumberCheckOwn = planDataDict.value.fireNumberDict.fireNumberCheckOwn
const wealthNumberCheckOwn = planDataDict.value.wealthNumberDict.wealthNumberCheckOwn
const plannerGoal = planDataDict.value.plannerGoalDict.goalSelection
const planName = planDataDict.value.planName
const cashAllocation = planDataDict.value.allocatedFundsDict.cashAllocationList
const investmentAllocation = planDataDict.value.allocatedFundsDict.investmentAllocationList
const fireAutomaticNumberList = planDataDict.value.fireNumberDict.fireAutomaticNumberList
const fireNumberCheck = planDataDict.value.fireNumberDict.fireNumberCheck
const fireUserDefinedNumber = planDataDict.value.fireNumberDict.fireUserDefinedNumber
const wealthAutomaticNumberList = planDataDict.value.wealthNumberDict.wealthAutomaticNumberList
const wealthNumberCheck = planDataDict.value.wealthNumberDict.wealthNumberCheck
const wealthUserDefinedNumber = planDataDict.value.wealthNumberDict.wealthUserDefinedNumber

// const from store variables (cashAllocation and investmentAllocation)
const AllocationList = cashAllocation.concat(investmentAllocation)
const AssetsList = reactive(JSON.parse(JSON.stringify(AllocationList))) // to deep clone an array without references (not changing the original array)

// general reactive data
const tab = ref('results') // to change the tab view
const radioBtn = ref('totalResults') // to change the chart view
const showZerosCheck = ref(false) // to change the chart view
const sliderYears = ref(10)

// -------------------------------- CHART DATA ----------------------------------------------------------------
const chartData = computed(() => {
  // STEP 1. Get initial investement data (will be located at year 0)
  const initialInvestment = [
    { 'Cash accounts': netWorthDict.value.netWorthDataDict.assets[5].amount },
    { 'Big purchases': 0 },
    { 'Stock market': netWorthDict.value.netWorthDataDict.assets[2].amount },
    { 'Real estate': netWorthDict.value.netWorthDataDict.assets[1].amount },
    { 'Fixed income': netWorthDict.value.netWorthDataDict.assets[3].amount },
    { 'Crypto assets': netWorthDict.value.netWorthDataDict.assets[4].amount },
    { 'Business equity': netWorthDict.value.netWorthDataDict.assets[6].amount },
    { 'Other investments': netWorthDict.value.netWorthDataDict.assets[7].amount },
  ]

  // STEP 2. Main array that will contain the disagregated chart data - returned when disagregated radioBtn is active
  const disagregatedReturnsChartData = [['Year']]

  // STPE 3. Push as many arrays as needed into disagregatedReturnsChartData array with as many arrays as years in sliderYears.value
  for (let i = 0; i < sliderYears.value + 1; i++) {
    disagregatedReturnsChartData.push([i])
  }

  // STEP 4. Populate each yearly array with the cumulated returns of each initial investment category
  for (let i = 0; i < AssetsList.length; i++) {
    // push keys of initialInvestment array
    const initKeys = Object.keys(initialInvestment[i])[0]
    disagregatedReturnsChartData[0].push(initKeys)

    // push values of initialInvestment array (investment value at year 0)
    let initValue = Object.values(initialInvestment[i])[0]
    disagregatedReturnsChartData[1].push(initValue)

    // populate the remaining years (from year 1 to sliderYear)
    for (let j = 1; j < sliderYears.value + 1; j++) {
      const initYear = initValue + annualSavings * (AssetsList[i].knobValue / 100)
      const finalYear = initYear + initYear * AssetsList[i].rateReturn

      disagregatedReturnsChartData[j + 1].push(finalYear)
      initValue = finalYear
    }
  }

  // STEP 5. main array that will contain chart data - returned when Total radioBtn is active
  // sum all the disagregatedReturnsChartData to generated a chart with only one data series
  const totalReturnsChartData = [['Year', 'Total value']]
  for (let i = 1; i < disagregatedReturnsChartData.length; i++) {
    const newValue = disagregatedReturnsChartData[i].reduce(
      (previousValue, currentValue) => previousValue + currentValue,
    )
    totalReturnsChartData.push([i - 1, newValue - i + 1])
  }

  // Chart options
  const simulateChartOptions = reactive({
    legend: { position: 'bottom' },
    chartArea: {
      left: 70,
      right: 20,
      top: 15,
    },
    vAxis: {
      title: `investment value (${currencySymbol})`,
    },
    width: '80%',
  })

  // returned chartData results, totalREturnsChartData is always returned as is needed in the Computed Result section
  if (radioBtn.value === 'totalResults') {
    return [totalReturnsChartData, totalReturnsChartData, simulateChartOptions]
  } else {
    return [disagregatedReturnsChartData, totalReturnsChartData, simulateChartOptions]
  }
})

// ----------------------------- PARAMETERS section (filter zero allcoation of savings) ---------------------------------------------
const filterAllocation = computed(() => {
  if (showZerosCheck.value === false) {
    const filterAllocation = AssetsList.filter((allocation) => allocation.knobValue !== 0)
    return filterAllocation
  } else {
    const filterAllocation = AssetsList
    return filterAllocation
  }
})

// ---------------------------------------- total allocated funds ------------------------------------------------------
const totalAllocated = computed(() => {
  const totalAllocated = math.sum(
    AssetsList.map((element) => (element.knobValue / 100) * annualSavings),
  )
  return totalAllocated
})

// -------------------------------------- RESULTS section ---------------------------------------------------
const simulatedResults = computed(() => {
  const chartDataComputed = chartData.value[1] // data from previous computed section

  const initialInvestmentAmount = chartDataComputed[1][1].toLocaleString('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })

  const finalInvestmentArray = chartDataComputed.slice(-1) // get last element of array
  const finalInvestmentAmount = finalInvestmentArray[0][1].toLocaleString('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })

  const totalInvested = (totalAllocated.value * sliderYears.value).toLocaleString('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })

  const totalBenefits = (
    finalInvestmentArray[0][1] -
    (totalAllocated.value * sliderYears.value + chartDataComputed[1][1])
  ).toLocaleString('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })

  // years to achive automatic F.I.R.E
  const filteredFireNumbers = fireAutomaticNumberList.filter((fireNumber) =>
    fireNumberCheck.includes(fireNumber.label),
  )

  const fireYears = []

  for (let x = 0; x < filteredFireNumbers.length; x++) {
    let i = 1
    let neededYears = 0
    try {
      while (filteredFireNumbers[x].amount > chartDataComputed[i][1]) {
        i = i + 1
        neededYears += 1
      }
    } catch (e) {
      neededYears = 'NaN'
    }

    fireYears.push(neededYears)
  }

  // years to achive user defined F.I.R.E
  let userFireYears = 0

  if (fireNumberCheckOwn === true) {
    let i = 1
    try {
      while (fireUserDefinedNumber > chartDataComputed[i][1]) {
        i = i + 1
        userFireYears += 1
      }
    } catch (e) {
      userFireYears = 'NaN'
    }
  }

  // years to achive automatic wealthier
  const filteredWealthNumbers = wealthAutomaticNumberList.filter((wealthNumber) =>
    wealthNumberCheck.includes(wealthNumber.label),
  )

  const wealthYears = []

  for (let x = 0; x < filteredWealthNumbers.length; x++) {
    let i = 1
    let neededYears = 0
    try {
      while (filteredWealthNumbers[x].amount > chartDataComputed[i][1]) {
        i = i + 1
        neededYears += 1
      }
    } catch (e) {
      neededYears = 'NaN'
    }

    wealthYears.push(neededYears)
  }

  // years to achive user defined wealthier
  let userWealthYears = 0

  if (wealthNumberCheckOwn === true) {
    let i = 1
    try {
      while (wealthUserDefinedNumber > chartDataComputed[i][1]) {
        i = i + 1
        userWealthYears += 1
      }
    } catch (e) {
      userWealthYears = 'NaN'
    }
  }

  // returned resuts
  const simulatedResults = {
    initialInvestmentAmount,
    finalInvestmentAmount,
    totalInvested,
    totalBenefits,
    filteredFireNumbers,
    fireYears,
    fireUserDefinedNumber,
    userFireYears,
    filteredWealthNumbers,
    wealthYears,
    wealthUserDefinedNumber,
    userWealthYears,
  }

  return simulatedResults
})
</script>

<!------------------------------------------------------------------------------------------------------->
<!-------------------------------------------- STYLE ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<style scoped></style>
