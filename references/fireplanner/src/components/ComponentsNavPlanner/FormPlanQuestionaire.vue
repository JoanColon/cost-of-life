<!-- eslint-disable no-unused-vars -->
<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------ TEMPLATE --------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<template>
  <div style="max-width: 1000px; margin: auto">
    <!-- Questionaire -->
    <q-form
      class="q-gutter-md"
      ref="myForm"
      style="width: 100%"
      @submit.prevent="onSubmit"
      @reset="onReset"
    >
      <q-list class="QuestionaireList shadow-1" style="background-color: white">
        <q-item-label header style="font-size: 16px; color: black; text-align: center"
          >Walk through the 4 steps to set your plan:</q-item-label
        >

        <!---------------------------------------- financial goal --------------------------------------->
        <div>
          <!-- list item -->
          <q-item>
            <!-- icon -->
            <q-item-section avatar>
              <q-icon name="looks_one" color="black" size="34px" />
            </q-item-section>

            <!-- label -->
            <q-item-section>
              <q-item-label>
                <span style="font-size: 14px; margin-bottom: 0px">Select your financial goal</span>
              </q-item-label>
            </q-item-section>

            <!-- edit button -->
            <q-item-section side>
              <div class="text-grey-8 q-gutter-xs">
                <q-btn size="12px" flat icon="edit" @click="fixedGoal = true" />
              </div>
            </q-item-section>
          </q-item>

          <!-- dialog (modal) -->
          <q-dialog v-model="fixedGoal">
            <q-card>
              <!-- captions -->
              <q-card-section class="q-mb-none">
                <div class="text-h6" style="text-align: center">Select your financial goal</div>
              </q-card-section>

              <q-separator />

              <!-- goal radio buttons and text area -->
              <q-card-section style="max-height: 65vh" class="scroll">
                <!-- FIRE selection -->
                <q-item tag="label" v-ripple>
                  <q-item-section avatar>
                    <q-radio v-model="plannerGoal" val="F.I.R.E" color="orange" />
                  </q-item-section>

                  <q-item-section>
                    <q-item-label style="font-size: 16px">Become a F.I.R.E</q-item-label>
                    <q-item-label style="text-align: justify; text-justify: inter-word" caption>
                      <strong>Financial Independence, Retire Early</strong>. Those seeking to attain
                      FIRE intentionally maximize their savings rate, along with aggressive
                      investments that again increases their wealth and/or income. The objective is
                      to accumulate assets until the resulting passive income provides enough money
                      for living expenses throughout one's retirement years.
                    </q-item-label>
                  </q-item-section>
                </q-item>

                <!-- Wealthier section -->
                <q-item tag="label" v-ripple>
                  <q-item-section avatar>
                    <q-radio v-model="plannerGoal" val="Wealthier" color="orange" />
                  </q-item-section>

                  <q-item-section>
                    <q-item-label style="font-size: 16px">Become wealthier over time</q-item-label>
                    <q-item-label style="text-align: justify; text-justify: inter-word" caption>
                      Financial planning is the practice of putting together a specific financial
                      plan to reach your goals in the long-term, specifically around how you will
                      manage your finances and prepare for all of the potential costs and issues
                      that may arise.
                    </q-item-label>
                  </q-item-section>
                </q-item>

                <!-- Text area section -->
                <q-input
                  v-model="goalDescription"
                  class="q-mt-sm"
                  type="textarea"
                  stack-label
                  label="Write down your goal, be specific!!"
                  outlined
                  color="grey"
                >
                </q-input>
              </q-card-section>

              <q-separator />

              <!-- dialog buttons -->
              <q-card-actions align="right">
                <q-btn flat label="Accept" color="orange" v-close-popup />
              </q-card-actions>
            </q-card>
          </q-dialog>
        </div>

        <!----------------------------------------- your number ----------------------------------------->
        <div>
          <!-- list item -->
          <q-item>
            <!-- icon -->
            <q-item-section avatar>
              <q-icon name="looks_two" color="black" size="34px" />
            </q-item-section>

            <!-- label -->
            <q-item-section>
              <q-item-label>
                <span style="font-size: 14px; margin-bottom: 0px"
                  >Understand your {{ plannerGoal || '' }} numbers</span
                >
              </q-item-label>
            </q-item-section>

            <!-- edit button -->
            <q-item-section side>
              <div class="text-grey-8 q-gutter-xs">
                <q-btn size="12px" flat icon="edit" @click="fixedNumber = true" />
              </div>
            </q-item-section>
          </q-item>

          <!-- dialog (modal FIRE/Wealth number) -->
          <q-dialog v-model="fixedNumber">
            <q-card>
              <!-- caption -->
              <q-card-section>
                <div class="text-h6" style="text-align: center">
                  This are your "{{ plannerGoal }}" numbers
                </div>
              </q-card-section>

              <q-separator />

              <!-- fire number section -->
              <q-card-section
                v-if="plannerGoal === 'F.I.R.E'"
                style="max-height: 50vh"
                class="scroll"
              >
                <p style="text-align: center">
                  The most popular equation is: <strong>F.I.R.E number</strong> = 25 x your annual
                  expenses.
                </p>

                <div>
                  <q-list>
                    <!-- fire number list -->
                    <q-item v-for="fireNumber in fireNumberList" :key="fireNumber.id">
                      <q-item-section avatar>
                        <q-checkbox v-model="fireNumberCheck" :val="fireNumber.label" />
                      </q-item-section>

                      <q-item-section>
                        <q-item-label
                          >{{ fireNumber.label }}
                          <strong>{{
                            fireNumber.amount.toLocaleString('en-US', {
                              style: 'currency',
                              currency: currency,
                              maximumFractionDigits: 0,
                            })
                          }}</strong></q-item-label
                        >
                        <q-item-label caption>{{ fireNumber.caption }}</q-item-label>
                      </q-item-section>
                    </q-item>

                    <!-- choose your fire number -->
                    <q-item>
                      <q-item-section avatar>
                        <q-checkbox v-model="fireNumberCheckOwn" />
                      </q-item-section>

                      <q-item-section>
                        <q-item-label>Choose your F.I.R.E number: </q-item-label>
                        <q-input
                          v-model.number="fireNumberOwnSelection"
                          type="number"
                          stack-label
                          label="choose your number"
                          prefix="€"
                          dense
                          style="width: 50%"
                          class="text-caption"
                        >
                        </q-input>
                      </q-item-section>
                    </q-item>
                  </q-list>
                </div>
              </q-card-section>

              <!-- wealthier number section -->
              <q-card-section
                v-else-if="plannerGoal === 'Wealthier'"
                style="max-height: 50vh"
                class="scroll"
              >
                <p style="text-align: center">
                  The most popular equation is: <strong>8.5 times</strong> your active income at the
                  retirement age
                </p>

                <div>
                  <!-- automatic number -->
                  <q-item>
                    <q-item-section avatar>
                      <q-checkbox v-model="wealthNumberCheck" :val="wealthNumber[0].label" />
                    </q-item-section>

                    <q-item-section>
                      <q-item-label
                        >{{ wealthNumber[0].label }}
                        <strong>
                          {{
                            wealthNumber[0].amount.toLocaleString('en-US', {
                              style: 'currency',
                              currency: currency,
                              maximumFractionDigits: 0,
                            })
                          }}</strong
                        ></q-item-label
                      >
                      <q-item-label caption>{{ wealthNumber[0].caption }}</q-item-label>
                    </q-item-section>
                  </q-item>

                  <!-- choose your fire number -->
                  <q-item>
                    <q-item-section avatar>
                      <q-checkbox v-model="wealthNumberCheckOwn" />
                    </q-item-section>

                    <q-item-section>
                      <q-item-label>Choose your wealth number: </q-item-label>
                      <q-input
                        v-model.number="wealthNumberOwnSelection"
                        type="number"
                        stack-label
                        label="choose your number"
                        prefix="€"
                        dense
                        style="width: 50%"
                        class="text-caption"
                      >
                      </q-input>
                    </q-item-section>
                  </q-item>
                </div>
              </q-card-section>

              <!-- first select goal number -->
              <q-card-section v-else style="max-height: 50vh" class="scroll">
                <div>
                  <p>please, first select your financial goal</p>
                </div>
              </q-card-section>

              <q-separator />

              <!-- dialog buttons -->
              <q-card-actions align="right">
                <q-btn flat label="Accept" color="orange" v-close-popup />
              </q-card-actions>
            </q-card>
          </q-dialog>
        </div>

        <!------------------------------------------ milestones ----------------------------------------->
        <div>
          <!-- list item -->
          <q-item>
            <!-- icon -->
            <q-item-section avatar>
              <q-icon name="looks_3" color="black" size="34px" />
            </q-item-section>

            <!-- label -->
            <q-item-section>
              <q-item-label>
                <span style="font-size: 14px; margin-bottom: 0px">Set your milestones</span>
              </q-item-label>
            </q-item-section>

            <!-- edit button -->
            <q-item-section side>
              <div class="text-grey-8 q-gutter-xs">
                <q-btn size="12px" flat icon="edit" @click="fixedMilestones = true" />
              </div>
            </q-item-section>
          </q-item>

          <!-- dialog (modal milestones) -->
          <q-dialog v-model="fixedMilestones">
            <q-card>
              <q-card-section>
                <div class="text-h6" style="text-align: center">
                  Set your "{{ plannerGoal }}" milestones
                </div>
              </q-card-section>

              <q-separator />

              <!-- FIRE milestones -->
              <q-card-section
                v-if="plannerGoal === 'F.I.R.E'"
                style="max-height: 50vh"
                class="scroll"
              >
                <p>Check the milestones that make sense to your plan</p>

                <q-list>
                  <q-item v-for="milestone in fireMilestonesList" :key="milestone.id">
                    <q-item-section avatar>
                      <q-checkbox
                        v-model="selectionFireMilestones"
                        :val="milestone.label"
                        checked-icon="star"
                        unchecked-icon="star_border"
                        color="orange"
                      />
                    </q-item-section>

                    <q-item-section>
                      <q-item-label>{{ milestone.label }}</q-item-label>
                      <q-item-label caption>{{ milestone.caption }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-card-section>

              <!-- Wealthier milestones -->
              <q-card-section
                v-else-if="plannerGoal === 'Wealthier'"
                style="max-height: 50vh"
                class="scroll"
              >
                <p>Check the milestones that make sense to your plan</p>

                <q-list>
                  <q-item v-for="milestone in wealthMilestonesList" :key="milestone.id">
                    <q-item-section avatar>
                      <q-checkbox
                        v-model="selectionWealthMilestones"
                        :val="milestone.label"
                        checked-icon="star"
                        unchecked-icon="star_border"
                        color="orange"
                      />
                    </q-item-section>

                    <q-item-section>
                      <q-item-label>{{ milestone.label }}</q-item-label>
                      <q-item-label caption>{{ milestone.caption }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-card-section>

              <!-- first select goal milestones -->
              <q-card-section v-else style="max-height: 50vh" class="scroll">
                <div>
                  <p>please, first select your financial goal</p>
                </div>
              </q-card-section>

              <q-separator />

              <q-card-actions align="right">
                <q-btn flat label="Accept" color="orange" v-close-popup />
              </q-card-actions>
            </q-card>
          </q-dialog>
        </div>

        <!---------------------------------------- allocate savings ------------------------------------->
        <div>
          <!-- list item -->
          <q-item>
            <!-- icon -->
            <q-item-section avatar>
              <q-icon name="looks_4" color="black" size="34px" />
            </q-item-section>

            <!-- label -->
            <q-item-section>
              <q-item-label>
                <span style="font-size: 14px; margin-bottom: 0px"
                  >Allocate your annual savings</span
                >
              </q-item-label>
            </q-item-section>

            <!-- edit button -->
            <q-item-section side>
              <div class="text-grey-8 q-gutter-xs">
                <q-btn size="12px" flat icon="edit" @click="fixedAllocation = true" />
              </div>
            </q-item-section>
          </q-item>

          <!-- dialog (modal) -->
          <q-dialog v-model="fixedAllocation">
            <q-card>
              <!-- modal title -->
              <q-card-section>
                <div class="text-h6" style="text-align: center">Allocate your annual savings</div>
              </q-card-section>

              <q-separator />

              <!-- savings allocation, modal body -->
              <q-card-section style="max-height: 65vh" class="scroll">
                <p>
                  According your savings rate target, you need to allocate:
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
                <p v-if="knobValueSum !== 100">
                  You have allocated {{ knobValueSum }} % of your savings
                </p>

                <!-- cash accounts -->
                <div>
                  <p style="font-size: 16px; margin-bottom: 0px"><strong>Cash accounts</strong></p>
                  <q-list>
                    <q-item
                      dense
                      v-for="cashAllocation in cashAllocationList"
                      :key="cashAllocation.id"
                    >
                      <!-- knob -->
                      <q-item-section style="max-width: 50px">
                        <q-knob
                          show-value
                          font-size="12px"
                          v-model="cashAllocation.knobValue"
                          size="50px"
                          :thickness="0.22"
                          color="orange"
                          track-color="grey-3"
                          class="q-mt-xs q-mb-xs"
                        >
                          {{ cashAllocation.knobValue }}%
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
                          @click="cashAllocation.knobValue++"
                        />
                        <q-btn
                          outline
                          round
                          color="black"
                          icon="remove"
                          size="6px"
                          @click="cashAllocation.knobValue--"
                        />
                      </q-item-section>

                      <!-- label -->
                      <q-item-section>
                        <q-item-label style="font-size: 14px">
                          {{ cashAllocation.label
                          }}<strong>{{
                            ((annualSavings * cashAllocation.knobValue) / 100).toLocaleString(
                              'en-US',
                              { style: 'currency', currency: currency, maximumFractionDigits: 0 },
                            ) + '/year'
                          }}</strong>
                        </q-item-label>
                        <q-item-label caption>{{ cashAllocation.caption }}</q-item-label>
                      </q-item-section>
                    </q-item>
                  </q-list>
                </div>

                <!-- investments -->
                <div>
                  <p class="q-mt-sm" style="font-size: 16px"><strong>Investments</strong></p>
                  <q-list>
                    <q-item
                      dense
                      v-for="investmentAllocation in investmentAllocationList"
                      :key="investmentAllocation.id"
                    >
                      <!-- knob -->
                      <q-item-section style="max-width: 50px">
                        <q-knob
                          show-value
                          font-size="12px"
                          v-model="investmentAllocation.knobValue"
                          size="50px"
                          :thickness="0.22"
                          color="orange"
                          track-color="grey-3"
                          class="q-mt-xs q-mb-xs"
                        >
                          {{ investmentAllocation.knobValue }}%
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
                          @click="investmentAllocation.knobValue++"
                        />
                        <q-btn
                          outline
                          round
                          color="black"
                          icon="remove"
                          size="6px"
                          @click="investmentAllocation.knobValue--"
                        />
                      </q-item-section>

                      <!-- label -->
                      <q-item-section>
                        <q-item-label style="font-size: 14px">
                          {{ investmentAllocation.label
                          }}<strong>{{
                            ((annualSavings * investmentAllocation.knobValue) / 100).toLocaleString(
                              'en-US',
                              { style: 'currency', currency: currency, maximumFractionDigits: 0 },
                            ) + '/year'
                          }}</strong>
                        </q-item-label>
                        <q-item-label caption>{{ investmentAllocation.caption }}</q-item-label>
                      </q-item-section>
                    </q-item>
                  </q-list>
                </div>
              </q-card-section>

              <q-separator />

              <!-- card actions -->
              <q-card-actions align="right">
                <q-btn
                  flat
                  label="Accept"
                  color="orange"
                  v-close-popup="knobValueSum === 100"
                  @click="checkAllocation"
                />
              </q-card-actions>
            </q-card>
          </q-dialog>
        </div>
      </q-list>

      <!------------------------------------------ save & reset button ---------------------------------------->
      <div class="submit-section shadow-1" style="width: 100%">
        <q-input
          v-model="planName"
          :rules="[(val) => !!val || 'Field is required']"
          class="q-ml-lg"
          type="String"
          label="Enter a plan name"
          stack-label
          style="width: 60%"
        >
        </q-input>

        <!--class row added to use q-space, moves the button to the right side  -->
        <q-space />

        <!-- submit button -->
        <q-btn
          class="q-mr-md q-ml-lg q-mt-md"
          style="height: 75%"
          label="Save"
          type="submit"
          rounded
          color="orange"
          no-caps
        />
        <!-- reset button -->
        <q-btn
          class="q-mr-md q-mt-md"
          style="height: 75%"
          label="Reset"
          type="reset"
          rounded
          color="deep-orange"
          no-caps
        />
      </div>
    </q-form>

    <!-- handels the emit action to move from planner view to planner questionaire -->
    <div class="q-mt-md submit-section shadow-1" style="width: 100%">
      <q-btn
        class="q-ma-sm"
        flat
        padding="none"
        no-caps
        style="color: #fca311; margin-left: auto; margin-right: auto"
        @click="editplan()"
      >
        View plan
      </q-btn>
    </div>
  </div>
</template>

<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------- SCRIPT ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useQuasar } from 'quasar'
import * as math from 'mathjs'
import { db } from 'src/js/firebase'
import { doc, setDoc, updateDoc } from 'firebase/firestore'

// import and declare stores
import { useStoreAuth } from 'src/stores/storeAuth'
import { useStoreUserSettings } from 'src/stores/storeUserSettings'
import { useStoreKeyMetrics } from 'src/stores/storeKeyMetrics'
import { useStorePlanData } from 'src/stores/storePlanData'
const storeAuth = useStoreAuth()
const storeUserSettings = useStoreUserSettings()
const storeKeyMetrics = useStoreKeyMetrics()
const storePlanData = useStorePlanData()

// get reactive data from stores
const { userSettings } = storeToRefs(storeUserSettings)
const { currencyString } = storeToRefs(storeUserSettings)
const { keyMetricsDict } = storeToRefs(storeKeyMetrics)
const { planDataDict } = storeToRefs(storePlanData)
const { planList } = storeToRefs(storePlanData)

// stores variables
const currency = userSettings.value.currency
// eslint-disable-next-line no-unused-vars
const currencySymbol = currencyString.value

const expensesDict = keyMetricsDict.value.expensesDict
const incomeDict = keyMetricsDict.value.incomeDict
const savingsDict = keyMetricsDict.value.savingsDict

const storePlanName = planDataDict.value.planName
const plannerGoalDict = planDataDict.value.plannerGoalDict
const fireNumberDict = planDataDict.value.fireNumberDict
const wealthNumberDict = planDataDict.value.wealthNumberDict
const fireMilestonesDict = planDataDict.value.fireMilestonesDict
const wealthMilestonesDict = planDataDict.value.wealthMilestonesDict
const allocatedFundsDict = planDataDict.value.allocatedFundsDict

// declare useQuasar (to use the "notify" plugin)
const $q = useQuasar()

// ------------------------ Select your financial goal ------------------------------------------------
// to open the modal/dialog
const fixedGoal = ref(false)

const plannerGoal = ref('')

const goalDescription = ref('')

// ----------------------- your F.I.R.E/wealthier number ------------------------------------------------
// to open the modal/dialog
const fixedNumber = ref(false)

// F.I.R.E number list (automatic) - always use computed data when reading data from store (makes it reactive!)
const fireNumberList = computed(() => [
  {
    id: 'fnlLeanFire',
    label: 'Lean F.I.R.E:',
    caption: `Amount of money you need to pay for your basics (${expensesDict.totalExpenses.basicExpenses.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 0 })}/year)`,
    amount: expensesDict.totalExpenses.basicExpenses * 25,
  },
  {
    id: 'fnlRegularFire',
    label: 'Regular F.I.R.E:',
    caption: `Amount of money you need to pay for you existing lifestyle (${expensesDict.totalExpenses.regularExpenses.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 0 })}/year)`,
    amount: expensesDict.totalExpenses.regularExpenses * 25,
  },
  {
    id: 'fnlFatFire',
    label: 'Fat F.I.R.E:',
    caption: `Amount of money you need to pay for 1.5 your existing lifestyle (${(expensesDict.totalExpenses.regularExpenses * 1.5).toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 0 })}/year)`,
    amount: expensesDict.totalExpenses.regularExpenses * 25 * 1.5,
  },
])

// F.I.R.E number user input
const fireNumberOwnSelection = ref(0)

// F.I.R.E number Selection (v-model of checkboxes )
const fireNumberCheck = ref([])
const fireNumberCheckOwn = ref(false)

// Wealthier numbers
const wealthNumber = computed(() => [
  {
    id: 'wnAutomatic',
    label: 'Wealth number:',
    caption: 'amount of money that you should have at your retairement age',
    amount: incomeDict.activeIncome[0].amount * 8.5,
  },
])

const wealthNumberOwnSelection = ref(0)

// wealthier number Selection (v-model of checkboxes )
const wealthNumberCheck = ref([])
const wealthNumberCheckOwn = ref(false)

// ---------------------------- Define your milestones --------------------------------------------------

// to open the modal/dialog
const fixedMilestones = ref(false)

// F.I.R.E milestone list
const fireMilestonesList = reactive([
  {
    id: 'fmlNetZeroWorth',
    label: 'Zero dollar net worth',
    caption: 'Zero is much better than broke!!',
  },
  {
    id: 'fmlZeroDebt',
    label: "You don't have any debt",
    caption: 'You are free, no mortage, no student loans, time to celebrate!',
  },
  {
    id: 'fmlEmergyFund6m',
    label: 'Your emergency fund covers 6 months of expenses',
    caption: 'keep saving, this is important!',
  },
  {
    id: 'fmlEmergyFund1y',
    label: 'Your emergency fund covers 1 year of expenses',
    caption: 'Your are prepared for most eventualities!',
  },
  {
    id: 'fmlUtilityBills',
    label: 'Passive income covers your utility bills',
    caption: 'Way to go, keep investing!',
  },
  {
    id: 'fmlMortage',
    label: 'Passive income covers your mortage',
    caption: 'Way to go, keep investing!',
  },
  {
    id: 'fml100k',
    label: 'Your net worth is 100K',
    caption: 'This is a huge achievement, enjoy it!',
  },
  {
    id: 'fmlLeanFire',
    label: 'You became a lean F.I.R.E',
    caption: 'Your passive income covers your basic expenses, you are almost there!',
  },
  {
    id: 'fmlRegularFire',
    label: 'You became a regular F.I.R.E',
    caption: 'Your passive income covers your current lifestyle, you did it, congratulations!',
  },
  {
    id: 'fmlFatFire',
    label: 'You became a fat F.I.R.E',
    caption: 'You can retire safely, enjoy the rest of your life!',
  },
])

// list to store selected F.I.R.E milestones
const selectionFireMilestones = ref([])

// Wealthier milestone list
const wealthMilestonesList = reactive([
  {
    id: 'wmlNetZeroWorth',
    label: 'Zero dollar net worth',
    caption: 'Zero is much better than broke!!',
  },
  {
    id: 'wmlZeroDebt',
    label: "You don't have any debt",
    caption: 'You are free, no mortage, no student loans, time to celebrate!',
  },
  {
    id: 'wmlSavingsForRetirement0.1x',
    label: 'Your savings multiple is 0.1x your current salary',
    caption: 'value expected for people from 18 to 25 years old',
  },
  {
    id: 'wmlSavingsForRetirement0.7x',
    label: 'Your savings multiple is 0.7x your current salary',
    caption: 'value expected for people from 26 to 30 years old',
  },
  {
    id: 'wmlSavingsForRetirement1.4x',
    label: 'Your savings multiple is 1.4x your current salary',
    caption: 'value expected for people from 31 to 35 years old',
  },
  {
    id: 'wmlSavingsForRetirement2.2x',
    label: 'Your savings multiple is 2.2x your current salary',
    caption: 'value expected for people from 36 to 40 years old',
  },
  {
    id: 'wmlSavingsForRetirement3.1x',
    label: 'Your savings multiple is 3.1x your current salary',
    caption: 'value expected for people from 41 to 45 years old',
  },
  {
    id: 'wmlSavingsForRetirement4.2x',
    label: 'Your savings multiple is 4.2x your current salary',
    caption: 'value expected for people from 46 to 50 years old',
  },
  {
    id: 'wmlSavingsForRetirement5.4x',
    label: 'Your savings multiple is 5.4x your current salary',
    caption: 'value expected for people from 51 to 55 years old',
  },
  {
    id: 'wmlSavingsForRetirement6.8x',
    label: 'Your savings multiple is 6.8x your current salary',
    caption: 'value expected for people from 56 to 60 years old',
  },
  {
    id: 'wmlSavingsForRetirement8.2x',
    label: 'Your savings multiple is 8.2x your current salary',
    caption: 'value expected for people from >60 years old',
  },
])

// list to store selected Wealthier milestones
const selectionWealthMilestones = ref([])

// ---------------------------- Allocate your annual savings --------------------------------------------
// to open the modal/dialog
const fixedAllocation = ref(false)

// used to calculate the allocated amount per category and to show in the template the total saving amounts
const annualSavings = savingsDict.annualSavingsRate

const cashAllocationList = reactive([
  {
    id: 'calEmergencyFund',
    knobValue: 0,
    label: 'Emergency fund: ',
    caption: '',
    rateReturn: 0.01,
  },
  {
    id: 'calBigPurchases',
    knobValue: 0,
    label: 'Big purchases: ',
    caption: 'e.g., Saving for your home downpayment, buy a new car, etc.',
    rateReturn: 0.01,
  },
])

const investmentAllocationList = reactive([
  {
    id: 'ialStockMarket',
    knobValue: 0,
    label: 'Stock market: ',
    caption: 'e.g., Individual stocks, ETF, mutual funds, etc.',
    rateReturn: 0.066,
  },
  {
    id: 'ialRealEstate',
    knobValue: 0,
    label: 'Real estate: ',
    caption: 'e.g., REITs, residential, commercial, industrial, raw land, special use',
    rateReturn: 0.066,
  },
  {
    id: 'ialFixedIncome',
    knobValue: 0,
    label: 'Fixed income: ',
    caption:
      'e.g., Government bonds, corporate bonds, certificates of deposit, money market funds, etc.',
    rateReturn: 0.03,
  },
  {
    id: 'ialCryptoAssets',
    knobValue: 0,
    label: 'Cryptoassets: ',
    caption: 'e.g., Cryptocurrencies, NFT, etc. ',
    rateReturn: 0.15,
  },
  {
    id: 'ialBusinessEquity',
    knobValue: 0,
    label: 'Business equity: ',
    caption: 'e.g., own business ',
    rateReturn: 0.08,
  },
  {
    id: 'ialOtherInvestments',
    knobValue: 0,
    label: 'Other investments: ',
    caption: 'e.g., gold, commodities, art, jewelry, etc. ',
    rateReturn: 0.02,
  },
])

// calculates the sum of all knob Values (savings allocation)
const knobValueSum = computed(() => {
  const allocationNewList = cashAllocationList.concat(investmentAllocationList)

  const knobValueList = []
  for (let i = 0; i < allocationNewList.length; i++) {
    knobValueList.push(allocationNewList[i].knobValue)
  }

  const knobValuesum = math.sum(knobValueList)

  return knobValuesum
})

// ensures that user allocation is 100% of total savings
function checkAllocation() {
  if (knobValueSum.value !== 100) {
    $q.notify({
      message: 'Your allocation is not 100%, please revise',
      color: 'negative',
      icon: 'check_circle',
      timeout: 1000,
    })
  }
}

// -------------------------------------- onMounted block -----------------------------------------------
// if create new, empty fields, if edit, mount selected plan data
onMounted(() => {
  try {
    // plan Name
    planName.value = storePlanName

    if (planName.value !== '') {
      // plan goal and description
      plannerGoal.value = plannerGoalDict.goalSelection
      goalDescription.value = plannerGoalDict.goalDescription

      // your F.I.R.E number
      fireNumberOwnSelection.value = fireNumberDict.fireUserDefinedNumber
      fireNumberCheck.value = fireNumberDict.fireNumberCheck
      fireNumberCheckOwn.value = fireNumberDict.fireNumberCheckOwn

      // your Wealth number
      wealthNumberCheck.value = wealthNumberDict.wealthNumberCheck
      wealthNumberCheckOwn.value = wealthNumberDict.wealthNumberCheckOwn
      wealthNumberOwnSelection.value = wealthNumberDict.wealthUserDefinedNumber

      // selected milestones
      selectionFireMilestones.value = fireMilestonesDict.selectedMilestonesList
      selectionWealthMilestones.value = wealthMilestonesDict.selectedMilestonesList

      // knobValues cash allocation
      for (let i = 0; i < cashAllocationList.length; i++) {
        cashAllocationList[i].knobValue = allocatedFundsDict.cashAllocationList[i].knobValue
      }

      // knobValues investment allocation
      for (let i = 0; i < investmentAllocationList.length; i++) {
        investmentAllocationList[i].knobValue =
          allocatedFundsDict.investmentAllocationList[i].knobValue
      }
    }
  } catch (error) {
    console.log(error)
  }
})

// -------------------------------- submit form to firebase ---------------------------------------------
const planName = ref('')

async function onSubmit() {
  await setDoc(doc(db, 'users', storeAuth.user.id, 'planData', planName.value), {
    timestamp: Date.now(),
    planName: planName.value,
    plannerGoalDict: {
      goalSelection: plannerGoal.value,
      goalDescription: goalDescription.value,
    },
    fireNumberDict: {
      fireAutomaticNumberList: fireNumberList.value,
      fireUserDefinedNumber: fireNumberOwnSelection.value,
      fireNumberCheck: fireNumberCheck.value,
      fireNumberCheckOwn: fireNumberCheckOwn.value,
    },
    wealthNumberDict: {
      wealthAutomaticNumberList: wealthNumber.value,
      wealthUserDefinedNumber: wealthNumberOwnSelection.value,
      wealthNumberCheck: wealthNumberCheck.value,
      wealthNumberCheckOwn: wealthNumberCheckOwn.value,
    },
    fireMilestonesDict: {
      automaticMilestonesList: fireMilestonesList,
      selectedMilestonesList: selectionFireMilestones.value,
    },
    wealthMilestonesDict: {
      automaticMilestonesList: wealthMilestonesList,
      selectedMilestonesList: selectionWealthMilestones.value,
    },
    allocatedFundsDict: {
      cashAllocationList,
      investmentAllocationList,
    },
  })

  const userSettingsRef = doc(db, 'users', storeAuth.user.id)
  await updateDoc(userSettingsRef, { planName: planName.value }) // update the planName in userSettings
  await storePlanData.getPlanData() // to update the storePlanData with the new updated planName from updateDoc
  await storePlanData.getPlanNames() // to update the list of planNames with the new saved entry

  $q.notify({
    message: 'Plan saved, to view it click on "View plan"',
    color: 'positive',
    icon: 'check_circle',
    timeout: 1000,
  })
}

function onReset() {
  planName.value = null
  plannerGoal.value = null
  goalDescription.value = null
  fireNumberCheck.value = null
  fireNumberCheckOwn.value = null
  wealthNumberCheck.value = null
  wealthNumberCheckOwn.value = null
  selectionFireMilestones.value = []
  selectionWealthMilestones.value = []
  cashAllocationList.forEach(function (allocation) {
    allocation.knobValue = 0
  })
  investmentAllocationList.forEach(function (allocation) {
    allocation.knobValue = 0
  })
}

// ---------------------------------- View and Create plan section -------------------------------------------------

// change plan variable in userSettings (to update view in Plan when key metrics doc exists)
async function editplan() {
  const keys = Object.keys(planList.value)
  console.log(keys.length)
  if (keys.length !== 0) {
    const userSettingsRef = doc(db, 'users', storeAuth.user.id)
    await updateDoc(userSettingsRef, { plan: 'plan' })
  } else {
    $q.notify({
      message: 'first save a plan',
      color: 'negative',
      icon: 'check_circle',
      timeout: 1000,
    })
  }
}
</script>

<!------------------------------------------------------------------------------------------------------->
<!-------------------------------------------- STYLE ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<style scoped>
.QuestionaireContainer {
  border-radius: 15px;
  background: white;
  width: 95%;
  height: 95%;
}

.QuestionaireList {
  border-radius: 15px;
  background: white;
  width: 100%;
}

.submit-section {
  display: flex;
  justify-content: space-between;
  border-radius: 15px;
  background: white;
  width: 95%;
  height: 95%;
}
</style>
