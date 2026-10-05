/* eslint-disable no-mixed-operators */
import { route } from 'quasar/wrappers'
import { useStoreAuth } from 'src/stores/storeAuth'
import {
  createRouter,
  createMemoryHistory,
  createWebHistory,
  createWebHashHistory,
} from 'vue-router'
import routes from './routes'

/*
 * If not building with SSR mode, you can
 * directly export the Router instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Router instance.
 */

export default route(function (/* { store, ssrContext } */) {
  const createHistory = process.env.SERVER
    ? createMemoryHistory
    : process.env.VUE_ROUTER_MODE === 'history'
      ? createWebHistory
      : createWebHashHistory

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,

    // Leave this as is and make changes in quasar.conf.js instead!
    // quasar.conf.js -> build -> vueRouterMode
    // quasar.conf.js -> build -> publicPath
    history: createHistory(process.env.VUE_ROUTER_BASE),
  })

  // Navigation guards unlogged users to access internal pages and logged users to access login/signup pages
  Router.beforeEach(async (to, from) => {
    const storeAuth = useStoreAuth()
    // if user is not logged in can only visit '/' and '/login'
    if (
      (!storeAuth.user.id && to.name === 'loading') ||
      (!storeAuth.user.id && to.name === 'home') ||
      (!storeAuth.user.id && to.name === 'planner') ||
      (!storeAuth.user.id && to.name === 'progress') ||
      (!storeAuth.user.id && to.name === 'community') ||
      (!storeAuth.user.id && to.name === 'userProfile') ||
      (!storeAuth.user.id && to.name === 'settings')
    ) {
      console.log('hey, guards working, user not logged in')
      return { name: 'login' }
    } else if (
      (!storeAuth.user.id && to.name === '') ||
      (!storeAuth.user.id && to.name === 'login')
    ) {
      console.log('navigating on a permitted page')
      return true
    }

    // if user is logged in does not allow to go to login page
    if (storeAuth.user.id && to.name === 'login') {
      console.log('please first logout to access login page')
      return false
    }
  })

  // code from UDEMY course apps with Dany (navigation guards)
  // Router.beforeEach(async (to, from) => {
  //   const storeAuth = useStoreAuth()
  //   if (!storeAuth.user.id && to.name !== 'login') {
  //     return { name: 'login' }
  //   }
  //   if ((storeAuth.user.id && to.name === 'login')) {
  //     return false
  //   }
  // })

  return Router
})

// import { route } from 'quasar/wrappers'
// import { createRouter, createMemoryHistory, createWebHistory, createWebHashHistory } from 'vue-router'
// import routes from './routes'

// /*
//  * If not building with SSR mode, you can
//  * directly export the Router instantiation;
//  *
//  * The function below can be async too; either use
//  * async/await or return a Promise which resolves
//  * with the Router instance.
//  */

// export default route(function (/* { store, ssrContext } */) {
//   const createHistory = process.env.SERVER
//     ? createMemoryHistory
//     : (process.env.VUE_ROUTER_MODE === 'history' ? createWebHistory : createWebHashHistory)

//   const Router = createRouter({
//     scrollBehavior: () => ({ left: 0, top: 0 }),
//     routes,

//     // Leave this as is and make changes in quasar.conf.js instead!
//     // quasar.conf.js -> build -> vueRouterMode
//     // quasar.conf.js -> build -> publicPath
//     history: createHistory(process.env.VUE_ROUTER_BASE)
//   })

//   return Router
// })
