<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------ TEMPLATE --------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<template>
  <div>
    <div v-if="$q.screen.width > 400">
      <q-card class="my-card" style="width: 375px; height: 275px">
        <q-img :src="cardData.image" style="height: 160px">
          <div class="absolute-bottom text-h6 text-center text-weight-bold">
            {{ cardData.title }}
            <q-btn
              class="float-right"
              flat
              icon="o_visibility"
              @click="sendNavigationTabInfo(cardData.tab)"
              :to="cardData.view"
            />
          </div>
        </q-img>

        <q-card-section class="qy-m-none q-py-none" style="height: 100px">
          <div v-html="cardData.cardBody"></div>
        </q-card-section>
      </q-card>
    </div>

    <div v-else>
      <q-card style="min-width: 350px" flat>
        <q-img :src="cardData.image">
          <div class="absolute-bottom text-h6 text-center text-weight-bold">
            {{ cardData.title }}
            <q-btn
              class="float-right q-mr-sm"
              flat
              icon="o_visibility"
              @click="sendNavigationTabInfo(cardData.tab)"
              :to="cardData.view"
            />
          </div>
        </q-img>

        <q-card-section>
          <div v-html="cardData.cardBody"></div>
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------- SCRIPT ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<!-- eslint-disable no-unused-vars -->
<script setup>
import { defineProps } from 'vue'
import { storeToRefs } from 'pinia'

// import and declare stores
import { useStoreUserSettings } from 'src/stores/storeUserSettings'

// import and declare stores
const storeUserSettings = useStoreUserSettings()

// get reactive data from stores
const { userSettings } = storeToRefs(storeUserSettings)

const props = defineProps(['cardSummaryData'])
const cardData = props.cardSummaryData

function sendNavigationTabInfo(tab) {
  storeUserSettings.changeNavigationNames(tab)
}
</script>

<!------------------------------------------------------------------------------------------------------->
<!-------------------------------------------- STYLE ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<style scoped></style>
