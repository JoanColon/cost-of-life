<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------ TEMPLATE --------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<template>
  <q-page class="flex">
    <div class="q-mt-md fit">
      <q-tabs v-model="tab" inline-label no-caps align="center">
        <q-tab name="FinancialIndicators" icon="key" label="Key Metrics" />
        <q-tab name="Plan" icon="fork_right" label="Plan" />
        <q-tab name="Simulate" icon="query_stats" label="Simulate" />
      </q-tabs>

      <!----------------------------------------- Key Metrics TAB ---------------------------------------------------->
      <div class="q-pa-md q-mt-md" v-if="tab === 'FinancialIndicators'">
        <FormKeyMetrics />
      </div>

      <!--------------------------------------- Financial Planner TAB ------------------------------------------------->
      <div class="q-pa-md q-mt-md" v-else-if="tab === 'Plan'">
        <!-- if plan is available, show PlanDisplayComponent, else, show FormPlanQuestonaire -->
        <PlanDisplayComponent v-if="plan === 'plan'" />

        <FormPlanQuestionaire v-else-if="plan === 'noPlan'" />

        <h5 v-else>Please, save "Key Metrics" data first</h5>
      </div>

      <!---------------------------------------------- Simulation TAB ---------------------------------------------------->
      <div class="q-pa-md q-mt-md" v-else>
        <h5 v-if="planListLenght === 0">Please, save a plan first</h5>

        <SimulateComponent v-else />
      </div>
    </div>
  </q-page>
</template>

<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------- SCRIPT ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<script setup>
import { ref, computed } from 'vue'

// import components
// import FormKeyMetrics from 'src/components/ComponentsNavPlanner/FormKeyMetrics.vue'
import FormKeyMetrics from 'src/components/ComponentsNavPlanner/FormKeyMetrics.vue'
import FormPlanQuestionaire from 'src/components/ComponentsNavPlanner/FormPlanQuestionaire.vue'
import PlanDisplayComponent from 'src/components/ComponentsNavPlanner/PlanDisplayComponent.vue'
import SimulateComponent from 'src/components/ComponentsNavPlanner/SimulateComponent.vue'

// import and declare stores
import { useStoreUserSettings } from 'src/stores/storeUserSettings'
import { useStorePlanData } from 'src/stores/storePlanData'
import { storeToRefs } from 'pinia'
const storeUserSettings = useStoreUserSettings()
const storePlanData = useStorePlanData()

// get store data
const { userSettings } = storeToRefs(storeUserSettings)
const tabInitialValue = userSettings.value.navigationNames.planner

// to change the tab view
const tab = ref(tabInitialValue)

// to get reactive data froma a store use a computed value
const plan = computed(() => storeUserSettings.userSettings.plan)
const planList = computed(() => storePlanData.planList)
const planListLenght = planList.value.length
</script>

<!------------------------------------------------------------------------------------------------------->
<!-------------------------------------------- STYLE ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<style scoped></style>
