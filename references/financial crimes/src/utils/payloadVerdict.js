export function buildVerdictPayload({
  verdict,
  stats,
  previousStats,
  periodMode,
  periodLabel,
  currency,
  courtStrictness,
  aggravatingCircumstances,
  mitigatingCircumstances,
}) {
  const previousTotalDamages = previousStats.totalDamages
  const totalDamageChange = stats.totalDamages - previousTotalDamages
  const totalDamageChangePercent = previousTotalDamages
    ? Math.round((totalDamageChange / previousTotalDamages) * 100)
    : null
  const mostWantedCategory = stats.mostWantedCategory

  return {
    verdict: {
      id: verdict.id,
      status: verdict.status,
      title: verdict.title,
      quote: verdict.quote,
      severity: verdict.severity,
    },
    period: {
      key: stats.period.key,
      mode: periodMode,
      label: periodLabel,
    },
    stats: {
      crimesCommitted: stats.crimesCommitted,
      totalDamages: stats.totalDamages,
      averageCrime: stats.averageCrime,
      biggestCrime: stats.biggestCrime,
      unreportedDamages: stats.unreportedDamages,
      cleanStreak: stats.cleanStreak,
      damagesPrevented: stats.damagesPrevented,
      allowance: stats.allowance,
      allowanceRemaining: stats.allowanceRemaining,
      allowanceConsumed: stats.allowanceConsumed,
      allowanceExceededBy: stats.allowanceExceededBy,
      previousMonth: {
        crimesCommitted: previousStats.crimesCommitted,
        totalDamages: previousTotalDamages,
        damageChange: totalDamageChange,
        damageChangePercent: totalDamageChangePercent,
      },
      mostWantedCategory: mostWantedCategory
        ? {
            id: mostWantedCategory.id,
            label: mostWantedCategory.label,
            shortLabel: mostWantedCategory.shortLabel,
            amount: mostWantedCategory.amount,
            count: mostWantedCategory.count,
            pendingCount: mostWantedCategory.pendingCount,
          }
        : null,
      topCategories: stats.categoryTotals.slice(0, 3).map((category) => ({
        id: category.id,
        label: category.label,
        shortLabel: category.shortLabel,
        amount: category.amount,
        count: category.count,
        pendingCount: category.pendingCount,
      })),
    },
    context: {
      currency,
      courtStrictness,
      aggravatingCircumstances,
      mitigatingCircumstances,
    },
  }
}
