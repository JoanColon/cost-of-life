<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------ TEMPLATE --------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<template>
  <div style="max-width: 1000px; margin: auto">
    <!------------------------------------------------ chart ---------------------------------------------->
    <div
      class="q-mb-sm q-mt-none q-py-xs shadow-1 white-container"
      style="display: block; width: 100%"
    >
      <p class="q-mb-none q-mt-sm q-pb-none" style="text-align: center; font-size: 16px">
        <strong>Your savings allocation</strong>
      </p>

      <GChart type="ColumnChart" :data="savingsChart[0]" :options="savingsChart[1]" />

      <div
        class="q-pa-none q-mt-sm"
        style="display: flex; justify-content: space-evenly; width: 95%"
      >
        <q-radio
          v-model="chartPeriod"
          val="sinceInception"
          label="Since inception"
          color="orange"
        />
        <q-radio v-model="chartPeriod" val="yearToDate" label="Year to date" color="orange" />
      </div>
    </div>

    <!---------------------------------------------- results information ---------------------------------------->
    <div
      class="q-mb-sm q-mt-none q-py-xs shadow-1 white-container"
      style="display: block; width: 100%"
    >
      <p class="q-mb-none q-mt-sm q-pb-none" style="text-align: center; font-size: 16px">
        <strong>Savings information</strong>
      </p>

      <!-- since inception results -->
      <div v-if="chartPeriod === 'sinceInception'">
        <p class="q-mx-sm q-mt-sm">
          Since {{ savingsInformation.initYear }} (period of
          {{ savingsInformation.totalYears }} years), you have saved
          <strong>{{ savingsInformation.totalSavings }}</strong
          >. The savings have been allocated as follows:
        </p>

        <q-list dense v-for="element in savingsInformation.savingsCategoryList" :key="element.id">
          <q-item v-if="element.amount != 0">
            <q-item-section avatar>
              <q-icon color="orange" name="task_alt" />
            </q-item-section>

            <q-item-section>
              <p>
                <strong>{{ element.amountString }}</strong> in {{ element.category.label }}
              </p>
            </q-item-section>
          </q-item>
        </q-list>
      </div>

      <!-- year to date results -->
      <div v-else>
        <p class="q-mx-sm q-mt-sm">
          This year you have saved <strong>{{ savingsInformation.totalSavings }}</strong> which is
          <strong>{{ savingsInformation.currentSavingsRateString }}%</strong> of your annual target
          (<strong>{{ annualSavingsTargetstring }}</strong
          >). The savings have been allocated as follows:
        </p>

        <q-list dense v-for="element in savingsInformation.savingsCategoryList" :key="element.id">
          <q-item v-if="element.amount != 0">
            <q-item-section avatar>
              <q-icon color="orange" name="task_alt" />
            </q-item-section>

            <q-item-section>
              <p>
                <strong>{{ element.amountString }}</strong> in {{ element.category.label }}
              </p>
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
<script setup>
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import _groupBy from 'lodash/groupBy'
import * as math from 'mathjs'
import { GChart } from 'vue-google-charts'

// import and declare stores
import { useStoreUserSettings } from 'src/stores/storeUserSettings'
import { useStoreSavings } from 'src/stores/storeSavings'
import { useStoreKeyMetrics } from 'src/stores/storeKeyMetrics'
const storeSavings = useStoreSavings()
const storeUserSettings = useStoreUserSettings()
const storeKeyMetrics = useStoreKeyMetrics()

// get reactive data from stores
const { userSettings } = storeToRefs(storeUserSettings)
const { currencyString } = storeToRefs(storeUserSettings)
const { keyMetricsDict } = storeToRefs(storeKeyMetrics)

// stores variables
const savingsList = computed(() => storeSavings.getSavingsList)
const currency = userSettings.value.currency
const currencySymbol = currencyString.value
const annualSavingsTarget = keyMetricsDict.value.savingsDict.annualSavingsRate
const annualSavingsTargetstring = annualSavingsTarget.toLocaleString('en-US', {
  style: 'currency',
  currency,
  maximumFractionDigits: 0,
})

// radio buttons variables
const chartPeriod = ref('sinceInception')

// ----------------------------------------- CHART DATA ------------------------------------------------------

