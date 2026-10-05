<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------ TEMPLATE --------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<template>
  <div style="max-width: 1000px; margin: auto">
    <!-- desktop only section -->
    <div class="q-mt-sm cardList" v-if="$q.screen.width > 1021">
      <q-list v-for="card in cardsInfo" :key="card.id">
        <q-item>
          <q-card class="my-card" style="height: 100px">
            <q-item>
              <q-item-section avatar>
                <q-item-label align="center"
                  ><p style="font-size: 14px">
                    <strong>{{ card.title }}</strong>
                  </p></q-item-label
                >
                <q-img :src="card.icon" style="height: 50px; width: 50px" />
              </q-item-section>

              <q-item-section class="q-mt-md">
                <q-item-label caption
                  >{{ card.subtitleOne }}<strong>{{ card.amountOne }}</strong></q-item-label
                >
                <q-item-label caption
                  >{{ card.subtitleTwo }}<strong>{{ card.amountTwo }}</strong></q-item-label
                >
                <q-item-label caption
                  >{{ card.subtitleThree }}<strong>{{ card.amountThree }}</strong></q-item-label
                >
                <q-item-label caption
                  >{{ card.subtitleFourth }}<strong>{{ card.amountFourth }}</strong></q-item-label
                >
              </q-item-section>
            </q-item>
          </q-card>
        </q-item>
      </q-list>
    </div>

    <div class="q-mt-sm cardList" v-else-if="$q.screen.width > 780">
      <q-list v-for="card in cardsInfo" :key="card.id">
        <q-item>
          <q-card class="my-card" style="height: 135px">
            <q-item class="q-mt-none">
              <q-item-section class="q-mt-xs">
                <q-item-label align="center"
                  ><p style="font-size: 14px">
                    <strong>{{ card.title }}</strong>
                  </p></q-item-label
                >
                <q-item-label caption
                  >{{ card.subtitleOne }}<strong>{{ card.amountOne }}</strong></q-item-label
                >
                <q-item-label caption
                  >{{ card.subtitleTwo }}<strong>{{ card.amountTwo }}</strong></q-item-label
                >
                <q-item-label caption
                  >{{ card.subtitleThree }}<strong>{{ card.amountThree }}</strong></q-item-label
                >
                <q-item-label caption
                  >{{ card.subtitleFourth }}<strong>{{ card.amountFourth }}</strong></q-item-label
                >
              </q-item-section>
            </q-item>
          </q-card>
        </q-item>
      </q-list>
    </div>

    <!-- mobile only section -->
    <div v-else>
      <q-carousel
        v-model="slide"
        swipeable
        animated
        control-color="orange"
        navigation
        height="200px"
      >
        <q-carousel-slide
          v-for="card in cardsInfo"
          :key="card.id"
          :name="card.title"
          class="column no-wrap flex-center"
        >
          <div class="row" style="display: inline-block">
            <q-avatar class="q-mr-lg" style="vertical-align: middle">
              <q-img :src="card.icon" />
            </q-avatar>

            <p style="font-size: 14px; display: inline-block; vertical-align: middle">
              <strong>{{ card.title }}</strong>
            </p>
          </div>

          <div class="row q-mb-lg">
            <q-item>
              <q-item-section>
                <q-item-label caption
                  >{{ card.subtitleOne }}<strong>{{ card.amountOne }}</strong></q-item-label
                >
                <q-item-label caption
                  >{{ card.subtitleTwo }}<strong>{{ card.amountTwo }}</strong></q-item-label
                >
                <q-item-label caption
                  >{{ card.subtitleThree }}<strong>{{ card.amountThree }}</strong></q-item-label
                >
                <q-item-label caption
                  >{{ card.subtitleFourth }}<strong>{{ card.amountFourth }}</strong></q-item-label
                >
              </q-item-section>
            </q-item>
          </div>
        </q-carousel-slide>
      </q-carousel>
    </div>
  </div>
</template>

<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------- SCRIPT ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<!-- eslint-disable no-unused-vars -->
<script setup>
import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'

const $q = useQuasar()

// const props = defineProps(['cardsInfo'])
const props = defineProps(['cardPropsData'])
const cardsInfo = ref(props.cardPropsData.cardsInfo)

watch(props, (newData) => {
  cardsInfo.value = newData.cardPropsData.cardsInfo
})

// carrousel for mobile
const slide = ref('Portofolio')
</script>

<!------------------------------------------------------------------------------------------------------->
<!-------------------------------------------- STYLE ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<style scoped>
.cardList {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
}
</style>
