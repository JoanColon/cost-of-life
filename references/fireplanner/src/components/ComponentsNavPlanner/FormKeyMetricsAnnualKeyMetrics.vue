<!-- eslint-disable object-shorthand -->
<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------ TEMPLATE --------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<template>
  <div style="max-width: 1000px; margin: auto">
    <!------------------------------------  ANNUAL METRICS LAYOUT ------------------------------------------------>
    <div class="shadow-1 white-container" style="width: 100%; display: block">
      <p class="q-mb-none q-mt-sm q-pb-none q-pt-sm" style="text-align: center; font-size: 16px">
        <strong>Annual metrics</strong>
      </p>

      <div class="q-mb-sm q-mt-none white-container" style="width: 100%; display: block">
        <!-- income -->
        <q-item>
          <q-item-section avatar>
            <q-icon name="payments"></q-icon>
          </q-item-section>

          <q-item-section>
            <q-item-label class="text-weight-bold" style="font-size: 16px">Income</q-item-label>
            <q-item-label caption
              >{{
                incomeDict.totalIncome.toLocaleString('en-US', {
                  style: 'currency',
                  currency: currency,
                  maximumFractionDigits: 0,
                })
              }}/year</q-item-label
            >
          </q-item-section>

          <q-btn
            class="q-my-none q-mr-xs float-left"
            flat
            no-caps
            style="color: #14213d; height: 75%"
            icon="search"
            @click="
              keyMetricsDialog = true
              annualMetricsTab = 'income'
            "
          >
          </q-btn>
        </q-item>

        <!-- expenses -->
        <q-item>
          <q-item-section avatar>
            <q-icon name="credit_card"></q-icon>
          </q-item-section>

          <q-item-section>
            <q-item-label class="text-weight-bold" style="font-size: 16px">Expenses</q-item-label>
            <q-item-label caption
              >{{
                expensesDict.totalExpenses.regularExpenses.toLocaleString('en-US', {
                  style: 'currency',
                  currency: currency,
                  maximumFractionDigits: 0,
                })
              }}/year</q-item-label
            >
          </q-item-section>

          <q-btn
            class="q-my-none q-mr-xs"
            flat
            no-caps
            style="color: #14213d; height: 75%"
            icon="search"
            @click="
              keyMetricsDialog = true
              annualMetricsTab = 'expenses'
            "
          >
          </q-btn>
        </q-item>

        <!-- savings -->
        <q-item>
          <q-item-section avatar>
            <q-icon name="savings"></q-icon>
          </q-item-section>

          <q-item-section>
            <q-item-label class="text-weight-bold" style="font-size: 16px">Savings</q-item-label>
            <q-item-label caption
              >{{
                annualSavingsRate.toLocaleString('en-US', {
                  style: 'currency',
                  currency: currency,
                  maximumFractionDigits: 0,
                })
              }}/year</q-item-label
            >
          </q-item-section>

          <q-btn
            class="q-my-none q-mr-xs"
            flat
            no-caps
            style="color: #14213d; height: 75%"
            icon="search"
            @click="((keyMetricsDialog = true), (annualMetricsTab = 'savings'))"
          >
          </q-btn>
        </q-item>
      </div>
    </div>

    <!------------------------------------  ANNUAL METRICS DIALOG/FORM ------------------------------------------------>
    <q-dialog v-model="keyMetricsDialog">
      <q-card style="width: 500px; max-width: 85vw">
        <!-- card header -->
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Annual metrics information</div>
          <q-space />
          <q-btn
            icon="close"
            flat
            round
            dense
            v-close-popup
            @click="$emit('close-new-key-metrics-entry')"
          />
        </q-card-section>

        <!-- tabs -->
        <q-card-section>
          <q-tabs v-model="annualMetricsTab" no-caps dense>
            <q-tab name="income" label="Income"></q-tab>
            <q-tab name="expenses" label="Expenses"></q-tab>
            <q-tab name="savings" label="Savings"></q-tab>
          </q-tabs>
        </q-card-section>

        <!-- tabs forms - income, expenses and savings -->
        <q-card-section>
          <!------------------------------------  INCOME------------------------------------------------>
          <div v-if="annualMetricsTab === 'income'">
            <q-card flat style="width: 500px; max-width: 80vw">
              <!-- Active income -->
              <q-card-section>
                <p style="font-size: 16px; margin-bottom: 0px"><strong>Active Income</strong></p>
                <q-input
                  v-for="incomeActive in incomeActiveList"
                  :key="incomeActive.id"
                  v-model.number="incomeActive.amount"
                  type="number"
                  :label="incomeActive.label"
                  :prefix="currencySymbol"
                  class="q-ml-sm q-mr-lg"
                />

                <!-- Passive income -->
                <p style="font-size: 16px; margin-top: 25px; margin-bottom: 0px">
                  <strong>Passive Income</strong>
                </p>
                <q-input
                  v-for="incomePassive in incomePassiveList"
                  :key="incomePassive.id"
                  v-model.number="incomePassive.amount"
                  type="number"
                  :label="incomePassive.label"
                  :prefix="currencySymbol"
                  class="q-ml-sm q-mr-lg"
                >
                  <template v-slot:append>
                    <q-avatar v-if="seeVsEdit === 'edit'">
                      <q-btn
                        round
                        icon="autorenew"
                        @click="
                          updateFromInvestment(
                            incomePassive.detailInvestment,
                            incomePassive.arrayPostion,
                          )
                        "
                      >
                        <q-tooltip>
                          Click to update the value from the Investments Section. It will calculate
                          the "net income" from the "gross income" and your average tax rate.
                        </q-tooltip>
                      </q-btn>
                    </q-avatar>
                  </template>
                </q-input>
              </q-card-section>
            </q-card>
          </div>

          <!------------------------------------  EXPENSES ------------------------------------------------>
          <div v-if="annualMetricsTab === 'expenses'">
            <q-card flat style="width: 500px; max-width: 80vw">
              <!-- housing category -->
              <q-expansion-item
                :header-style="{ fontSize: '16px' }"
                header-class="text-weight-bold"
                dense
                label="Housing"
                :caption="`${expensesDict.partialExpenses.housing.toLocaleString('en-US', { style: 'currency', currency: currency, maximumFractionDigits: 0 })}/year`"
              >
                <q-card>
                  <q-card-section>
                    <q-input
                      v-for="expensesHousing in expensesHousingList"
                      :key="expensesHousing.id"
                      v-model.number="expensesHousing.amount"
                      type="number"
                      :label="expensesHousing.label"
                      :prefix="currencySymbol"
                      class="q-ml-sm q-mr-lg"
                    />
                  </q-card-section>
                </q-card>
              </q-expansion-item>

              <!-- transportation category -->
              <q-expansion-item
                :header-style="{ fontSize: '16px' }"
                header-class="text-weight-bold"
                dense
                label="Transportation"
                :caption="`${expensesDict.partialExpenses.transportation.toLocaleString('en-US', { style: 'currency', currency: currency, maximumFractionDigits: 0 })}/year`"
              >
                <!-- transportation -->
                <q-card class="q-mt-none">
                  <q-card-section>
                    <q-input
                      v-for="expensesTransportation in expensesTransportationList"
                      :key="expensesTransportation.id"
                      v-model.number="expensesTransportation.amount"
                      type="number"
                      :label="expensesTransportation.label"
                      :prefix="currencySymbol"
                      class="q-ml-sm q-mr-lg"
                    />
                  </q-card-section>
                </q-card>
              </q-expansion-item>

              <!-- groceries category -->
              <q-expansion-item
                :header-style="{ fontSize: '16px' }"
                header-class="text-weight-bold"
                dense
                label="Groceries / supermarket"
                :caption="`${expensesDict.partialExpenses.groceries.toLocaleString('en-US', { style: 'currency', currency: currency, maximumFractionDigits: 0 })}/year`"
              >
                <q-card>
                  <q-card-section>
                    <q-input
                      v-for="expensesGroceries in expensesGroceriesList"
                      :key="expensesGroceries.id"
                      v-model.number="expensesGroceries.amount"
                      type="number"
                      :label="expensesGroceries.label"
                      :prefix="currencySymbol"
                      class="q-ml-sm q-mr-lg"
                    />
                  </q-card-section>
                </q-card>
              </q-expansion-item>

              <!-- utilities category -->
              <q-expansion-item
                :header-style="{ fontSize: '16px' }"
                header-class="text-weight-bold"
                dense
                label="Utilities"
                :caption="`${expensesDict.partialExpenses.utilities.toLocaleString('en-US', { style: 'currency', currency: currency, maximumFractionDigits: 0 })}/year`"
              >
                <q-card>
                  <q-card-section>
                    <q-input
                      v-for="expensesUtilities in expensesUtilitiesList"
                      :key="expensesUtilities.id"
                      v-model.number="expensesUtilities.amount"
                      type="number"
                      :label="expensesUtilities.label"
                      :prefix="currencySymbol"
                      class="q-ml-sm q-mr-lg"
                    />
                  </q-card-section>
                </q-card>
              </q-expansion-item>

              <!-- medical & healthcare category -->
              <q-expansion-item
                :header-style="{ fontSize: '16px' }"
                header-class="text-weight-bold"
                dense
                label="Medical & Healthcare"
                :caption="`${expensesDict.partialExpenses.medical.toLocaleString('en-US', { style: 'currency', currency: currency, maximumFractionDigits: 0 })}/year`"
              >
                <q-card>
                  <q-card-section>
                    <q-input
                      v-for="expensesMedical in expensesMedicalList"
                      :key="expensesMedical.id"
                      v-model.number="expensesMedical.amount"
                      type="number"
                      :label="expensesMedical.label"
                      :prefix="currencySymbol"
                      class="q-ml-sm q-mr-lg"
                    />
                  </q-card-section>
                </q-card>
              </q-expansion-item>

              <!-- debt payments category -->
              <q-expansion-item
                :header-style="{ fontSize: '16px' }"
                header-class="text-weight-bold"
                dense
                label="Debt/loan Payments"
                :caption="`${expensesDict.partialExpenses.debtPayment.toLocaleString('en-US', { style: 'currency', currency: currency, maximumFractionDigits: 0 })}/year`"
              >
                <q-card>
                  <q-card-section>
                    <q-input
                      v-for="expensesDebtPayments in expensesDebtPaymentsList"
                      :key="expensesDebtPayments.id"
                      v-model.number="expensesDebtPayments.amount"
                      type="number"
                      :label="expensesDebtPayments.label"
                      :prefix="currencySymbol"
                      class="q-ml-sm q-mr-lg"
                    />
                  </q-card-section>
                </q-card>
              </q-expansion-item>

              <!-- personal spending category -->
              <q-expansion-item
                :header-style="{ fontSize: '16px' }"
                header-class="text-weight-bold"
                dense
                label="Personal Spending"
                :caption="`${expensesDict.partialExpenses.personalSpending.toLocaleString('en-US', { style: 'currency', currency: currency, maximumFractionDigits: 0 })}/year`"
              >
                <q-card>
                  <q-card-section>
                    <q-input
                      v-for="expensesPersonalSpending in expensesPersonalSpendingList"
                      :key="expensesPersonalSpending.id"
                      v-model.number="expensesPersonalSpending.amount"
                      type="number"
                      :label="expensesPersonalSpending.label"
                      :prefix="currencySymbol"
                      class="q-ml-sm q-mr-lg"
                    />
                  </q-card-section>
                </q-card>
              </q-expansion-item>

              <!-- recreation & Entertainment category -->
              <q-expansion-item
                :header-style="{ fontSize: '16px' }"
                header-class="text-weight-bold"
                dense
                label="Recreation & Entertainment"
                :caption="`${expensesDict.partialExpenses.entertainment.toLocaleString('en-US', { style: 'currency', currency: currency, maximumFractionDigits: 0 })}/year`"
              >
                <q-card>
                  <q-card-section>
                    <q-input
                      v-for="expensesEntertainment in expensesEntertainmentList"
                      :key="expensesEntertainment.id"
                      v-model.number="expensesEntertainment.amount"
                      type="number"
                      :label="expensesEntertainment.label"
                      :prefix="currencySymbol"
                      class="q-ml-sm q-mr-lg"
                    />
                  </q-card-section>
                </q-card>
              </q-expansion-item>

              <!-- Childcare category -->
              <q-expansion-item
                :header-style="{ fontSize: '16px' }"
                header-class="text-weight-bold"
                dense
                label="Childcare"
                :caption="`${expensesDict.partialExpenses.childcare.toLocaleString('en-US', { style: 'currency', currency: currency, maximumFractionDigits: 0 })}/year`"
              >
                <q-card>
                  <q-card-section>
                    <q-input
                      v-for="expensesChildcare in expensesChildcareList"
                      :key="expensesChildcare.id"
                      v-model.number="expensesChildcare.amount"
                      type="number"
                      :label="expensesChildcare.label"
                      :prefix="currencySymbol"
                      class="q-ml-sm q-mr-lg"
                    />
                  </q-card-section>
                </q-card>
              </q-expansion-item>

              <!-- miscellaneous category -->
              <q-expansion-item
                :header-style="{ fontSize: '16px' }"
                header-class="text-weight-bold"
                dense
                label="Miscellaneous"
                :caption="`${expensesDict.partialExpenses.miscellaneous.toLocaleString('en-US', { style: 'currency', currency: currency, maximumFractionDigits: 0 })}/year`"
              >
                <q-card>
                  <q-card-section>
                    <q-input
                      v-for="expensesMiscellaneous in expensesMiscellaneousList"
                      :key="expensesMiscellaneous.id"
                      v-model.number="expensesMiscellaneous.amount"
                      type="number"
                      :label="expensesMiscellaneous.label"
                      :prefix="currencySymbol"
                      class="q-ml-sm q-mr-lg"
                    />
                  </q-card-section>
                </q-card>
              </q-expansion-item>
            </q-card>
          </div>

          <!------------------------------------  SAVINGS ------------------------------------------------>
          <div v-if="annualMetricsTab === 'savings'">
            <q-card flat style="width: 500px; max-width: 80vw">
              <q-card-section>
                <!-- radio buttons - choose your savings rate -->
                <div>
                  <!-- lean saver -->
                  <q-item tag="label">
                    <q-item-section avatar>
                      <q-radio v-model="savingType" val="Lean saver" color="orange" />
                    </q-item-section>

                    <q-item-section>
                      <q-item-label style="font-size: 16px">Lean saver</q-item-label>
                      <q-item-label caption
                        >Lean Saver is the result of substracting your total expenses from your
                        total income</q-item-label
                      >
                    </q-item-section>
                  </q-item>

                  <!-- extreme saver -->
                  <q-item tag="label">
                    <q-item-section avatar>
                      <q-radio v-model="savingType" val="Extreme saver" color="orange" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label style="font-size: 16px">Extreme saver</q-item-label>
                      <q-item-label caption
                        >Extreme Saver is the result of substracting your "mandatory expenses" from
                        your total income
                      </q-item-label>
                    </q-item-section>
                  </q-item>

                  <!-- tailored saver -->
                  <q-item tag="label">
                    <q-item-section avatar>
                      <q-radio v-model="savingType" val="Tailored savings rate" color="orange" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label style="font-size: 16px">Tailored savings rate</q-item-label>
                      <q-item-label caption>Choose your own annual savings rate </q-item-label>
                      <q-input
                        v-model.number="UserSavingsRate"
                        type="number"
                        label="Annual savings rate"
                        :prefix="currencySymbol"
                      />
                    </q-item-section>
                  </q-item>
                </div>

                <!-- list with saving annual saving rates targets -->
                <div>
                  <q-list>
                    <q-item>
                      <q-item-section avatar
                        ><q-avatar namme="done" icon="done"></q-avatar
                      ></q-item-section>
                      <q-item-section style="font-size: 16px"
                        ><p>
                          Your annual savings rate target is:
                          <strong
                            >{{
                              annualSavingsRate.toLocaleString('en-US', {
                                style: 'currency',
                                currency: currency,
                                maximumFractionDigits: 0,
                              })
                            }}/year</strong
                          >
                        </p>
                      </q-item-section>
                    </q-item>

                    <q-item>
                      <q-item-section avatar
                        ><q-avatar namme="done" icon="done"></q-avatar
                      ></q-item-section>
                      <q-item-section style="font-size: 16px"
                        ><p>
                          Your are saving
                          <strong
                            >{{
                              annualSavingsRateRatio.ratioActiveIncome
                                .toLocaleString('en-US', { maximumFractionDigits: 1 })
                                .toString()
                            }}
                            %</strong
                          >
                          of your active income
                        </p>
                      </q-item-section>
                    </q-item>

                    <q-item>
                      <q-item-section avatar
                        ><q-avatar namme="done" icon="done"></q-avatar
                      ></q-item-section>
                      <q-item-section style="font-size: 16px"
                        ><p>
                          Your expenses are
                          <strong
                            >{{
                              annualSavingsRateRatio.ratioTotalExpenses
                                .toLocaleString('en-US', { maximumFractionDigits: 1 })
                                .toString()
                            }}
                            %</strong
                          >
                          of your active income
                        </p>
                      </q-item-section>
                    </q-item>
                  </q-list>
                </div>
              </q-card-section>
            </q-card>
          </div>
        </q-card-section>

        <!-- <hr style="width:85%"> -->

        <!-- submit form -->
        <q-card-section>
          <div class="q-mb-sm white-container" style="width: 100%; color: beige">
            <!-- year -->
            <q-select
              class="q-ml-md"
              v-model="year"
              :options="yearList"
              label="Select year"
              style="min-width: 125px"
            />

            <q-space />

            <!-- form submit button -->
            <q-btn
              v-if="seeVsEdit === 'edit'"
              class="q-mt-sm q-mr-sm"
              style="height: 75%"
              label="Save"
              type="submit"
              rounded
              color="orange"
              no-caps
              @click="submitAnnualMetrics()"
            />
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>
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
import { doc, setDoc, updateDoc } from 'firebase/firestore'
import * as math from 'mathjs'

