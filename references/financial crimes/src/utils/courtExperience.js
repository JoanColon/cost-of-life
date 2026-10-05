export function calculateFutureValue({ monthlyContribution, annualRate, years }) {
  const monthlyRate = annualRate / 100 / 12
  const months = years * 12

  if (!monthlyContribution || !months) return 0
  if (!monthlyRate) return monthlyContribution * months

  return monthlyContribution * (((1 + monthlyRate) ** months - 1) / monthlyRate)
}

export function getBehaviourInsight(metrics, previousMetrics, periodMode = 'month') {
  if (!previousMetrics || previousMetrics.totalDamages === 0) {
    return null
  }

  const diff = metrics.totalDamages - previousMetrics.totalDamages
  const percent = Math.round((diff / previousMetrics.totalDamages) * 100)
  const comparisonUnit = periodMode === 'year' ? 'year' : 'month'

  if (percent <= -5) {
    return {
      title: 'SIGNS OF REHABILITATION DETECTED',
      text: `Damages decreased ${Math.abs(percent)}% compared with the previous ${comparisonUnit}.`,
    }
  }

  if (percent >= 5) {
    return {
      title: 'ESCALATING CRIMINAL BEHAVIOUR',
      text: `Financial Crimes increased ${percent}% compared with the previous ${comparisonUnit}.`,
    }
  }

  return {
    title: 'BEHAVIOUR REMAINS SUSPICIOUSLY STABLE',
    text: `The financial misconduct is almost unchanged compared with the previous ${comparisonUnit}.`,
  }
}

export function generateVerdict(metrics) {
  const allowancePressure = metrics.allowanceConsumed || 0

  if (!metrics.crimesCommitted) {
    return {
      id: 'dismissed',
      status: 'not-guilty',
      title: 'CASE DISMISSED',
      quote: 'The court finds no suspicious spending to prosecute.',
      severity: 0,
    }
  }

  if (allowancePressure > 1.1) {
    return {
      id: 'guilty',
      status: 'guilty',
      title: 'GUILTY',
      quote: 'The budget pleaded for mercy. The receipts did not.',
      severity: 3,
    }
  }

  if (allowancePressure >= 0.9) {
    return {
      id: 'probation',
      status: 'probation',
      title: 'ON PROBATION',
      quote: 'The court sees potential, and a few questionable choices.',
      severity: 2,
    }
  }

  return {
    id: 'not-guilty',
    status: 'not-guilty',
    title: 'NOT GUILTY',
    quote: 'Suspiciously responsible behavior. Case dismissed.',
    severity: 1,
  }
}
