const dashboardVariants = [
  {
    annualCost: 18960,
    monthlyCost: 1580,
    income: 25400,
    freeCashFlow: 6440,
    savingsRate: 25,
    netWorth: 238400,
    assets: 267900,
    liabilities: 29500,
  },
  {
    annualCost: 12880,
    monthlyCost: 1073,
    income: 18155,
    freeCashFlow: 5275,
    savingsRate: 29,
    netWorth: 174648,
    assets: 198798,
    liabilities: 24150,
  },
]

const combinedDashboard = {
  annualCost: 31840,
  monthlyCost: 2653,
  income: 43555,
  freeCashFlow: 11715,
  savingsRate: 27,
  netWorth: 413048,
  assets: 466698,
  liabilities: 53650,
}

const milestones = [
  {
    id: 'home',
    icon: 'home',
    titleKey: 'dashboard.milestones.home',
    current: 120000,
    goal: 250000,
  },
  {
    id: 'sabbatical',
    icon: 'beach_access',
    titleKey: 'dashboard.milestones.sabbatical',
    current: 12000,
    goal: 12000,
  },
]

const scenarios = [
  { id: 'salary', icon: 'business_center', titleKey: 'dashboard.scenarios.salary', tone: 'blue' },
  { id: 'home', icon: 'home', titleKey: 'dashboard.scenarios.home', tone: 'green' },
  { id: 'baby', icon: 'child_care', titleKey: 'dashboard.scenarios.baby', tone: 'purple' },
]

export function getMockDashboard(selectedMemberId, memberIds) {
  const metrics =
    selectedMemberId === 'all' && memberIds.length > 1
      ? combinedDashboard
      : dashboardVariants[
          Math.max(memberIds.indexOf(selectedMemberId), 0) % dashboardVariants.length
        ]

  return {
    ...metrics,
    costRatio: Math.round((metrics.annualCost / metrics.income) * 100),
    milestones,
    scenarios,
  }
}