// import and declare stores
import { useStoreAuth } from 'src/stores/storeAuth'
import { useStoreUserSettings } from 'src/stores/storeUserSettings'
import { useStoreKeyMetrics } from 'src/stores/storeKeyMetrics'
import { useStoreNetWorth } from 'src/stores/storeNetWorth'
import { useStoreInvestments } from 'src/stores/storeInvestments'
const storeAuth = useStoreAuth()
const storeUserSettings = useStoreUserSettings()
const storeKeyMetrics = useStoreKeyMetrics()
const storeNetWorth = useStoreNetWorth()
const storeInvestments = useStoreInvestments()

// get reactive data from stores
const { keyMetricsDocDict } = storeToRefs(storeKeyMetrics)
const { userSettings } = storeToRefs(storeUserSettings)
const { currencyString } = storeToRefs(storeUserSettings)
const { getBrokerageData } = storeToRefs(storeInvestments)

// props from parent component
const props = defineProps(['parentPropKeyMetrics'])

// props with watchers to react on a parent change
const incomeActiveList = ref(props.parentPropKeyMetrics.data.incomeDict.activeIncome)
const incomePassiveList = ref(props.parentPropKeyMetrics.data.incomeDict.passiveIncome)

const expensesHousingList = ref(props.parentPropKeyMetrics.data.expensesDict.housing)
const expensesTransportationList = ref(props.parentPropKeyMetrics.data.expensesDict.transportation)
const expensesGroceriesList = ref(props.parentPropKeyMetrics.data.expensesDict.groceries)
const expensesUtilitiesList = ref(props.parentPropKeyMetrics.data.expensesDict.utilities)
const expensesMedicalList = ref(props.parentPropKeyMetrics.data.expensesDict.medical)
const expensesDebtPaymentsList = ref(props.parentPropKeyMetrics.data.expensesDict.debtPayment)
const expensesPersonalSpendingList = ref(
  props.parentPropKeyMetrics.data.expensesDict.personalSpending,
)
const expensesEntertainmentList = ref(props.parentPropKeyMetrics.data.expensesDict.entertainment)
const expensesChildcareList = ref(props.parentPropKeyMetrics.data.expensesDict.childcare)
const expensesMiscellaneousList = ref(props.parentPropKeyMetrics.data.expensesDict.miscellaneous)

