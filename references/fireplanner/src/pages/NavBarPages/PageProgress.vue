<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------ TEMPLATE --------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<template>
  <q-page class="flex">
    <div class="q-mt-md fit">
      <q-tabs v-model="tab" inline-label no-caps align="center">
        <q-tab name="keyProgress" icon="key" label="Key Progress" />
        <q-tab name="savings" icon="savings" label="Savings" />
        <q-tab name="investments" icon="timeline" label="Investments" />
      </q-tabs>

      <!----------------------------------------- Key Progress TAB ---------------------------------------------------->
      <div class="q-pa-md q-mt-md" v-if="tab === 'keyProgress'">
        <h5 v-if="planListLenght === 0">Please, save a plan first</h5>

        <keyProgress v-else />
      </div>

      <!----------------------------------------- Savings TAB ---------------------------------------------------->
      <div class="q-pa-md q-mt-md" v-if="tab === 'savings'">
        <h5 v-if="planListLenght === 0">Please, save a plan first</h5>

        <SavingsComponent v-else />
      </div>

      <!--------------------------------------- Investments TAB ------------------------------------------------->
      <div class="q-pa-md q-mt-md" v-if="tab === 'investments'">
        <div v-if="planListLenght === 0">
          <h5>Please, save a plan first</h5>
          <h6>
            Remember that you need rapidApi keys to use this section, add them in the "user
            settings" section
          </h6>
        </div>

        <InvestmentsMainComponent v-else />
      </div>
    </div>
  </q-page>
</template>

<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------- SCRIPT ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<script setup>
import { ref } from 'vue'
import { storeToRefs } from 'pinia'

// import components
import keyProgress from 'src/components/ComponentsNavProgress/TabKeyProgress/KeyProgress.vue'
import SavingsComponent from 'src/components/ComponentsNavProgress/TabSavings/SavingsComponent.vue'
import InvestmentsMainComponent from 'src/components/ComponentsNavProgress/TabInvestments/InvestmentsMainComponent.vue'

// import and declare stores
import { useStoreUserSettings } from 'src/stores/storeUserSettings'
import { useStorePlanData } from 'src/stores/storePlanData'
const storeUserSettings = useStoreUserSettings()
const storePlanData = useStorePlanData()

// import reactive data from stores
const { planList } = storeToRefs(storePlanData)
const { userSettings } = storeToRefs(storeUserSettings)

const planListLenght = planList.value.length
// const plan = userSettings.value.plan
const tabInitialValue = userSettings.value.navigationNames.progress

// to change the tab view
const tab = ref(tabInitialValue)
</script>

<!------------------------------------------------------------------------------------------------------->
<!-------------------------------------------- STYLE ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<style scoped></style>
