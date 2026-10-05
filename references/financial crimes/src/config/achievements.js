function badgeAsset(id) {
  return new URL(`../assets/badges/${id}.webp`, import.meta.url).href
}

export const achievementTypes = {
  ACHIEVEMENT: 'achievement',
  CONVICTION: 'conviction',
}

export const achievementEvaluationModes = {
  MONTHLY: 'monthly',
  IMMEDIATE: 'immediate',
  BOTH: 'both',
}

export const achievementDefinitions = [
  {
    id: 'under-control',
    name: 'UNDER CONTROL',
    type: achievementTypes.ACHIEVEMENT,
    evaluationMode: achievementEvaluationModes.MONTHLY,
    description: 'You caused less financial damage than last month.',
    requirement: 'Cause less financial damage than the previous completed month.',
    secret: false,
  },
  {
    id: 'clean-record',
    name: 'CLEAN RECORD',
    type: achievementTypes.ACHIEVEMENT,
    evaluationMode: achievementEvaluationModes.MONTHLY,
    description: 'Three months under your allowance. Suspiciously responsible.',
    requirement: 'Stay at or under allowance for three consecutive completed months.',
    secret: false,
  },
  {
    id: 'crime-preventer',
    name: 'CRIME PREVENTER',
    type: achievementTypes.ACHIEVEMENT,
    evaluationMode: achievementEvaluationModes.BOTH,
    description: 'Five crimes stopped before they happened.',
    requirement: 'Prevent five crimes in one completed month.',
    secret: false,
  },
  {
    id: 'reformed-criminal',
    name: 'REFORMED CRIMINAL',
    type: achievementTypes.ACHIEVEMENT,
    evaluationMode: achievementEvaluationModes.MONTHLY,
    description: 'Three months. Less damage every time. Rehabilitation might actually be working.',
    requirement: 'Reduce total damages for three consecutive completed months.',
    secret: false,
  },
  {
    id: 'zero-crime-day',
    name: 'ZERO CRIME DAY',
    type: achievementTypes.ACHIEVEMENT,
    evaluationMode: achievementEvaluationModes.BOTH,
    description: 'Seven days without committing a financial crime.',
    requirement: 'Go seven consecutive calendar days without a registered crime.',
    secret: false,
  },
  {
    id: 'probation-completed',
    name: 'PROBATION COMPLETED',
    type: achievementTypes.ACHIEVEMENT,
    evaluationMode: achievementEvaluationModes.MONTHLY,
    description: 'Back under the allowance. The court is willing to give you another chance.',
    requirement:
      'Go from over allowance to back at or under allowance in the next completed month.',
    secret: false,
  },
  {
    id: 'repeat-offender',
    name: 'REPEAT OFFENDER',
    type: achievementTypes.CONVICTION,
    evaluationMode: achievementEvaluationModes.BOTH,
    description: "Same crime. Fifth time. At this point, it's a lifestyle.",
    requirement: 'Commit the same stable crime type five times in one completed month.',
    secret: false,
  },
  {
    id: 'crime-spree',
    name: 'CRIME SPREE',
    type: achievementTypes.CONVICTION,
    evaluationMode: achievementEvaluationModes.BOTH,
    description: 'Five crimes in one day. Impressive, in the worst possible way.',
    requirement: 'Commit five crimes on the same calendar day.',
    secret: false,
  },
  {
    id: 'budget-killer',
    name: 'BUDGET KILLER',
    type: achievementTypes.CONVICTION,
    evaluationMode: achievementEvaluationModes.BOTH,
    description: 'The allowance never stood a chance.',
    requirement: 'Hit at least 125% of allowance in one completed month.',
    secret: false,
  },
  {
    id: 'no-remorse',
    name: 'NO REMORSE',
    type: achievementTypes.CONVICTION,
    evaluationMode: achievementEvaluationModes.MONTHLY,
    description: 'Three months. More damage every time. Absolutely no lessons learned.',
    requirement: 'Increase total damages for three consecutive completed months.',
    secret: false,
  },
  {
    id: 'serial-offender',
    name: 'SERIAL OFFENDER',
    type: achievementTypes.CONVICTION,
    evaluationMode: achievementEvaluationModes.BOTH,
    description: 'Ten crimes in the same category. This is no longer an isolated incident.',
    requirement: 'Commit ten crimes from the same category in one completed month.',
    secret: false,
  },
  {
    id: 'beyond-rehabilitation',
    name: 'BEYOND REHABILITATION',
    type: achievementTypes.CONVICTION,
    evaluationMode: achievementEvaluationModes.MONTHLY,
    description: 'Three months over allowance. The court has concerns.',
    requirement: 'Go over allowance for three consecutive completed months.',
    secret: false,
  },
].map((achievement) => ({
  ...achievement,
  asset: badgeAsset(achievement.id),
}))

export function getAchievementDefinition(id) {
  return achievementDefinitions.find((achievement) => achievement.id === id) || null
}