const savingType = ref(props.parentPropKeyMetrics.data.savingsDict.savingType)
const UserSavingsRate = ref(props.parentPropKeyMetrics.data.savingsDict.userSavingsRate)

const year = ref(props.parentPropKeyMetrics.year)

const keyMetricsDialog = ref(false)
const seeVsEdit = ref('see')

watch(
  () => props.parentPropKeyMetrics,
  (newData) => {
    incomeActiveList.value = newData.data.incomeDict.activeIncome
    incomePassiveList.value = newData.data.incomeDict.passiveIncome

    expensesHousingList.value = newData.data.expensesDict.housing
    expensesTransportationList.value = newData.data.expensesDict.transportation
    expensesGroceriesList.value = newData.data.expensesDict.groceries
    expensesUtilitiesList.value = newData.data.expensesDict.utilities
    expensesDebtPaymentsList.value = newData.data.expensesDict.debtPayment
    expensesMedicalList.value = newData.data.expensesDict.medical
    expensesPersonalSpendingList.value = newData.data.expensesDict.personalSpending
    expensesEntertainmentList.value = newData.data.expensesDict.entertainment
    expensesChildcareList.value = newData.data.expensesDict.childcare
    expensesMiscellaneousList.value = newData.data.expensesDict.miscellaneous

    savingType.value = newData.data.savingsDict.savingType
    UserSavingsRate.value = newData.data.savingsDict.userSavingsRate
    keyMetricsDialog.value = newData.dialog
    seeVsEdit.value = newData.seeVsEdit
    year.value = newData.year
  },
)

