<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------ TEMPLATE --------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<template>
  <div style="max-width: 1000px">
    <div class="row" style="width: 100vw; max-width: 850px">
      <!----------------------------------- List of valuation models ------------------------------------->
      <div class="col-6">
        <q-list class="q-mt-lg q-mr-lg">
          <q-item v-for="(item, index) in listItemsDetails" :key="index">
            <q-item-section avatar><q-avatar :icon="item.icon" /></q-item-section>
            <q-item-section>{{ item.name }}</q-item-section>
            <q-item-section class="text-center">RESULT</q-item-section>
            <q-item-section style="flex: 0 0 20px; max-width: 20px">
              <q-btn
                flat
                icon="edit"
                style="width: 20px; height: 20px; padding: 0"
                @click="
                  valuationName = item.name
                  openModal = true
                "
              />
            </q-item-section>
          </q-item>
        </q-list>
      </div>

      <!----------------------------------- card results ------------------------------------->
      <div class="col-6">
        <q-card class="q-ml-lg" style="width: 90%; min-width: 300px">
          <q-item>
            <q-item-section avatar><q-avatar icon="query_stats" /></q-item-section>
            <q-item-section>
              <q-item-label class="text-h6">Valuation results</q-item-label>
              <q-item-label caption>should you buy it?</q-item-label>
            </q-item-section>
          </q-item>

          <q-card-section>
            <q-list>
              <q-item>
                <q-item-section avatar><q-avatar icon="query_stats" /></q-item-section>
                <q-item-section>Intrinsic value:</q-item-section>
              </q-item>

              <q-item>
                <q-item-section avatar><q-avatar icon="attach_money" /></q-item-section>
                <q-item-section>Current price:</q-item-section>
              </q-item>

              <q-item>
                <q-item-section avatar><q-avatar icon="local_hospital" /></q-item-section>
                <q-item-section>
                  <div
                    style="
                      display: flex;
                      justify-content: space-between;
                      align-items: center;
                      width: 100%;
                    "
                  >
                    <span>Margin of safety:</span>
                    <q-input type="number" style="width: 100px">
                      <template v-slot:append><div class="text-caption">%</div></template>
                    </q-input>
                  </div>
                </q-item-section>
              </q-item>

              <q-item>
                <q-item-section avatar><q-avatar icon="shopping_cart" /></q-item-section>
                <q-item-section>Acceptable buy price:</q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!----------------------------------- modal with model input data ------------------------------------->
    <q-dialog v-model="openModal">
      <!----------------------- Grahams valuation model ----------------------------->
      <q-card v-if="valuationName === 'Grahams valuation model'">
        <q-card-section class="row items-center">
          <div class="text-h6">Grahams valuation model</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section class="q-pt-none">
          <!-- EPS -->
          <div style="display: flex">
            <q-input
              class="q-ml-md q-pr-md"
              v-model.number="gvmInitData.eps"
              type="number"
              readonly
              label="Default EPS"
            >
              <template v-slot:append><p class="text-body2">$</p></template>
            </q-input>

            <q-input
              class="q-ml-md"
              v-model.number="gvmUserData.eps"
              type="number"
              label="User EPS"
            >
              <template v-slot:append><p class="text-body2">$</p></template>
            </q-input>
          </div>

          <!-- Growth rate -->
          <div style="display: flex">
            <q-input
              class="q-ml-md q-pr-md"
              v-model.number="gvmInitData.g"
              type="number"
              readonly
              label="Default EPS growth rate"
            >
              <template v-slot:append><p class="text-body2">%</p></template>
            </q-input>

            <q-input
              class="q-ml-md"
              v-model.number="gvmUserData.g"
              type="number"
              label="User EPS growth rate"
            >
              <template v-slot:append><p class="text-body2">%</p></template>
            </q-input>
          </div>

          <!-- Bond yield -->
          <div style="display: flex">
            <q-input
              class="q-ml-md q-pr-md"
              v-model.number="gvmInitData.y"
              type="number"
              readonly
              label="Default AAA bond yield"
            >
              <template v-slot:append><p class="text-body2">%</p></template>
            </q-input>

            <q-input
              class="q-ml-md"
              v-model.number="gvmUserData.y"
              type="number"
              label="User AAA bond yield"
            >
              <template v-slot:append><p class="text-body2">%</p></template>
            </q-input>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn style="height: 75%" label="calculate" rounded color="orange" no-caps />
        </q-card-actions>
      </q-card>

      <!----------------------- Discounted cashflow valuation ----------------------------->
      <q-card v-else-if="valuationName === 'Discounted cashflow valuation'">
        <q-card-section class="row items-center">
          <div class="text-h6">Discounted cashflow valuation model</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section class="q-pt-none">
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Rerum repellendus sit voluptate
          voluptas eveniet porro. Rerum blanditiis perferendis totam, ea at omnis vel numquam
          exercitationem aut, natus minima, porro labore.
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="OK" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>

      <!----------------------- Dividend discount model ----------------------------->
      <q-card v-else-if="valuationName === 'Dividend discount model'">
        <q-card-section class="row items-center">
          <div class="text-h6">Dividend discount model</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section class="q-pt-none">
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Rerum repellendus sit voluptate
          voluptas eveniet porro. Rerum blanditiis perferendis totam, ea at omnis vel numquam
          exercitationem aut, natus minima, porro labore.
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="OK" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>

      <!----------------------- Multiples valuation model ----------------------------->
      <q-card v-else>
        <q-card-section class="row items-center">
          <div class="text-h6">Multiples valuation model</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section class="q-pt-none">
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Rerum repellendus sit voluptate
          voluptas eveniet porro. Rerum blanditiis perferendis totam, ea at omnis vel numquam
          exercitationem aut, natus minima, porro labore.
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="OK" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------- SCRIPT ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<script setup>
import { ref, computed } from 'vue'

