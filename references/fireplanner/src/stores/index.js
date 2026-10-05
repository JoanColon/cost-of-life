import { store } from 'quasar/wrappers'
import { createPinia } from 'pinia'

// my imports fo be able to add the pinia plugin below
import { markRaw } from 'vue'
import router from 'src/router' // without curly brackets, see answer 8 of https://stackoverflow.com/questions/65858930/does-not-provide-an-export-named-createrouter-vue-3-vite-and-vue-router

/*
 * If not building with SSR mode, you can
 * directly export the Store instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Store instance.
 */

export default store((/* { ssrContext } */) => {
  const pinia = createPinia()

  // You can add Pinia plugins here
  // pinia.use(SomePiniaPlugin)

  // plugin added myself from lesson 144 Vue JS course make apps with Danny
  pinia.use(({ store }) => {
    store.router = markRaw(router)
  })

  return pinia
})