const savingsChart = computed(() => {
  // -------------------------------- data for SINCE INCEPTION CHART -----------------------------------------
  const savingChoicesFullList = [
    'Brokerage account (e.g., stocks, etf, funds)',
    'Real estate (income property)',
    'Fixed-income (e.g., bonds, CDs, prefeered shares)',
    'Cryptoassets (e.g., cryptocurrencies, nft)',
    'Cash/savings',
    'Business equity',
    'Others (e.g., gold, jewelry, art)',
  ]

  // STEP 1. Create the main array to be filled for plotting the chart
  const savingsChartData = [
    [
      'Year',
      { label: 'Brokerage account', type: 'number' },
      { label: 'Real estate', type: 'number' },
      { label: 'Fixed-income', type: 'number' },
      { label: 'Cryptoassets', type: 'number' },
      { label: 'Cash/savings', type: 'number' },
      { label: 'Business equity', type: 'number' },
      { label: 'Others', type: 'number' },
    ],
  ]

  // STEP 2. Adds a new array containg only the year in which the savings where added
  const savingsListAddedYear = savingsList.value.map((item) => {
    const newDate = new Date(item.date)
    const year = newDate.getFullYear()
    item.year = year
    return item
  })

  // STEP 3. Group saving entries by year and push each year into to savingsChartData as a new array to later on add the savings data.
  // fill saving choices wiht 0
  const groupedYears = _groupBy(savingsListAddedYear, 'year')
  const yearList = Object.keys(groupedYears)
  yearList.forEach((year) => savingsChartData.push([year, 0, 0, 0, 0, 0, 0, 0]))

  // STEP 4. Group savings in each year (from yearList array) by savingCategory (e.g., real estate, brokerage account, finxed-income)
  const savingsFinalList = []
  for (let i = 0; i < yearList.length; i++) {
    const year = yearList[i]
    const yearEntries = groupedYears[yearList[i]]
    const groupedYearsSavingsChoice = _groupBy(yearEntries, 'savingsChoice')
    const obj = {}
    obj[year] = groupedYearsSavingsChoice
    savingsFinalList.push(obj)
  }

  // STEP 5. Fill array with final data grouped by year and category
  for (let i = 0; i < savingsFinalList.length; i++) {
    const year = Object.keys(savingsFinalList[i])[0] // string with year
    // console.log('working on year:', year)
    const yearKeys = Object.keys(savingsFinalList[i][year]) // array with all savingChoices for the year
    yearKeys.forEach((key) => {
      const valueToGroup = savingsFinalList[i][year][key]
      const data = valueToGroup
        .map((x) => x.savingsAmount)
        .reduce((accumulator, currentValue) => accumulator + currentValue)
      // console.log(valueToGroup)
      for (let j = 0; j < savingChoicesFullList.length; j++) {
        if (key === 'Brokerage account (e.g., stocks, etf, funds)') {
          savingsChartData[i + 1].splice(1, 1, data) // replace 1 element at index 1 with "data"
        }
        if (key === 'Real estate (income property)') {
          savingsChartData[i + 1].splice(2, 1, data) // replace 1 element at index 2 with "data"
        }
        if (key === 'Fixed-income (e.g., bonds, CDs, prefeered shares)') {
          savingsChartData[i + 1].splice(3, 1, data) // replace 1 element at index 3 with "data"
        }
        if (key === 'Cryptoassets (e.g., cryptocurrencies, nft)') {
          savingsChartData[i + 1].splice(4, 1, data) // replace 1 element at index 4 with "data"
        }
        if (key === 'Cash/savings') {
          savingsChartData[i + 1].splice(5, 1, data) // replace 1 element at index 5 with "data"
        }
        if (key === 'Business equity') {
          savingsChartData[i + 1].splice(6, 1, data) // replace 1 element at index 6 with "data"
        }
        if (key === 'Others (e.g., gold, jewelry, art)') {
          savingsChartData[i + 1].splice(7, 1, data) // replace 1 element at index 7 with "data"
        }
      }
    })
  }

  // -------------------------------- data for YEAR TO DATE CHART -----------------------------------------
  if (yearList.length === 0 && Object.keys(groupedYears).length === 0) {
    // if no data is available to plot the savings chart
    const lastYearSavingsChartData = [
      [
        'Date',
        { label: 'Brokerage account', type: 'number' },
        { label: 'Real estate', type: 'number' },
        { label: 'Fixed-income', type: 'number' },
        { label: 'Cryptoassets', type: 'number' },
        { label: 'Cash/savings', type: 'number' },
        { label: 'Business equity', type: 'number' },
        { label: 'Others', type: 'number' },
      ],
    ]

    const savingChartOptions = {
      legend: { position: 'bottom' },
      seriesType: 'bars',
      isStacked: true,
      vAxis: {
        title: `Savings allocation (${currencySymbol}/year)`,
      },
      chartArea: {
        left: 80,
        right: 80,
        top: 15,
      },
      height: 300,
    }

    if (chartPeriod.value === 'sinceInception') {
      return [savingsChartData, savingChartOptions]
    } else {
      return [lastYearSavingsChartData, savingChartOptions]
    }
  } else {
    // if data is available to plot a savings chart
    // STEP 1. Get savings from last available year (yearList & groupedYears comes from previous calculations)
    const lastYear = math.max(yearList.map((x) => parseInt(x)))
    const savingsLastYear = groupedYears[lastYear]

    // STEP 2. Create the main array to be filled for plotting the chart
    const lastYearSavingsChartData = [
      [
        'Date',
        { label: 'Brokerage account', type: 'number' },
        { label: 'Real estate', type: 'number' },
        { label: 'Fixed-income', type: 'number' },
        { label: 'Cryptoassets', type: 'number' },
        { label: 'Cash/savings', type: 'number' },
        { label: 'Business equity', type: 'number' },
        { label: 'Others', type: 'number' },
      ],
    ]

    // STEP 3. fill savingsChartData with the arrays containing the date and all savings with 0
    for (let i = 0; i < savingsLastYear.length; i++) {
      const newArray = []
      const dateString = savingsLastYear[i].date
      const date = new Date(dateString)
      newArray.push(date, 0, 0, 0, 0, 0, 0, 0)
      lastYearSavingsChartData.push(newArray)
    }

    // STEP 4. Fill array with final data (one entry per saving date)
    for (let i = 0; i < lastYearSavingsChartData.length - 1; i++) {
      const key = savingsLastYear[i].savingsChoice
      const data = savingsLastYear[i].savingsAmount

      if (key === 'Brokerage account (e.g., stocks, etf, funds)') {
        lastYearSavingsChartData[i + 1].splice(1, 1, data) // replace 1 element at index 1 with "data"
      }
      if (key === 'Real estate (income property)') {
        lastYearSavingsChartData[i + 1].splice(2, 1, data) // replace 1 element at index 2 with "data"
      }
      if (key === 'Fixed-income (e.g., bonds, CDs, prefeered shares)') {
        lastYearSavingsChartData[i + 1].splice(3, 1, data) // replace 1 element at index 3 with "data"
      }
      if (key === 'Cryptoassets (e.g., cryptocurrencies, nft)') {
        lastYearSavingsChartData[i + 1].splice(4, 1, data) // replace 1 element at index 4 with "data"
      }
      if (key === 'Cash/savings') {
        lastYearSavingsChartData[i + 1].splice(5, 1, data) // replace 1 element at index 5 with "data"
      }
      if (key === 'Business equity') {
        lastYearSavingsChartData[i + 1].splice(6, 1, data) // replace 1 element at index 6 with "data"
      }
      if (key === 'Others (e.g., gold, jewelry, art)') {
        lastYearSavingsChartData[i + 1].splice(7, 1, data) // replace 1 element at index 7 with "data"
      }
    }

    const savingChartOptions = {
      legend: { position: 'bottom' },
      seriesType: 'bars',
      isStacked: true,
      vAxis: {
        title: `Savings allocation (${currencySymbol}/year)`,
      },
      chartArea: {
        left: 80,
        right: 80,
        top: 15,
      },
      height: 300,
    }

    if (chartPeriod.value === 'sinceInception') {
      return [savingsChartData, savingChartOptions]
    } else {
      return [lastYearSavingsChartData, savingChartOptions]
    }
  }
})

