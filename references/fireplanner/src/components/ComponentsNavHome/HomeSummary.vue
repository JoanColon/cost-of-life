<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------ TEMPLATE --------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<template>
  <div style="max-width: 1000px; width: 95%; margin: auto">
    <!---------------------------------------- Planner Summary --------------------------------------------->
    <div class="shadow-1 white-container" style="width: 100%; display: block">
      <p
        class="q-mb-mc q-mt-sm q-pt-md q-pb-none text-h5 text-weight-bold"
        style="text-align: center"
      >
        Your summary
      </p>

      <!-- desktop only -->
      <div v-if="$q.screen.width > 450" class="cardList">
        <div class="row">
          <cardSummary class="q-my-sm q-pr-lg" :card-summary-data="propsKeyMetrics" />
          <cardSummary class="q-my-sm" :card-summary-data="propsSavings" />
        </div>
        <div class="row q-mb-md">
          <cardSummary class="q-my-sm q-pr-lg" :card-summary-data="propsInvestmentSummary" />
          <cardSummary class="q-my-sm" :card-summary-data="propsGoals" />
        </div>
      </div>

      <!-- mobile only -->
      <div v-else style="width: 85%; margin: auto">
        <q-carousel v-model="slide" swipeable animated control-color="orange" navigation>
          <q-carousel-slide name="keyMetrics" class="column no-wrap flex-center">
            <q-separator inset />
            <cardSummary :card-summary-data="propsKeyMetrics" />
            <q-separator inset />
          </q-carousel-slide>

          <q-carousel-slide name="savings" class="column no-wrap flex-center">
            <cardSummary :card-summary-data="propsSavings" />
          </q-carousel-slide>

          <q-carousel-slide name="investments" class="column no-wrap flex-center">
            <cardSummary :card-summary-data="propsInvestmentSummary" />
          </q-carousel-slide>

          <q-carousel-slide name="goals" class="column no-wrap flex-center">
            <cardSummary :card-summary-data="propsGoals" />
          </q-carousel-slide>
        </q-carousel>
      </div>
    </div>
  </div>
</template>

<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------- SCRIPT ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<script setup>
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import cardSummary from 'src/components/ComponentsNavHome/cardSummary.vue'
import { storeToRefs } from 'pinia'

// import and declare stores
import { useStoreUserSettings } from 'src/stores/storeUserSettings'
import { useStoreNetWorth } from 'src/stores/storeNetWorth'
import { useStoreKeyMetrics } from 'src/stores/storeKeyMetrics'
import { useStorePlanData } from 'src/stores/storePlanData'
import { useStoreSavings } from 'src/stores/storeSavings'
import { useStoreInvestments } from 'src/stores/storeInvestments'

const storeNetWorth = useStoreNetWorth()
const storeKeyMetrics = useStoreKeyMetrics()
const storePlanData = useStorePlanData()
const storeSavings = useStoreSavings()
const storeUserSettings = useStoreUserSettings()
const storeInvestments = useStoreInvestments()

// get reactive data from stores
const { netWorthDict } = storeToRefs(storeNetWorth)
const { keyMetricsDict } = storeToRefs(storeKeyMetrics)
const { planDataDict } = storeToRefs(storePlanData)
const { getBrokerageData } = storeToRefs(storeInvestments)
const { userSettings } = storeToRefs(storeUserSettings)

// stores variables
const currency = userSettings.value.currency

// props for key metrics
const propsKeyMetrics = computed(() => {
  try {
    const netWorthValue = netWorthDict.value.netWorthDataDict.totalNetWorth
    const incomeValue = keyMetricsDict.value.incomeDict.totalIncome
    const expensesValue = keyMetricsDict.value.expensesDict.totalExpenses.regularExpenses
    const cardBody = `
      <ul>
        <li><strong>Networh</strong>: ${netWorthValue.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 1 })}</li>
        <li><strong>Income</strong>: ${incomeValue.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 1 })}/year</li>
        <li><strong>Expenses</strong>: ${expensesValue.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 1 })}/year</li>
      </ul>`

    const cardInfo = {
      title: 'Key metrics',
      cardBody,
      view: '/progress',
      image: 'myAssets/keyMetricsSummary.jpeg',
      tab: 'keyProgress',
    }
    return cardInfo
  } catch {
    const cardInfo = {
      title: 'Key metrics',
      cardBody: 'no data available',
      view: '/progress',
      image: 'myAssets/keyMetricsSummary.jpeg',
      tab: 'keyProgress',
    }
    return cardInfo
  }
})

// props for savings
const propsSavings = computed(() => {
  try {
    const savingsTarget = keyMetricsDict.value.savingsDict.annualSavingsRate
    const savingsYearly = storeSavings.savingsSummaryResults.yearlySavings
    const savingsAchieved = savingsYearly / savingsTarget
    const totalSavings = storeSavings.savingsSummaryResults.totalSavings
    const cardBody = `
      <ul>
        <li><strong>Annual target</strong>: ${savingsTarget.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 1 })} </li>
        <li><strong>Yearly savings</strong>: ${savingsYearly.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 1 })} (${savingsAchieved.toLocaleString('en-US', { style: 'percent', maximumFractionDigits: 1 })} achieved)</li>
        <li><strong>Since inception</strong>: ${totalSavings.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 1 })}</li>
      </ul>`

    const cardInfo = {
      title: 'Savings',
      cardBody,
      view: '/progress',
      image: 'myAssets/savingsSummary.jpeg',
      tab: 'savings',
    }

    return cardInfo
  } catch {
    const cardInfo = {
      title: 'Savings',
      cardBody: 'no data available',
      view: '/progress',
      image: 'myAssets/savingsSummary.jpeg',
      tab: 'savings',
    }

    return cardInfo
  }
})

