<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------ TEMPLATE --------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<template>
  <q-layout view="lHh Lpr lFf">
    <!------------------------------------- HEADER -------------------------------------------------->
    <q-header elevated>
      <q-toolbar>
        <q-btn flat dense round icon="menu" aria-label="Menu" @click="toggleLeftDrawer" />

        <q-toolbar-title> F.I.R.E planner </q-toolbar-title>

        <q-btn @click="storeAuth.logoutUser" flat round color="white" icon="logout"></q-btn>
      </q-toolbar>
    </q-header>

    <!-------------------------------------- DRAWER (lateral menu) ---------------------------------->
    <q-drawer
      v-model="leftDrawerOpen"
      :breakpoint="1500"
      bordered
      style="background-color: #e5e5e5"
    >
      <h5>Welcome!</h5>
      <q-list>
        <!-- User settings -->
        <q-item clickable v-ripple to="/settings">
          <q-item-section avatar>
            <q-icon style="color: black; font-size: 26px" name="settings" />
          </q-item-section>

          <q-item-section style="color: black; font-size: 18px">User settings</q-item-section>
        </q-item>

        <!-- Upgrade/Donate -->
        <q-item clickable v-ripple to="/pro">
          <q-item-section avatar>
            <q-icon style="color: black; font-size: 26px" name="shopping_cart" />
          </q-item-section>

          <q-item-section style="color: black; font-size: 18px">Upgrade/Donate</q-item-section>
        </q-item>

        <!-- Disclaimer/contact -->
        <q-item clickable v-ripple to="/disclaimer">
          <q-item-section avatar>
            <q-icon style="color: black; font-size: 26px" name="mail" />
          </q-item-section>

          <q-item-section style="color: black; font-size: 18px">Disclaimer/Contact</q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <!------------------------------------- ROUTER VIEW --------------------------------------------->
    <q-page-container>
      <router-view />
    </q-page-container>

    <!------------------------------- FOOTER (bottom navigation bar) -------------------------------->
    <q-footer reveal elevated>
      <q-tabs v-model="tab" dense no-caps align="center">
        <!-- Financial indicator TAB -->
        <q-route-tab name="Home" label="Home" icon="home" to="/home" />
        <q-route-tab name="Planner" label="Planner" icon="map" to="/planner" />
        <q-route-tab name="Progress" label="Progress" icon="bar_chart" to="/progress" />
        <q-route-tab name="Community" label="Community" icon="people" to="/community" />
      </q-tabs>
    </q-footer>
  </q-layout>
</template>

<!------------------------------------------------------------------------------------------------------->
<!------------------------------------------- SCRIPT ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<script setup>
import { ref } from 'vue'

// import and declare storeAuth
import { useStoreAuth } from 'src/stores/storeAuth'
const storeAuth = useStoreAuth()

// drawer code
const leftDrawerOpen = ref(false)

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value
}

// footer navigation code
const tab = ref('Home')
</script>

<!------------------------------------------------------------------------------------------------------->
<!-------------------------------------------- STYLE ---------------------------------------------------->
<!------------------------------------------------------------------------------------------------------->
<style scoped>
.q-header {
  background-color: #fca311;
}

.q-footer {
  background-color: #fca311;
}

.q-page-container {
  background-color: #e5e5e5;
}
</style>