// -------------------------------------- SAVINGS INFORMATION SECTION --------------------------------------------------
const savingsInformation = computed(() => {
  const data = savingsChart.value[0]

  // Years
  const years = []
  for (let i = 1; i < data.length; i++) {
    const year = parseInt(data[i][0])
    years.push(year)
  }

  const initYear = years[0]
  const lastYear = years.slice(-1)[0] // slice(-1) return an array containing the last element of the previous array, to get only the number we need the [0], first position of an array with only one element
  const totalYears = lastYear - initYear + 1

  // total Savings
  const totalSavingsList = []
  for (let i = 1; i < data.length; i++) {
    const newArray = data[i].map((x) => x) // shift modifies the initial array, thus it is necessary to make a copy with map to not modify the initial array
    // eslint-disable-next-line no-unused-vars
    const shifted = newArray.shift() // removes first element of array (in that case the "year/date string"), shifted is the removed element
    const totalYear = newArray.reduce((accumulator, currentValue) => accumulator + currentValue)
    totalSavingsList.push(totalYear)
  }

  const totalSavings = math.sum(totalSavingsList)
  const totalSavingsString = math
    .sum(totalSavingsList)
    .toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 0 })

  // savings per category
  const savingsCategoryList = []
  for (let i = 1; i < data[0].length; i++) {
    const obj = {}
    const yearData = []

    for (let j = 1; j < data.length; j++) {
      yearData.push(data[j][i])
    }

    const totalYearData = math.sum(yearData)
    obj.id = i
    obj.category = data[0][i]
    obj.amount = totalYearData
    obj.amountString = totalYearData.toLocaleString('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    })
    savingsCategoryList.push(obj)
  }

  // annual savings rate target
  const currentSavingsRate = (totalSavings / annualSavingsTarget) * 100
  const currentSavingsRateString = currentSavingsRate.toLocaleString('en-US', {
    maximumFractionDigits: 0,
  })

  // final Object
  const savingsInformation = {
    initYear,
    lastYear,
    totalYears,
    totalSavings: totalSavingsString,
    savingsCategoryList,
    currentSavingsRateString,
  }

  return savingsInformation
})
</script>

<!------------------------------------------------------------------------------------------------------->
<!-------------------------------------------- STYLE ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<style scoped></style>
