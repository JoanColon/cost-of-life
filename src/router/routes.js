const routes = [
  {
    path: '/',
    name: 'login',
    component: () => import('@/pages/LoginPage.vue'),
  },
  {
    path: '/invite/:token',
    name: 'workspace-invite',
    component: () => import('@/pages/WorkspaceInvitePage.vue'),
  },
  {
    path: '/home',
    component: () => import('@/layouts/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'home',
        component: () => import('@/pages/HomePage.vue'),
      },
      {
        path: 'workspaces/new',
        name: 'create-workspace',
        component: () => import('@/pages/CreateWorkspacePage.vue'),
      },
      {
        path: 'workspaces/:workspaceId',
        name: 'workspace-dashboard',
        component: () => import('@/pages/WorkspaceDashboardPage.vue'),
      },
      {
        path: 'workspaces/:workspaceId/assets',
        name: 'assets',
        component: () => import('@/pages/AssetsPage.vue'),
      },
      {
        path: 'workspaces/:workspaceId/assets/:category',
        name: 'asset-category',
        component: () => import('@/pages/AssetCategoryPage.vue'),
      },
      {
        path: 'workspaces/:workspaceId/liabilities',
        name: 'liabilities',
        component: () => import('@/pages/LiabilitiesPage.vue'),
      },
      {
        path: 'workspaces/:workspaceId/liabilities/:category',
        name: 'liability-category',
        component: () => import('@/pages/LiabilityCategoryPage.vue'),
      },
      {
        path: 'workspaces/:workspaceId/historic',
        name: 'historic',
        component: () => import('@/pages/HistoricPage.vue'),
      },
      {
        path: 'workspaces/:workspaceId/progress',
        name: 'progress',
        redirect: (to) => ({
          name: 'achievements',
          params: { workspaceId: to.params.workspaceId },
        }),
      },
      {
        path: 'workspaces/:workspaceId/achievements',
        name: 'achievements',
        component: () => import('@/pages/AchievementsPage.vue'),
      },
      {
        path: 'workspaces/:workspaceId/what-if',
        name: 'what-if',
        component: () => import('@/pages/WhatIfPage.vue'),
      },
      {
        path: 'workspaces/:workspaceId/what-if/strategy',
        name: 'what-if-strategy',
        component: () => import('@/pages/WhatIfStrategyPage.vue'),
      },
      {
        path: 'workspaces/:workspaceId/income',
        name: 'income',
        component: () => import('@/pages/IncomePage.vue'),
      },
      {
        path: 'workspaces/:workspaceId/income/:category',
        name: 'income-category',
        component: () => import('@/pages/IncomeCategoryPage.vue'),
      },
      {
        path: 'workspaces/:workspaceId/expenses',
        name: 'expenses',
        component: () => import('@/pages/ExpensesPage.vue'),
      },
      {
        path: 'workspaces/:workspaceId/expenses/tracker',
        name: 'expense-tracker',
        component: () => import('@/pages/ExpenseTrackerPage.vue'),
      },
      {
        path: 'workspaces/:workspaceId/expenses/:category',
        name: 'expense-category',
        component: () => import('@/pages/ExpenseCategoryPage.vue'),
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',

    name: 'not-found',
    component: () => import('@/pages/NotFoundPage.vue'),
  },
]

export default routes