// props for goals
const propsGoals = computed(() => {
  try {
    // basic card data
    const planData = planDataDict.value
    const goalSelection = planData.plannerGoalDict.goalSelection
    const fireSelected = planData.fireNumberDict.fireNumberCheck
    const fireOwnSelected = planData.fireNumberDict.fireNumberCheckOwn
    const fireNumberList = planData.fireNumberDict.fireAutomaticNumberList
    const wealthNumber = planData.wealthNumberDict.wealthAutomaticNumberList[0].amount
    const wealthOwnSelected = planData.wealthNumberDict.wealthNumberCheckOwn
    const wealthNumberOwn = planData.wealthNumberDict.wealthUserDefinedNumber

    // data to get the percentage of achivement
    const detailInvestmentData = getBrokerageData.value[1]
    const objectKeys = Object.keys(detailInvestmentData)

    const totalMarketValue = objectKeys
      .map((element) => {
        return detailInvestmentData[element].portofolioMarketValue
      })
      .reduce((acc, cur) => acc + cur, 0)

    const selectedGoalList = []
    switch (goalSelection) {
      case 'F.I.R.E':
        fireNumberList.forEach((element) => {
          fireSelected.forEach((selection) => {
            if (selection === element.label) {
              const percentageAchieved = totalMarketValue / element.amount
              const selectedGoal = `<li><strong>${element.label}</strong> ${element.amount.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 1 })} (${percentageAchieved.toLocaleString('en-US', { style: 'percent', maximumFractionDigits: 1 })} achieved)</li>`
              selectedGoalList.push(selectedGoal)
            }
          })
        })

        if (fireOwnSelected === true) {
          const percentageAchieved =
            totalMarketValue / planData.fireNumberDict.fireUserDefinedNumber
          const selectedOwnGoal = `<li><strong>Your own number</strong>: ${planData.fireNumberDict.fireUserDefinedNumber.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 1 })} (${percentageAchieved.toLocaleString('en-US', { style: 'percent', maximumFractionDigits: 1 })} achieved)</li>`
          selectedGoalList.push(selectedOwnGoal)
        }
        break
      case 'Wealthier':
        selectedGoalList.push(
          `<li><strong>Your wealth number: </strong>${wealthNumber.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 1 })} (${(totalMarketValue / wealthNumber).toLocaleString('en-US', { style: 'percent', maximumFractionDigits: 1 })} achieved)</li>`,
        )

        if (wealthOwnSelected === true) {
          const percentageAchieved = totalMarketValue / wealthNumberOwn
          const selectedOwnGoal = `<li><strong>Your  own wealth number</strong>: ${wealthNumberOwn.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 1 })} (${percentageAchieved.toLocaleString('en-US', { style: 'percent', maximumFractionDigits: 1 })} achieved)</li>`
          selectedGoalList.push(selectedOwnGoal)
        }

        break
    }
    const cardInfo = {
      title: 'Financial goals',
      cardBody: `<ul>
        ${selectedGoalList.join('')}
      </ul>`,
      view: '/planner',
      image: 'myAssets/roadMapSummary.jpeg',
      tab: 'simulation',
    }

    return cardInfo
  } catch {
    const cardInfo = {
      title: 'Financial goals',
      cardBody: 'no data available',
      view: '/planner',
      image: 'myAssets/roadMapSummary.jpeg',
      tab: 'simulation',
    }
    return cardInfo
  }
})

// props for Investment Summary Card
const propsInvestmentSummary = computed(() => {
  try {
    const detailInvestmentData = getBrokerageData.value[1]
    const taxRate = userSettings.value.taxRate
    const objectKeys = Object.keys(detailInvestmentData)

    const totalMarketValue = objectKeys
      .map((element) => {
        return detailInvestmentData[element].portofolioMarketValue
      })
      .reduce((acc, cur) => acc + cur, 0)

    const totalMarketIncome = objectKeys
      .map((element) => {
        return detailInvestmentData[element].AnnualExpectedIncome
      })
      .reduce((acc, cur) => acc + cur, 0)

    const cardBody = `
      <ul>
        <li><strong>Market value</strong>: ${totalMarketValue.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 1 })}</li>
        <li><strong>Gross passive income</strong>: ${totalMarketIncome.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 1 })}/year</li>
        <li><strong>Net passive income</strong>: ${(totalMarketIncome * (1 - taxRate)).toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 1 })}/year</li>
      </ul>`

    const cardInfo = {
      title: 'Investments',
      cardBody,
      view: '/progress',
      image: 'myAssets/investmentSummary.jpeg',
      tab: 'investments',
    }

    return cardInfo
  } catch {
    const cardInfo = {
      title: 'Investments',
      cardBody: 'No data available',
      view: '/progress',
      image: 'myAssets/investmentSummary.jpeg',
      tab: 'investments',
    }

    return cardInfo
  }
})

const $q = useQuasar()

const slide = ref('keyMetrics')
</script>

<!------------------------------------------------------------------------------------------------------->
<!-------------------------------------------- STYLE ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<style scoped>
.cardList {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-evenly;
}
</style>
