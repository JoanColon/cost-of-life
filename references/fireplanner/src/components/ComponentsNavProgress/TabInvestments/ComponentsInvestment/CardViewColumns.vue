<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------ TEMPLATE --------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<template>
  <div>
    <q-card style="width: 500px; max-width: 80vw; height: 100vh">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">Select columns to display</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <q-form
          class="q-pr-md"
          style="width: 100%; display: block"
          @submit.prevent="onSubmitShowTableColumns"
          @reset="onResetShowTableColumns"
        >
          <q-list dense v-for="element in columnsAllView" :key="element.value">
            <q-item>
              <q-checkbox
                v-model="visibleColumns"
                :val="element.value"
                :label="element.label"
                :color="element.color"
              />
            </q-item>
          </q-list>

          <!-- form submit button -->
          <div class="q-mt-md q-mb-sm q-mr-xs float-right">
            <q-btn style="height: 75%" label="Save" type="submit" rounded color="orange" no-caps />

            <!-- reset button -->
            <q-btn
              class="on-right"
              style="height: 75%"
              label="Reset"
              type="reset"
              rounded
              color="deep-orange"
              no-caps
            />
          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </div>
</template>

<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------- SCRIPT ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<script setup>
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useQuasar } from 'quasar'
import { db } from 'src/js/firebase'
import { doc, updateDoc } from 'firebase/firestore'

// import and declare stores
import { useStoreAuth } from 'src/stores/storeAuth'
import { useStoreUserSettings } from 'src/stores/storeUserSettings'

const storeAuth = useStoreAuth()
const storeUserSettings = useStoreUserSettings()

// get reactive data from stores
const { userSettings } = storeToRefs(storeUserSettings)

// declare useQuasar (to use the "notify" plugin)
const $q = useQuasar()

// props recieved from parent company (investmentTable component)
const props = defineProps(['columnsView'])

const investmentDetailName = ref(props.columnsView.investmentDetailName)
const columnsAllView = ref(props.columnsView.columnsAllview)
const visibleColumns = ref(props.columnsView.visibleColumns)
console.log(visibleColumns.value)

const investmentTableColumns = userSettings.value.investmentTableColumns

async function onSubmitShowTableColumns() {
  investmentTableColumns[investmentDetailName.value] = visibleColumns.value

  const userSettingsRef = doc(db, 'users', storeAuth.user.id)
  await updateDoc(userSettingsRef, {
    investmentTableColumns,
  })

  // notify that form saving was done succesfully
  $q.notify({
    message: 'user preferences updated',
    color: 'positive',
    icon: 'check_circle',
    timeout: 1000,
  })
}

async function onResetShowTableColumns() {
  console.log('adeu')
}
</script>

<!------------------------------------------------------------------------------------------------------->
<!-------------------------------------------- STYLE ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<style scoped></style>
