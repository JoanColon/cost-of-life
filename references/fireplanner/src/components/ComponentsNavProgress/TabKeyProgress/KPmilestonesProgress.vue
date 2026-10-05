<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------ TEMPLATE --------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<template>
  <div style="max-width: 1000px; margin: auto">
    <div
      class="q-mb-sm q-mt-none q-py-xs shadow-1 white-container"
      style="display: block; width: 100%"
    >
      <p class="q-mb-none q-mt-sm q-pb-none" style="text-align: center; font-size: 16px">
        <strong>Milestones achivements</strong>
      </p>

      <q-list>
        <q-item v-for="milestone in milestonesList" :key="milestone.id">
          <q-item-section avatar>
            <q-rating
              v-model="milestone.rating"
              max="5"
              size="1.5em"
              color="orange"
              icon="star_border"
              icon-selected="star"
              icon-half="star_half"
              no-dimming
              readonly
            >
            </q-rating>
          </q-item-section>

          <q-item-section>
            <q-item-label>{{ milestone.label }}</q-item-label>
            <q-item-label caption>{{ milestone.caption }}</q-item-label>
          </q-item-section>

          <q-item-section avatar>
            <q-btn
              flat
              color="orange"
              icon="info_outlined"
              size="md"
              @click="((milestoneDialog = true), (milestoneDialogText = milestone.moreInfo))"
            />
          </q-item-section>
        </q-item>
      </q-list>

      <q-dialog v-model="milestoneDialog">
        <q-card>
          <q-card-section>
            <div class="text-h6">More info...</div>
          </q-card-section>

          <q-card-section class="q-pt-none">
            <p>{{ milestoneDialogText }}</p>
          </q-card-section>

          <q-card-actions align="right">
            <q-btn flat label="OK" color="black" v-close-popup />
          </q-card-actions>
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
import * as math from 'mathjs'

// import and declare stores
import { useStoreUserSettings } from 'src/stores/storeUserSettings'
import { useStoreKeyMetrics } from 'src/stores/storeKeyMetrics'
import { useStoreNetWorth } from 'src/stores/storeNetWorth'
import { useStorePlanData } from 'src/stores/storePlanData'
const storeUserSettings = useStoreUserSettings()
const storeKeyMetrics = useStoreKeyMetrics()
const storePlanData = useStorePlanData()
const storeNetWorth = useStoreNetWorth()

// import reactive data from stores
const { userSettings } = storeToRefs(storeUserSettings)
const { keyMetricsDict } = storeToRefs(storeKeyMetrics)
const { netWorthDict } = storeToRefs(storeNetWorth)
const { planDataDict } = storeToRefs(storePlanData)

// stores variables
const allNetWorthList = storeNetWorth.getAllNetWorthList // getter from the store
const allKeyMetricsList = storeKeyMetrics.getAllKeyMetricsList // getter from the store
const planSelection = planDataDict.value.plannerGoalDict.goalSelection
const currency = userSettings.value.currency

// open dialog
const milestoneDialog = ref(false)
const milestoneDialogText = ref('')