// stores variables
// eslint-disable-next-line prefer-const
const currency = userSettings.value.currency
const taxRate = userSettings.value.taxRate
const currencySymbol = currencyString.value

// declare useQuasar (to use the "notify" plugin)
const $q = useQuasar()

// emits -> to change the view back to the investmentsMainComponent
const emit = defineEmits(['close-new-key-metrics-entry'])

// to open and close the dialogs
const annualMetricsTab = ref('income')

// ------------------------------------------- INCOME SECTION --------------------------------------------
const incomeDict = computed(() => {
  const activeList = incomeActiveList.value.map((item) => item.amount)
  const passiveList = incomePassiveList.value.map((item) => item.amount)

  const incomeDict = {
    totalIncome: math.sum(activeList) + math.sum(passiveList),
    activeIncome: math.sum(activeList),
    passiveIncome: math.sum(passiveList),
  }

  return incomeDict
})

// ------------------------------------- get data from investments ---------------------------------------
const investmentSummary = getBrokerageData.value[1]

function updateFromInvestment(detailInvestment, i) {
  const amount = math.round(parseFloat(investmentSummary[detailInvestment].AnnualExpectedIncome))
  incomePassiveList.value[i].amount = amount * (1 - taxRate)
}

// ------------------------------------------- EXPENSES SECTION --------------------------------------------
const expensesDict = computed(() => {
  // re-arrange arrays to get only amounts
  const housingList = expensesHousingList.value.map((item) => item.amount)
  const transportationList = expensesTransportationList.value.map((item) => item.amount)
  const groceriesList = expensesGroceriesList.value.map((item) => item.amount)
  const utilitiesList = expensesUtilitiesList.value.map((item) => item.amount)
  const medicalList = expensesMedicalList.value.map((item) => item.amount)
  const debtPaymentsList = expensesDebtPaymentsList.value.map((item) => item.amount)
  const personalSpendingList = expensesPersonalSpendingList.value.map((item) => item.amount)
  const entertainmentList = expensesEntertainmentList.value.map((item) => item.amount)
  const childcareList = expensesChildcareList.value.map((item) => item.amount)
  const miscellaneousList = expensesMiscellaneousList.value.map((item) => item.amount)

  // calculations
  const housing = math.sum(housingList)
  const transportation = math.sum(transportationList)
  const groceries = math.sum(groceriesList)
  const utilities = math.sum(utilitiesList)
  const medical = math.sum(medicalList)
  const debtPayment = math.sum(debtPaymentsList)
  const personalSpending = math.sum(personalSpendingList)
  const entertainment = math.sum(entertainmentList)
  const childcare = math.sum(childcareList)
  const miscellaneous = math.sum(miscellaneousList)

  const regularExpenses =
    housing +
    transportation +
    groceries +
    utilities +
    medical +
    debtPayment +
    personalSpending +
    entertainment +
    childcare +
    miscellaneous
  const basicExpenses =
    housing + transportation + groceries + utilities + medical + debtPayment + childcare

  // return value
  const expensesDict = {
    partialExpenses: {
      housing,
      transportation,
      groceries,
      utilities,
      medical,
      debtPayment,
      personalSpending,
      entertainment,
      childcare,
      miscellaneous,
    },
    totalExpenses: {
      regularExpenses,
      basicExpenses,
    },
  }

  return expensesDict
})

