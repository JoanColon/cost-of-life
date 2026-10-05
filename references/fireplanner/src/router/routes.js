const routes = [
  {
    path: '/',
    component: () => import('layouts/LoginLayout.vue'),
    children: [
      { path: '', name: 'login', component: () => import('pages/LoginPages/PageLogin.vue') },
    ],
  },

  // ----------------------------------------------------------------------------------------------------
  // ---------------------------------  FOOTER NAVBAR ROUTES --------------------------------------------
  // ----------------------------------------------------------------------------------------------------
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      {
        path: 'loading',
        name: 'loading',
        component: () => import('pages/NavBarPages/PageLoading.vue'),
      },
      { path: 'home', name: 'home', component: () => import('pages/NavBarPages/PageHome.vue') },
      {
        path: 'planner',
        name: 'planner',
        component: () => import('pages/NavBarPages/PagePlanner.vue'),
      },
      {
        path: 'progress',
        name: 'progress',
        component: () => import('pages/NavBarPages/PageProgress.vue'),
      },
      {
        path: 'community',
        name: 'community',
        component: () => import('pages/NavBarPages/PageCommunity.vue'),
      },
    ],
  },

  // ----------------------------------------------------------------------------------------------------
  // ---------------------------------------  LATERAL NAV ROUTES ----------------------------------------
  // ----------------------------------------------------------------------------------------------------
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      {
        path: 'settings',
        name: 'settings',
        component: () => import('pages/DrawerPages/PageSettings.vue'),
      },
      {
        path: 'pro',
        name: 'pro',
        component: () => import('pages/DrawerPages/PageUserPayment.vue'),
      },
      {
        path: 'disclaimer',
        name: 'disclaimer',
        component: () => import('pages/DrawerPages/PageDisclaimerContact.vue'),
      },
    ],
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
]

export default routes