import {
  grahamsValuationModel,
  discountCashFlowModel,
  dividendDiscountModel,
  multiplesValuationModel,
} from 'src/js/valuationModels'

const listItemsDetails = [
  {
    name: 'Grahams valuation model',
    icon: 'filter_1',
  },
  {
    name: 'Discounted cashflow valuation',
    icon: 'filter_2',
  },
  {
    name: 'Dividend discount model',
    icon: 'filter_3',
  },
  {
    name: 'Multiples valuation model',
    icon: 'filter_4',
  },
]

const openModal = ref(false)
const valuationName = ref('test')

// Graham valuation model
const gvmInitData = computed(() => {
  const initData = {
    eps: 9.65,
    g: 16, // growth rate projections
    y: 3.48, // current yield of AAA bonds
  }

  return initData
})

const gvmUserData = computed(() => {
  // get data from database
  const userEPS = null
  const userG = null
  const userY = null

  const userData = {
    eps: userEPS != null ? userEPS : gvmInitData.value.eps,
    g: userG != null ? userG : gvmInitData.value.g,
    y: userY != null ? userY : gvmInitData.value.y,
  }

  return userData
})

const grahamsValuationModelResult = computed(() => {
  const data = {
    eps: gvmUserData.value.eps,
    g: gvmUserData.value.g,
    y: gvmUserData.value.y,
  }

  const valuation = grahamsValuationModel(data)

  return valuation
})
const discountCashflowModelResult = discountCashFlowModel('hey')
const dividendDiscountModelResult = dividendDiscountModel('hey')
const multiplesValuationModelResult = multiplesValuationModel('hey')
console.log('grahamsValuationModelResult:', grahamsValuationModelResult.value)
console.log('discountCashflowModelResult:', discountCashflowModelResult)
console.log('dividendDiscountModelResult:', dividendDiscountModelResult)
console.log('multiplesValuationModelResult:', multiplesValuationModelResult)
</script>

<!------------------------------------------------------------------------------------------------------->
<!-------------------------------------------- STYLE ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<style scoped></style>
