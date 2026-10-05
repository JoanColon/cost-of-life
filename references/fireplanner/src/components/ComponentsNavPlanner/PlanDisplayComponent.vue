<!-- eslint-disable prefer-const -->
<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------ TEMPLATE --------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<template>
  <div style="max-width: 1000px; margin: auto">
    <!----------------------------------- Goal section ------------------------------------------------------->
    <div
      class="q-mb-sm q-mt-none q-py-xs shadow-1 white-container"
      style="display: block; width: 100%"
    >
      <div class="q-ma-sm">
        <p class="q-mb-sm sub-title">Financial goal</p>
        <p class="q-my-xs q-ma-sm">
          Plan name: <strong>{{ planName }}</strong>
        </p>
        <p class="q-my-xs q-ma-sm">
          Your financial goal is: <strong>{{ plannerGoal }}</strong>
        </p>
        <p class="q-my-xs q-ma-sm">Goal description: {{ goalDescription }}</p>
      </div>
    </div>
    <!--------------------------------- Number section -------------------------------------------------------->
    <div class="q-mb-sm q-mt-none q-py-xs shadow-1 white-container" style="width: 100%">
      <div class="q-ma-sm">
        <p class="q-mb-none sub-title">Your numbers</p>

        <!-- FIRE section -->
        <q-list v-if="plannerGoal === 'F.I.R.E'">
          <q-item v-for="filteredFireNumber in filteredFireNumbers" :key="filteredFireNumber.id">
            <q-item-section>
              <q-item-label
                >{{ filteredFireNumber.label }}
                <strong>{{
                  filteredFireNumber.amount.toLocaleString('en-US', {
                    style: 'currency',
                    currency: currency,
                    maximumFractionDigits: 0,
                  })
                }}</strong></q-item-label
              >
              <q-item-label caption>{{ filteredFireNumber.caption }}</q-item-label>
            </q-item-section>
          </q-item>

          <q-item v-if="fireNumberCheckOwn === true">
            <q-item-section>
              <q-item-label
                >Your own F.I.R.E number:
                <strong>{{
                  fireUserDefinedNumber.toLocaleString('en-US', {
                    style: 'currency',
                    currency: currency,
                    maximumFractionDigits: 0,
                  })
                }}</strong></q-item-label
              >
              <q-item-label caption
                >Amount of money you need to pay for you existing lifestyle</q-item-label
              >
            </q-item-section>
          </q-item>
        </q-list>

        <!-- Wealth section -->
        <q-list v-if="plannerGoal === 'Wealthier'">
          <q-item
            v-for="filteredWealthNumber in filteredWealthNumbers"
            :key="filteredWealthNumber.id"
          >
            <q-item-section>
              <q-item-label
                >{{ filteredWealthNumber.label }}:
                <strong>{{
                  filteredWealthNumber.amount.toLocaleString('en-US', {
                    style: 'currency',
                    currency: currency,
                    maximumFractionDigits: 0,
                  })
                }}</strong></q-item-label
              >
              <q-item-label caption>{{ filteredWealthNumber.caption }}</q-item-label>
            </q-item-section>
          </q-item>

          <q-item v-if="wealthNumberCheckOwn === true">
            <q-item-section>
              <q-item-label
                >Your own wealth number:
                <strong>{{
                  wealthUserDefinedNumber.toLocaleString('en-US', {
                    style: 'currency',
                    currency: currency,
                    maximumFractionDigits: 0,
                  })
                }}</strong></q-item-label
              >
              <q-item-label caption>Amount of money you need to retire</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </div>
    </div>

    <!------------------------------------------------------ Milestones section ----------------------------------------------------->
    <div class="q-mb-sm q-mt-none q-py-xs shadow-1 white-container" style="width: 100%">
      <div class="q-ma-sm">
        <p class="q-ma-sm sub-title">Your milestones</p>
        <q-list v-if="plannerGoal === 'F.I.R.E'">
          <q-item v-for="milestone in filteredFireMilestones" :key="milestone.id">
            <q-item-section avatar>
              <q-checkbox
                v-model="selectedFireMilestones"
                :val="milestone.label"
                checked-icon="star"
                color="orange"
              />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ milestone.label }}</q-item-label>
              <q-item-label caption>{{ milestone.caption }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
        <q-list v-if="plannerGoal === 'Wealthier'">
          <q-item v-for="milestone in filteredWealthMilestones" :key="milestone.id">
            <q-item-section avatar>
              <q-checkbox
                v-model="selectedWealthMilestones"
                :val="milestone.label"
                checked-icon="star"
                color="orange"
              />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ milestone.label }}</q-item-label>
              <q-item-label caption>{{ milestone.caption }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </div>
    </div>
    <!---------------------------------------------- Allocation section -------------------------------------------------------------->
    <div class="q-mb-sm q-mt-none q-py-xs shadow-1 white-container" style="width: 100%">
      <div class="q-ma-sm">
        <p class="q-ma-sm sub-title">Your investments allocation</p>

        <p class="q-ma-sm">
          Your annual savings rate is
          <strong
            >{{
              annualSavings.toLocaleString('en-US', {
                style: 'currency',
                currency: currency,
                maximumFractionDigits: 0,
              })
            }}/year</strong
          >, the investment allocation will be as follows:
        </p>

        <q-list dense>
          <q-item v-for="item in filteredCashAllocation" :key="item.id">
            <!-- cash allocation -->
            <q-item-section avatar>
              <q-knob
                show-value
                font-size="12px"
                v-model="item.knobValue"
                size="50px"
                :thickness="0.22"
                color="orange"
                track-color="grey-3"
                disable
                class="q-mt-xs q-mb-xs"
              >
                {{ item.knobValue }} %
              </q-knob>
            </q-item-section>

            <q-item-section>
              <q-item-label style="font-size: 14px"
                >{{ item.label }}:
                <strong
                  >{{ ((annualSavings * item.knobValue) / 100).toLocaleString('en-US') || 0 }}
                </strong></q-item-label
              >
              <q-item-label caption>{{ item.caption }}</q-item-label>
            </q-item-section>
          </q-item>

          <!-- investment allocation -->
          <q-item v-for="item in filteredInvestmentAllocation" :key="item.id">
            <q-item-section avatar>
              <q-knob
                show-value
                font-size="12px"
                v-model="item.knobValue"
                size="50px"
                :thickness="0.22"
                color="orange"
                track-color="grey-3"
                disable
                class="q-mt-xs q-mb-xs"
              >
                {{ item.knobValue }} %
              </q-knob>
            </q-item-section>

            <q-item-section>
              <q-item-label style="font-size: 14px"
                >{{ item.label }}:
                <strong
                  >{{
                    ((annualSavings * item.knobValue) / 100).toLocaleString('en-US', {
                      style: 'currency',
                      currency: currency,
                      maximumFractionDigits: 0,
                    }) || 0
                  }}/year
                </strong></q-item-label
              >
              <q-item-label caption>{{ item.caption }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </div>
    </div>

    <!--------------------- Edit existing plan (redirect to FormPlan questionarie) or select new plan ------------------------------>
    <div
      class="q-mb-sm q-mt-none q-py-xs shadow-1 white-container"
      style="display: flex; width: 100%; justify-content: space-between"
    >
      <!-- edit plan -->
      <q-btn
        class="q-ma-sm"
        flat
        padding="none"
        no-caps
        style="color: orange; margin-left: auto; margin-right: auto"
        @click="editplan()"
      >
        Edit plan
      </q-btn>

      <!-- select plan -->
      <q-btn
        class="q-ma-sm"
        flat
        padding="none"
        no-caps
        style="color: #14213d; margin-left: auto; margin-right: auto"
        @click="selectPlan = true"
      >
        Select plan
      </q-btn>

      <q-dialog v-model="selectPlan">
        <q-card style="width: 500px; max-width: 80vw">
          <q-card-section class="row items-center q-pb-none">
            <div class="text-h6">Select a plan</div>
            <q-space />
            <q-btn icon="close" flat round dense v-close-popup />
          </q-card-section>

          <q-card-section class="q-mt-sm">
            <q-select
              rounded
              outlined
              v-model="selectPlanModel"
              :options="planOptions"
              label="Select a plan"
            />
          </q-card-section>

          <q-card-actions align="right">
            <q-btn
              flat
              label="OK"
              style="color: #14213d"
              v-close-popup
              @click="updateStorePlan()"
            />
          </q-card-actions>
        </q-card>
      </q-dialog>

      <!-- delete plan -->
      <q-btn
        class="q-ma-sm"
        flat
        padding="none"
        no-caps
        style="color: red; margin-left: auto; margin-right: auto"
        @click="deletePlan = true"
      >
        Delete plan
      </q-btn>

      <q-dialog v-model="deletePlan">
        <q-card style="width: 500px; max-width: 80vw">
          <q-card-section class="row items-center q-pb-none">
            <div class="text-h6"></div>
            <q-space />
            <q-btn icon="close" flat round dense v-close-popup />
          </q-card-section>

          <q-card-section align="center">
            <h6>
              Are you sure you want to delete the following plan:
              <strong> "{{ planName }}" </strong>
            </h6>
          </q-card-section>

          <q-card-actions align="right">
            <q-btn
              class="on-right"
              style="height: 75%"
              label="Delete plan"
              rounded
              color="red"
              no-caps
              @click="deleteStorePlan()"
              v-close-popup
            />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </div>
  </div>
</template>

<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------- SCRIPT ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
// eslint-disable-next-line no-unused-vars
<script setup>
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useQuasar } from 'quasar'
import { db } from 'src/js/firebase'
import { doc, updateDoc, deleteDoc } from 'firebase/firestore'

// import and declare stores
import { useStoreAuth } from 'src/stores/storeAuth'
import { useStoreUserSettings } from 'src/stores/storeUserSettings'
import { useStoreKeyMetrics } from 'src/stores/storeKeyMetrics'
import { useStorePlanData } from 'src/stores/storePlanData'
const storeAuth = useStoreAuth()
const storePlanData = useStorePlanData()
const storeUserSettings = useStoreUserSettings()
const storeKeyMetrics = useStoreKeyMetrics()

// get reactive data from stores
const { userSettings } = storeToRefs(storeUserSettings)
const { currencyString } = storeToRefs(storeUserSettings)

// stores variables
const currency = userSettings.value.currency
const currencySymbol = currencyString.value

console.log(currency, currencySymbol)

// declare useQuasar (to use the "notify" plugin)
const $q = useQuasar()

// ---------------------------------------- Reactive data ----------------------------------------------------
// computed data from stores (always use computed data when using data from store that needs to be updated after an action,
// in that case the action in pinia store is called after updateStorePlan(), if no actio is needed use storeToRefs for reactive data from stores)
const annualSavings = computed(() => storeKeyMetrics.keyMetricsDict.savingsDict.annualSavingsRate)

// general info
const planName = computed(() => storePlanData.planDataDict.planName)
const plannerGoal = computed(() => storePlanData.planDataDict.plannerGoalDict.goalSelection)
const goalDescription = computed(() => storePlanData.planDataDict.plannerGoalDict.goalDescription)

// numbers
const fireAutomaticNumberList = computed(
  () => storePlanData.planDataDict.fireNumberDict.fireAutomaticNumberList,
)
const fireNumberCheck = computed(() => storePlanData.planDataDict.fireNumberDict.fireNumberCheck)
const fireUserDefinedNumber = computed(
  () => storePlanData.planDataDict.fireNumberDict.fireUserDefinedNumber,
)
const fireNumberCheckOwn = computed(
  () => storePlanData.planDataDict.fireNumberDict.fireNumberCheckOwn,
)
const wealthAutomaticNumberList = computed(
  () => storePlanData.planDataDict.wealthNumberDict.wealthAutomaticNumberList,
)
const wealthNumberCheck = computed(
  () => storePlanData.planDataDict.wealthNumberDict.wealthNumberCheck,
)
const wealthUserDefinedNumber = computed(
  () => storePlanData.planDataDict.wealthNumberDict.wealthUserDefinedNumber,
)
const wealthNumberCheckOwn = computed(
  () => storePlanData.planDataDict.wealthNumberDict.wealthNumberCheckOwn,
)

// milestones
const fireMilestones = computed(
  () => storePlanData.planDataDict.fireMilestonesDict.automaticMilestonesList,
)
const selectedFireMilestones = computed(
  () => storePlanData.planDataDict.fireMilestonesDict.selectedMilestonesList,
)
const wealthMilestones = computed(
  () => storePlanData.planDataDict.wealthMilestonesDict.automaticMilestonesList,
)
const selectedWealthMilestones = computed(
  () => storePlanData.planDataDict.wealthMilestonesDict.selectedMilestonesList,
)

// savings allocation
const cashAllocation = computed(
  () => storePlanData.planDataDict.allocatedFundsDict.cashAllocationList,
)
const investmentAllocation = computed(
  () => storePlanData.planDataDict.allocatedFundsDict.investmentAllocationList,
)

// ------------------------- Preapre data to fill the DOM -----------------------------------------
// filter FIRE/Wealth number list
const filteredFireNumbers = computed(() => {
  const filteredFireNumbers = fireAutomaticNumberList.value.filter((fireNumber) =>
    fireNumberCheck.value.includes(fireNumber.label),
  )
  return filteredFireNumbers
})

const filteredWealthNumbers = computed(() => {
  const filteredWealthNumbers = wealthAutomaticNumberList.value.filter((wealthNumber) =>
    wealthNumberCheck.value.includes(wealthNumber.label),
  )
  return filteredWealthNumbers
})

// filter FIRE/Wealth milestone list
const filteredFireMilestones = computed(() => {
  const filteredFireMilestones = fireMilestones.value.filter((milestone) =>
    selectedFireMilestones.value.includes(milestone.label),
  )
  return filteredFireMilestones
})

const filteredWealthMilestones = computed(() => {
  const filteredWealthMilestones = wealthMilestones.value.filter((milestone) =>
    selectedWealthMilestones.value.includes(milestone.label),
  )
  return filteredWealthMilestones
})

// filter cash allocation list
const filteredCashAllocation = computed(() => {
  const filteredCashAllocation = cashAllocation.value.filter(
    (allocation) => allocation.knobValue !== 0,
  )
  return filteredCashAllocation
})

// filter investment allocation list
const filteredInvestmentAllocation = computed(() => {
  const filteredInvestmentAllocation = investmentAllocation.value.filter(
    (allocation) => allocation.knobValue !== 0,
  )
  return filteredInvestmentAllocation
})

// ---------------------------------- change plan variable in userSettings ------------------------------
// (to update view in Plan when key metrics doc exists)
async function editplan() {
  const userSettingsRef = doc(db, 'users', storeAuth.user.id)
  await updateDoc(userSettingsRef, { plan: 'noPlan' })
}

// ------------------------------------ select new plan -----------------------------------------------
const selectPlan = ref(false)
const selectPlanModel = ref(storeUserSettings.userSettings.planName)
const planOptions = computed(() => storePlanData.planList)

async function updateStorePlan() {
  const userSettingsRef = doc(db, 'users', storeAuth.user.id)
  await updateDoc(userSettingsRef, { planName: selectPlanModel.value })
  await storePlanData.getPlanData() // to update the storePlanData with the new updated planName from updateDoc
}

// ------------------------------------ delete existing plan -----------------------------------------------
const deletePlan = ref(false)
async function deleteStorePlan() {
  const planToDelete = storePlanData.planDataDict.planName

  try {
    // delete the selected plan
    await deleteDoc(doc(db, 'users', storeAuth.user.id, 'planData', planToDelete))

    // update the list of planNames without the deleted plan
    await storePlanData.getPlanNames()

    // set the planName in userSettings as the first element in the planList
    const userSettingsRef = doc(db, 'users', storeAuth.user.id)
    await updateDoc(userSettingsRef, { planName: planOptions.value['0'] })

    // update the storePlanData with the updated planName from updateDoc (first plan in planList)
    await storePlanData.getPlanData()

    $q.notify({
      message: 'Plan deleted from the database',
      color: 'positive',
      icon: 'check_circle',
      timeout: 1000,
    })
  } catch {
    $q.notify({
      message: 'Error when trying to deleted the selected plan from the database',
      color: 'error',
      icon: 'warning',
      timeout: 2000,
    })
  }
}
</script>
<!------------------------------------------------------------------------------------------------------->
<!-------------------------------------------- STYLE ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<style scoped></style>