const milestonesList = computed(() => {
  if (planSelection === 'F.I.R.E') {
    const milestoneList = planDataDict.value.fireMilestonesDict.automaticMilestonesList
    const fireNumberDict = planDataDict.value.fireNumberDict
    const keyMetricsList = allKeyMetricsList
    const lastKeyMetrics = keyMetricsDict.value
    const selectedFireMilestones = planDataDict.value.fireMilestonesDict.selectedMilestonesList

    // FIRE milestone loop
    for (let i = 0; i < milestoneList.length; i++) {
      switch (milestoneList[i].id) {
        // nethworth milestone
        case 'fmlNetZeroWorth': {
          const networthList = allNetWorthList.map((nw) => nw.netWorthDict.totalNetWorth)
          const minNetworth = math.min(networthList) // returns minimum number (higher debt value in array)
          const currentNetworth = networthList[0] // returns the last current networth
          const currentNetworthString = currentNetworth.toLocaleString('en-US', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
          })

          if (minNetworth >= 0) {
            milestoneList[i].rating = 5
            milestoneList[i].moreInfo =
              `Your networth is positive!! You are worth ${currentNetworthString}.`
          } else {
            const networth10th = minNetworth / 10
            const rating = 10 - currentNetworth / networth10th
            milestoneList[i].rating = rating
            milestoneList[i].moreInfo =
              `Your networth is still less than 0, keep working!! You are worth ${currentNetworthString}.`
          }
          break
        }
        // zero debt milestoe
        case 'fmlZeroDebt': {
          const totalLiabilitiesList = []

          const liabilitiesList = allNetWorthList.map((nw) => nw.netWorthDict.liabilities)
          for (let i = 0; i < liabilitiesList.length; i++) {
            const annualLiabilities = liabilitiesList[i]
              .map((item) => item.amount)
              .reduce((previousValue, currentValue) => previousValue + currentValue)
            totalLiabilitiesList.push(annualLiabilities)
          }

          const maxLiability = math.max(totalLiabilitiesList)
          const maxLiabilityString = maxLiability.toLocaleString('en-US', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
          })
          const currentLiabilities = totalLiabilitiesList[0] // returns the first current liability (last element in array)
          const currentLiabilitiesString = currentLiabilities.toLocaleString('en-US', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
          })

          if (maxLiability <= 0) {
            milestoneList[i].rating = 5
            milestoneList[i].moreInfo = "You don't have any debt!! Congratulations!!"
          } else {
            const liabilities10th = maxLiability / 10
            const rating = 10 - currentLiabilities / liabilities10th
            milestoneList[i].rating = rating
            milestoneList[i].moreInfo =
              `Your maxium debt was ${maxLiabilityString}, right know your debt is ${currentLiabilitiesString}.`
          }
          break
        }
        // emergency fund 6 months milestone
        case 'fmlEmergyFund6m': {
          const currentEmergencyFund6m = netWorthDict.value.netWorthDataDict.assets[5].amount
          const currentEmergencyFund6mString = currentEmergencyFund6m.toLocaleString('en-US', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
          })
          const basicExpenses = lastKeyMetrics.expensesDict.totalExpenses.basicExpenses
          const regularExpenses = lastKeyMetrics.expensesDict.totalExpenses.regularExpenses
          const regularExpenses6m = lastKeyMetrics.expensesDict.totalExpenses.regularExpenses / 2
          const ratioToRegularExpenses = (currentEmergencyFund6m * 5) / regularExpenses6m
          const basicRatio = (currentEmergencyFund6m / basicExpenses) * 100
          const basicRatioString = basicRatio.toLocaleString('en-US', { maximumFractionDigits: 0 })
          const regularRatio = (currentEmergencyFund6m / regularExpenses) * 100
          const regularRatioString = regularRatio.toLocaleString('en-US', {
            maximumFractionDigits: 0,
          })

          if (currentEmergencyFund6m >= regularExpenses6m) {
            milestoneList[i].rating = 5
            milestoneList[i].moreInfo =
              `Your emergency fund (cash/savings) is worth ${currentEmergencyFund6mString} and covers
            ${basicRatioString}% of your basic expenses and ${regularRatioString}% of your regular expenses.`
          } else {
            milestoneList[i].rating = ratioToRegularExpenses
            milestoneList[i].moreInfo =
              `At this moment, your emergency fund (cash/savings) is worth ${currentEmergencyFund6mString}
              and only covers ${basicRatioString}% of your basic annual expenses and ${regularRatioString}% of
              your regular annual expenses. To be on the safe side, you should try to increase it.`
          }
          break
        }
        // emergency fund 1 year milestone
        case 'fmlEmergyFund1y': {
          const currentEmergencyFund = netWorthDict.value.netWorthDataDict.assets[5].amount
          const currentEmergencyFundString = currentEmergencyFund.toLocaleString('en-US', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
          })
          const basicExpenses = lastKeyMetrics.expensesDict.totalExpenses.basicExpenses
          const regularExpenses = lastKeyMetrics.expensesDict.totalExpenses.regularExpenses
          const ratioToRegularExpenses = (currentEmergencyFund * 5) / regularExpenses
          const basicRatio = (currentEmergencyFund / basicExpenses) * 100
          const basicRatioString = basicRatio.toLocaleString('en-US', { maximumFractionDigits: 0 })
          const regularRatio = (currentEmergencyFund / regularExpenses) * 100
          const regularRatioString = regularRatio.toLocaleString('en-US', {
            maximumFractionDigits: 0,
          })

          if (currentEmergencyFund >= regularExpenses) {
            milestoneList[i].rating = 5
            milestoneList[i].moreInfo =
              `Your emergency fund (cash/savings) is worth ${currentEmergencyFundString} and covers
              ${basicRatioString}% of your basic expenses and ${regularRatioString}% of your regular expenses. MILESTONE ACHIEVED!!`
          } else {
            milestoneList[i].rating = ratioToRegularExpenses
            milestoneList[i].moreInfo =
              `At this moment, your emergency fund (cash/savings) is worth ${currentEmergencyFundString}
              and only covers ${basicRatioString}% of your basic annual expenses and ${regularRatioString}% of
              your regular annual expenses. To be on the safe side, you should try to increase it.`
          }
          break
        }
        // utiliyt bills milestone
        case 'fmlUtilityBills': {
          const passiveIncomeList = lastKeyMetrics.incomeDict.passiveIncome
          const utilitiesList = lastKeyMetrics.expensesDict.utilities
          const passiveIncome = passiveIncomeList
            .map((item) => item.amount)
            .reduce((previousValue, currentValue) => previousValue + currentValue)
          const passiveIncomeString = passiveIncome.toLocaleString('en-US', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
          })
          const utilityBills = utilitiesList
            .map((item) => item.amount)
            .reduce((previousValue, currentValue) => previousValue + currentValue)
          const coverageRatio = passiveIncome / utilityBills
          const coverageRatioString = coverageRatio.toLocaleString('en-US', {
            maximumFractionDigits: 1,
          })

          if (passiveIncome >= utilityBills) {
            milestoneList[i].rating = 5
            milestoneList[i].moreInfo =
              `Your passive income is ${passiveIncomeString} and covers ${coverageRatioString} times your annual utility bills`
          } else {
            milestoneList[i].rating = (passiveIncome * 5) / utilityBills
            milestoneList[i].moreInfo =
              `Your passive income is €${passiveIncomeString} and only covers ${coverageRatioString} times your annual utility bills`
          }
          break
        }
        // mortage milestone
        case 'fmlMortage': {
          const passiveIncomeList = lastKeyMetrics.incomeDict.passiveIncome
          const mortage = lastKeyMetrics.expensesDict.housing[0].amount

          const passiveIncome = passiveIncomeList
            .map((item) => item.amount)
            .reduce((previousValue, currentValue) => previousValue + currentValue)
          const passiveIncomeString = passiveIncome.toLocaleString('en-US', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
          })
          const coverageRatio = passiveIncome / mortage
          const coverageRatioString = coverageRatio.toLocaleString('en-US', {
            maximumFractionDigits: 1,
          })

          if (passiveIncome >= mortage) {
            milestoneList[i].rating = 5
            milestoneList[i].moreInfo =
              `Your passive income is ${passiveIncomeString} and covers ${coverageRatioString} times your annual mortage`
          } else {
            milestoneList[i].rating = (passiveIncome * 5) / mortage
            milestoneList[i].moreInfo =
              `Your passive income is ${passiveIncomeString} and only covers ${coverageRatioString} times your annual mortage`
          }
          break
        }
        // networth milestone
        case 'fml100k': {
          // const currentNetworth = lastKeyMetrics.netWorthDict.totalNetWorth
          const currentNetworth = netWorthDict.value.netWorthDataDict.totalNetWorth
          const currentNetworthString = currentNetworth.toLocaleString('en-US', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
          })

          if (currentNetworth >= 100000) {
            milestoneList[i].rating = 5
            milestoneList[i].moreInfo =
              `You are worth ${currentNetworthString}. You are crushing it, congratulations!!`
          } else {
            const networth10th = 100000 / 10
            const rating = 10 - currentNetworth / networth10th
            milestoneList[i].rating = rating
            milestoneList[i].moreInfo =
              `Your networth is still less than 100K, keep working on it!! You are worth ${currentNetworthString}.`
          }
          break
        }
        // lean FIRE milestone
        case 'fmlLeanFire': {
          const totalInvestmentList = netWorthDict.value.netWorthDataDict.assets
          const leanFireNumber = fireNumberDict.fireAutomaticNumberList[0].amount
          const leanFireNumberString = leanFireNumber.toLocaleString('en-US', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
          })
          const totalInvestmentsArray = []

          for (let i = 1; i < totalInvestmentList.length; i++) {
            totalInvestmentsArray.push(totalInvestmentList[i].amount)
          }

          const totalInvestments = totalInvestmentsArray.reduce(
            (initialValue, currentValue) => initialValue + currentValue,
          )
          const totalInvestmentsString = totalInvestments.toLocaleString('en-US', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
          })

          if (totalInvestments >= leanFireNumber) {
            milestoneList[i].rating = 5
            milestoneList[i].moreInfo =
              `Congratulations, you did it, you have achieved Lean F.I.R.E! Your investments (assets without considering your house) are worth
              ${totalInvestmentsString} which, according to the 4% rule, is more than your "Lean F.I.R.E number (${leanFireNumberString})".`
          } else {
            const rating = (totalInvestments * 5) / leanFireNumber
            const ratio = (totalInvestments * 100) / leanFireNumber
            const ratioString = ratio.toLocaleString('en-US', { maximumFractionDigits: 1 })
            milestoneList[i].rating = rating
            milestoneList[i].moreInfo =
              `Your investments (assets without considering your house) are worth ${totalInvestmentsString}
              which, according to the 4% rule, is only ${ratioString}% of your "Lean F.I.R.E number (${leanFireNumberString})".`
          }
          break
        }
        // regular FIRE milestone
        case 'fmlRegularFire': {
          const totalInvestmentList = netWorthDict.value.netWorthDataDict.assets
          const regularFireNumber = fireNumberDict.fireAutomaticNumberList[1].amount
          const regularFireNumberString = regularFireNumber.toLocaleString('en-US', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
          })
          const totalInvestmentsArray = []

          for (let i = 1; i < totalInvestmentList.length; i++) {
            totalInvestmentsArray.push(totalInvestmentList[i].amount)
          }

          const totalInvestments = totalInvestmentsArray.reduce(
            (initialValue, currentValue) => initialValue + currentValue,
          )
          const totalInvestmentsString = totalInvestments.toLocaleString('en-US', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
          })

          if (totalInvestments >= regularFireNumber) {
            milestoneList[i].rating = 5
            milestoneList[i].moreInfo =
              `Congratulations, you did it, you have achieved Regular F.I.R.E! Your investments (assets without considering your house) are worth
              ${totalInvestmentsString} which, according to the 4% rule, is more than your "Regular F.I.R.E number (${regularFireNumberString})".`
          } else {
            const rating = (totalInvestments * 5) / regularFireNumber
            const ratio = (totalInvestments * 100) / regularFireNumber
            const ratioString = ratio.toLocaleString('en-US', { maximumFractionDigits: 1 })
            milestoneList[i].rating = rating
            milestoneList[i].moreInfo =
              `Your investments (assets without considering your house) are worth ${totalInvestmentsString}
              which, according to the 4% rule, is only ${ratioString}% of your "Regular F.I.R.E number (${regularFireNumberString})".`
          }
          break
        }
        // fat FIRE milestone
        case 'fmlFatFire': {
          const totalInvestmentList = netWorthDict.value.netWorthDataDict.assets
          const fatFireNumber = fireNumberDict.fireAutomaticNumberList[2].amount
          const fatFireNumberString = fatFireNumber.toLocaleString('en-US', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
          })
          const totalInvestmentsArray = []

          for (let i = 1; i < totalInvestmentList.length; i++) {
            totalInvestmentsArray.push(totalInvestmentList[i].amount)
          }

          const totalInvestments = totalInvestmentsArray.reduce(
            (initialValue, currentValue) => initialValue + currentValue,
          )
          const totalInvestmentsString = totalInvestments.toLocaleString('en-US', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
          })

          if (totalInvestments >= fatFireNumber) {
            milestoneList[i].rating = 5
            milestoneList[i].moreInfo =
              `Congratulations, you did it, you have achieved Fat F.I.R.E! Your investments (assets without considering your house) are worth
            ${totalInvestmentsString} which, according to the 4% rule, is more than your "Fat F.I.R.E number (${fatFireNumberString})".`
          } else {
            const rating = (totalInvestments * 5) / fatFireNumber
            const ratio = (totalInvestments * 100) / fatFireNumber
            const ratioString = ratio.toLocaleString('en-US', { maximumFractionDigits: 1 })
            milestoneList[i].rating = rating
            milestoneList[i].moreInfo =
              `Your investments (assets without considering your house) are worth ${totalInvestmentsString}
              which, according to the 4% rule, is only ${ratioString}% of your "Fat F.I.R.E number (${fatFireNumberString})".`
          }
          break
        }
      }
    }

    // filter the total miloestone list according the user selected milestone list
    const filteredFireMilestones = milestoneList.filter((milestone) =>
      selectedFireMilestones.includes(milestone.label),
    )

    return filteredFireMilestones
  } else if (planSelection === 'Wealthier') {
    const milestoneList = planDataDict.value.wealthMilestonesDict.automaticMilestonesList
    const wealthNumberDict = planDataDict.value.wealthNumberDict
    const keyMetricsList = allKeyMetricsList
    const lastKeyMetrics = keyMetricsDict.value
    const currentSalary =
      lastKeyMetrics.incomeDict.activeIncome[0].amount +
      lastKeyMetrics.incomeDict.activeIncome[1].amount
    const selectedWealthMilestones = planDataDict.value.wealthMilestonesDict.selectedMilestonesList

    // calculate total investement, which is the value to compare with the milestones
    const totalInvestmentList = netWorthDict.value.netWorthDataDict.assets
    const totalInvestmentsArray = []
    for (let i = 1; i < totalInvestmentList.length; i++) {
      totalInvestmentsArray.push(totalInvestmentList[i].amount)
    }

    const totalInvestments = totalInvestmentsArray.reduce(
      (initialValue, currentValue) => initialValue + currentValue,
    )
    const totalInvestmentsString = totalInvestments.toLocaleString('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    })

    // values to be used in most loops
    const x = totalInvestments / currentSalary
    const xString = x.toLocaleString('en-US', { maximumFractionDigits: 1 })
    const moreInfoPositive = `Your assets (investments/savings excluding your home) are worth ${totalInvestmentsString}. Milestone achieved, keep saving! `
    const moreInfoNegative = `Your assets (investments/savings excluding your home) are worth ${totalInvestmentsString} which is ${xString}x your active salary. Keep saving! `

    // Foor loop to evaluate wealthier milestones
    for (let i = 0; i < milestoneList.length; i++) {
      switch (milestoneList[i].id) {
        // nethworth milestone
        case 'wmlNetZeroWorth': {
          const networthList = allNetWorthList.map((nw) => nw.netWorthDict.totalNetWorth)
          const minNetworth = math.min(networthList) // returns minimum number (higher debt value in array)

          const currentNetworth = networthList.slice(-1)[0] // returns the last current networth (last element in array)
          const currentNetworthString = currentNetworth.toLocaleString('en-US', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
          })

          if (minNetworth >= 0) {
            milestoneList[i].rating = 5
            milestoneList[i].moreInfo =
              `Your networth is positive!! You are worth ${currentNetworthString}.`
          } else {
            const networth10th = minNetworth / 10
            const rating = 10 - currentNetworth / networth10th
            milestoneList[i].rating = rating
            milestoneList[i].moreInfo =
              `Your networth is still less than 0, keep working!! You are worth ${currentNetworthString}.`
          }
          break
        }
        // zero debt milestoe
        case 'wmlZeroDebt': {
          const totalLiabilitiesList = []

          const liabilitiesList = allNetWorthList.map((nw) => nw.netWorthDict.liabilities)
          for (let i = 0; i < liabilitiesList.length; i++) {
            const annualLiabilities = liabilitiesList[i]
              .map((item) => item.amount)
              .reduce((previousValue, currentValue) => previousValue + currentValue)
            totalLiabilitiesList.push(annualLiabilities)
          }

          const maxLiability = math.max(totalLiabilitiesList)
          const maxLiabilityString = maxLiability.toLocaleString('en-US', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
          })
          const currentLiabilities = totalLiabilitiesList.slice(-1)[0] // returns the last current liability (last element in array)
          const currentLiabilitiesString = currentLiabilities.toLocaleString('en-US', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
          })

          if (maxLiability <= 0) {
            milestoneList[i].rating = 5
            milestoneList[i].moreInfo = "You don't have any debt!! Congratulations!!"
          } else {
            const liabilities10th = maxLiability / 10
            const rating = 10 - currentLiabilities / liabilities10th
            milestoneList[i].rating = rating
            milestoneList[i].moreInfo =
              `Your maxium debt was ${maxLiabilityString}, right know your debt is ${currentLiabilitiesString}.`
          }
          break
        }
        // case 0.1x
        case 'wmlSavingsForRetirement0.1x': {
          if (totalInvestments > 0.1 * currentSalary) {
            milestoneList[i].rating = 5
            milestoneList[i].moreInfo = moreInfoPositive
          } else {
            const ratio = (totalInvestments * 5) / (currentSalary * 0.1)
            milestoneList[i].rating = ratio
            milestoneList[i].moreInfo = moreInfoNegative
          }
          break
        }
        // case 0.7x
        case 'wmlSavingsForRetirement0.7x': {
          if (totalInvestments > 0.7 * currentSalary) {
            milestoneList[i].rating = 5
            milestoneList[i].moreInfo = moreInfoPositive
          } else {
            const ratio = (totalInvestments * 5) / (currentSalary * 0.7)
            milestoneList[i].rating = ratio
            milestoneList[i].moreInfo = moreInfoNegative
          }
          break
        }
        // case 1.4x
        case 'wmlSavingsForRetirement1.4x': {
          if (totalInvestments > 1.4 * currentSalary) {
            milestoneList[i].rating = 5
            milestoneList[i].moreInfo = moreInfoPositive
          } else {
            const ratio = (totalInvestments * 5) / (currentSalary * 1.4)
            milestoneList[i].rating = ratio
            milestoneList[i].moreInfo = moreInfoNegative
          }
          break
        }
        // case 2.2x
        case 'wmlSavingsForRetirement2.2x': {
          if (totalInvestments > 2.2 * currentSalary) {
            milestoneList[i].rating = 5
            milestoneList[i].moreInfo = moreInfoPositive
          } else {
            const ratio = (totalInvestments * 5) / (currentSalary * 2.2)
            milestoneList[i].rating = ratio
            milestoneList[i].moreInfo = moreInfoNegative
          }
          break
        }
        // case 3.1x
        case 'wmlSavingsForRetirement3.1x': {
          if (totalInvestments > 3.1 * currentSalary) {
            milestoneList[i].rating = 5
            milestoneList[i].moreInfo = moreInfoPositive
          } else {
            const ratio = (totalInvestments * 5) / (currentSalary * 3.1)
            milestoneList[i].rating = ratio
            milestoneList[i].moreInfo = moreInfoNegative
          }
          break
        }
        // case 4.2x
        case 'wmlSavingsForRetirement4.2x': {
          if (totalInvestments > 4.2 * currentSalary) {
            milestoneList[i].rating = 5
            milestoneList[i].moreInfo = moreInfoPositive
          } else {
            const ratio = (totalInvestments * 5) / (currentSalary * 4.2)
            milestoneList[i].rating = ratio
            milestoneList[i].moreInfo = moreInfoNegative
          }
          break
        }
        // case 5.4x
        case 'wmlSavingsForRetirement5.4x': {
          if (totalInvestments > 5.4 * currentSalary) {
            milestoneList[i].rating = 5
            milestoneList[i].moreInfo = moreInfoPositive
          } else {
            const ratio = (totalInvestments * 5) / (currentSalary * 5.4)
            milestoneList[i].rating = ratio
            milestoneList[i].moreInfo = moreInfoNegative
          }
          break
        }
        // case 6.8x
        case 'wmlSavingsForRetirement6.8x': {
          if (totalInvestments > 6.8 * currentSalary) {
            milestoneList[i].rating = 5
            milestoneList[i].moreInfo = moreInfoPositive
          } else {
            const ratio = (totalInvestments * 5) / (currentSalary * 6.8)
            milestoneList[i].rating = ratio
            milestoneList[i].moreInfo = moreInfoNegative
          }
          break
        }
        // case 8.2x
        case 'wmlSavingsForRetirement8.2x': {
          if (totalInvestments > 8.2 * currentSalary) {
            milestoneList[i].rating = 5
            milestoneList[i].moreInfo = moreInfoPositive
          } else {
            const ratio = (totalInvestments * 5) / (currentSalary * 8.2)
            milestoneList[i].rating = ratio
            milestoneList[i].moreInfo = moreInfoNegative
          }
          break
        }
      }
    }

    // filter the total miloestone list according the user selected milestone list
    const filteredWealthMilestones = milestoneList.filter((milestone) =>
      selectedWealthMilestones.includes(milestone.label),
    )

    return filteredWealthMilestones
  } else {
    return console.log('hey, there is an error somewhere')
  }
})
</script>

<!------------------------------------------------------------------------------------------------------->
<!-------------------------------------------- STYLE ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<style scoped></style>