// ------------------------------------------- SAVINGS SECTION --------------------------------------------
const annualSavingsRate = computed(() => {
  if (savingType.value === 'Lean saver') {
    return incomeDict.value.activeIncome - expensesDict.value.totalExpenses.regularExpenses
  } else if (savingType.value === 'Extreme saver') {
    return incomeDict.value.activeIncome - expensesDict.value.totalExpenses.basicExpenses
  } else {
    return parseFloat(UserSavingsRate.value)
  }
})

const annualSavingsRateRatio = computed(() => {
  const ratioActiveIncome = (annualSavingsRate.value / incomeDict.value.activeIncome) * 100
  const ratioTotalExpenses =
    (expensesDict.value.totalExpenses.regularExpenses / incomeDict.value.activeIncome) * 100

  const annualSavingsRateRatio = {
    ratioActiveIncome,
    ratioTotalExpenses,
  }

  return annualSavingsRateRatio
})

// --------------------------------------- SAVE TO FIRESTORE DDBB ------------------------------------------
const yearList = []
const today = new Date()
const yyyy = today.getFullYear()
for (let i = yyyy - 24; i < yyyy + 1; i++) {
  yearList.push(i)
}

// -------------- submit form to firebase ----------------------------
async function submitAnnualMetrics() {
  const yearString = year.value.toString()
  const dateEndYear = new Date(`${yearString}-12-31`)
  const timestamp = new Date(dateEndYear).getTime()

  const metricsIncomeDict = {
    year: year.value,
    timestamp,
    incomeDict: {
      activeIncome: incomeActiveList.value,
      passiveIncome: incomePassiveList.value,
      totalIncome: incomeDict.value.totalIncome,
    },
  }

  const metricsExpensesDict = {
    year: year.value,
    timestamp,
    expensesDict: {
      housing: expensesHousingList.value,
      transportation: expensesTransportationList.value,
      groceries: expensesGroceriesList.value,
      utilities: expensesUtilitiesList.value,
      medical: expensesMedicalList.value,
      debtPayment: expensesDebtPaymentsList.value,
      personalSpending: expensesPersonalSpendingList.value,
      entertainment: expensesEntertainmentList.value,
      childcare: expensesChildcareList.value,
      miscellaneous: expensesMiscellaneousList.value,
      totalExpenses: {
        regularExpenses: expensesDict.value.totalExpenses.regularExpenses,
        basicExpenses: expensesDict.value.totalExpenses.basicExpenses,
      },
    },
  }

  const metricsSavingsDict = {
    year: year.value,
    timestamp,
    savingsDict: {
      savingType: savingType.value,
      userSavingsRate: UserSavingsRate.value,
      annualSavingsRate: annualSavingsRate.value,
    },
  }
  // STEP 1. Check if networth collection has data:
  const keyMetricsKeys = computed(() => Object.keys(keyMetricsDocDict.value))

  // STEP 2. Save data to ddbb
  if (keyMetricsKeys.value.length === 0) {
    // when no data exists
    await setDoc(doc(db, 'users', storeAuth.user.id, 'keyMetrics', 'metricsIncomeDoc'), {
      [yearString]: metricsIncomeDict,
    })

    await setDoc(doc(db, 'users', storeAuth.user.id, 'keyMetrics', 'metricsExpensesDoc'), {
      [yearString]: metricsExpensesDict,
    })

    await setDoc(doc(db, 'users', storeAuth.user.id, 'keyMetrics', 'metricsSavingsDoc'), {
      [yearString]: metricsSavingsDict,
    })

    // STEP 3. Update userSettings "plan" value
    const networthUpdatedList = storeNetWorth.getAllNetWorthList
    const keyMetricsUpdatedList = storeKeyMetrics.getAllKeyMetricsList

    if (networthUpdatedList.length !== 0 && keyMetricsUpdatedList !== 0) {
      await updateDoc(doc(db, 'users', storeAuth.user.id), {
        plan: 'noPlan',
      })
    }

    // notify that form saving was done succesfully
    $q.notify({
      message: 'Data added to database',
      color: 'positive',
      icon: 'check_circle',
      timeout: 1000,
    })
  } else {
    // when data exists
    await updateDoc(doc(db, 'users', storeAuth.user.id, 'keyMetrics', 'metricsIncomeDoc'), {
      [yearString]: metricsIncomeDict,
    })

    await updateDoc(doc(db, 'users', storeAuth.user.id, 'keyMetrics', 'metricsExpensesDoc'), {
      [yearString]: metricsExpensesDict,
    })

    await updateDoc(doc(db, 'users', storeAuth.user.id, 'keyMetrics', 'metricsSavingsDoc'), {
      [yearString]: metricsSavingsDict,
    })
    // notify that form saving was done succesfully
    $q.notify({
      message: 'Data added to database',
      color: 'positive',
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
.q-expansion-item {
  border-radius: 15px;
  background: white;
  font-size: 20px;
  width: 95%;
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
