<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------ TEMPLATE --------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<template>
  <div>
    <q-card style="width: 500px; max-width: 80vw">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">
          Delete <strong>{{ propsDelete.symbol }}</strong> orders
        </div>
        <p>Deleting table rows will only delete the selected order</p>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <!-- q-table -->
        <q-table :rows="rowsDelete" :columns="columnsDelete" row-key="name" dense>
          <!-- slot for the delete button in the delete row -->
          <template v-slot:body-cell-delete="props">
            <q-td :propsDeleteId="props">
              <q-btn
                dense
                round
                flat
                color="grey"
                @click="((propsDeleteId = props.row), deleteRow(propsDeleteId))"
                icon="delete"
              ></q-btn>
            </q-td>
          </template>
        </q-table>
      </q-card-section>

      <q-card-section>
        <div class="text-h6">
          Delete all <strong>{{ propsDelete.symbol }}</strong> information
        </div>
        <p>
          Clicking the deleted button will remove all orders and other symbol information
          (dividends, apiData, etc.)
        </p>
        <q-btn
          class="q-mt-sm q-mr-sm"
          style="height: 75%"
          label="Delete"
          rounded
          color="red"
          no-caps
          @click="DeleteSymbolAllInformation()"
        />
      </q-card-section>
    </q-card>
  </div>
</template>

<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------- SCRIPT ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<!-- eslint-disable no-unused-vars -->
<script setup>
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useQuasar } from 'quasar'
import { db } from 'src/js/firebase'
import { doc, updateDoc, deleteField, deleteDoc } from 'firebase/firestore'

// import and declare stores
import { useStoreAuth } from 'src/stores/storeAuth'
import { useStoreInvestments } from 'src/stores/storeInvestments'
const storeAuth = useStoreAuth()
const storeInvestments = useStoreInvestments()
const { allOrderList } = storeToRefs(storeInvestments)

// declare useQuasar (to use the "notify" plugin)
const $q = useQuasar()

// props recieved from parent company (investmentTable component)
const props = defineProps(['deleteOrderProps'])
const investmentDetailName = ref(props.deleteOrderProps.investmentDetailName)
const propsDelete = ref(props.deleteOrderProps.propsDelete)
const symbol = ref(props.deleteOrderProps.propsDelete.value.symbol)
const ordersList = ref(allOrderList.value[investmentDetailName.value])

// table columns to show
const columnsDelete = ref([])

switch (investmentDetailName.value) {
  case 'detailBrokerageAccount':
  case 'detailRealEstate':
  case 'detailFixedIncome':
  case 'detailCryptoAssets':
  case 'detailBusinessEquity':
    columnsDelete.value = [
      {
        name: 'date',
        label: 'Date',
        field: (row) => row.date,
        format: (val) => `${val}`,
        align: 'center',
      },
      {
        name: 'shares',
        label: 'Share amount',
        field: 'shares',
        align: 'center',
        format: (val) => `${val.toLocaleString('en-US', { maximumFractionDigits: 1 })}`,
      },
      {
        name: 'price',
        label: 'Order price',
        field: 'price',
        align: 'center',
        format: (val) =>
          `${val.toLocaleString('en-US', { style: 'currency', currency: propsDelete.value.currency, maximumFractionDigits: 1 })}`,
      },
      {
        name: 'totalTransaction',
        label: 'Transaction value',
        field: 'totalTransaction',
        align: 'center',
        sortable: true,
        format: (val) =>
          `${val.toLocaleString('en-US', { style: 'currency', currency: propsDelete.value.currency, maximumFractionDigits: 1 })}`,
      },
      { name: 'delete', label: 'Delete', field: '', align: 'center' },
    ]
    break
  case 'detailCashSavings':
  case 'detailOthers':
    columnsDelete.value = [
      {
        name: 'date',
        label: 'Date',
        field: (row) => row.date,
        format: (val) => `${val}`,
        align: 'center',
      },
      {
        name: 'totalTransaction',
        label: 'Transaction value',
        field: 'totalTransaction',
        align: 'center',
        format: (val) => `${val.toLocaleString('en-US', { maximumFractionDigits: 1 })}`,
      },
      { name: 'delete', label: 'Delete', field: '', align: 'center' },
    ]
}

// fill rows
const rowsDelete = computed(() => {
  const rowsDelete = []

  const orderSymbol = ordersList.value.filter(
    (element) => element.generalInfo.symbol === symbol.value,
  )[0].orderInfo
  const orderSymbolKeys = Object.keys(orderSymbol)
  const rowsToDelete = orderSymbolKeys.map((key) => orderSymbol[key])

  switch (investmentDetailName.value) {
    case 'detailBrokerageAccount':
    case 'detailRealEstate':
    case 'detailFixedIncome':
    case 'detailCryptoAssets':
    case 'detailBusinessEquity':
      rowsToDelete.forEach((element) => {
        const obj = {}
        obj.timestamp = element.timestamp
        obj.date = element.date
        obj.shares = element.shareAmount
        obj.price = element.sharePrice
        obj.totalTransaction = element.totalTransaction

        rowsDelete.push(obj)
      })
      break
    case 'detailCashSavings':
    case 'detailOthers':
      rowsToDelete.forEach((element) => {
        const obj = {}
        obj.timestamp = element.timestamp
        obj.date = element.date
        obj.totalTransaction = element.totalTransaction

        rowsDelete.push(obj)
      })
      break
  }
  return rowsDelete
})

const propsDeleteId = ref({})

// delete row
async function deleteRow(propsDeleteId) {
  const id = propsDeleteId.timestamp.toString()

  const orderRef = doc(db, 'users', storeAuth.user.id, investmentDetailName.value, symbol.value)
  await updateDoc(orderRef, {
    [`orderInfo.${id}`]: deleteField(),
  })

  // notify that form saving was done succesfully
  $q.notify({
    message: 'order deleted from database',
    color: 'warning',
    icon: 'check_circle',
    timeout: 1000,
  })
}

// -------------------------------- DELETE all info from the symbol ---------------------------------
async function DeleteSymbolAllInformation() {
  console.log('symbol deleted')
  const deleteRef = doc(db, 'users', storeAuth.user.id, investmentDetailName.value, symbol.value)
  await deleteDoc(deleteRef)

  rowsDelete.value = []

  // notify that form saving was done succesfully
  $q.notify({
    message: 'Symbol deleted succesfully',
    color: 'warning',
    icon: 'check_circle',
    timeout: 1000,
  })
}
</script>

<!------------------------------------------------------------------------------------------------------->
<!-------------------------------------------- STYLE ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<style scoped></style>
