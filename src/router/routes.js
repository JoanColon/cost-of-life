import AppLayout from '@/layouts/AppLayout.vue'
import AssetCategoryPage from '@/pages/AssetCategoryPage.vue'
import AssetsPage from '@/pages/AssetsPage.vue'
import CreateWorkspacePage from '@/pages/CreateWorkspacePage.vue'
import HomePage from '@/pages/HomePage.vue'
import LoginPage from '@/pages/LoginPage.vue'
import LiabilitiesPage from '@/pages/LiabilitiesPage.vue'
import LiabilityCategoryPage from '@/pages/LiabilityCategoryPage.vue'
import NotFoundPage from '@/pages/NotFoundPage.vue'
import WorkspaceDashboardPage from '@/pages/WorkspaceDashboardPage.vue'
import WorkspaceSectionPage from '@/pages/WorkspaceSectionPage.vue'

const routes = [
  {
    path: '/',
    name: 'login',
    component: LoginPage,
  },
  {
    path: '/home',
    component: AppLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'home',
        component: HomePage,
      },
      {
        path: 'workspaces/new',
        name: 'create-workspace',
        component: CreateWorkspacePage,
      },
      {
        path: 'workspaces/:workspaceId',
        name: 'workspace-dashboard',
        component: WorkspaceDashboardPage,
      },
      {
        path: 'workspaces/:workspaceId/assets',
        name: 'assets',
        component: AssetsPage,
      },
      {
        path: 'workspaces/:workspaceId/assets/:category',
        name: 'asset-category',
        component: AssetCategoryPage,
      },
      {
        path: 'workspaces/:workspaceId/liabilities',
        name: 'liabilities',
        component: LiabilitiesPage,
      },
      {
        path: 'workspaces/:workspaceId/liabilities/:category',
        name: 'liability-category',
        component: LiabilityCategoryPage,
      },
      {
        path: 'workspaces/:workspaceId/cost-of-life',
        name: 'cost-of-life',
        component: WorkspaceSectionPage,
        meta: { sectionTitleKey: 'dashboard.costOfLife.title' },
      },
      {
        path: 'workspaces/:workspaceId/financial-position',
        name: 'financial-position',
        component: WorkspaceSectionPage,
        meta: { sectionTitleKey: 'dashboard.financialPosition.title' },
      },
      {
        path: 'workspaces/:workspaceId/milestones',
        name: 'milestones',
        component: WorkspaceSectionPage,
        meta: { sectionTitleKey: 'dashboard.milestones.title' },
      },
      {
        path: 'workspaces/:workspaceId/what-if',
        name: 'what-if',
        component: WorkspaceSectionPage,
        meta: { sectionTitleKey: 'dashboard.whatIf.title' },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: NotFoundPage,
  },
]

export default routes
