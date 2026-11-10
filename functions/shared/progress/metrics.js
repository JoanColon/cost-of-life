/** Calculates bounded progress toward a positive target and whether it has been reached. */
export function calculateTargetProgress(currentValue, target, relevant = true) {
  const reached = relevant && currentValue >= target
  return {
    currentValue,
    progress: relevant ? boundedRatio(currentValue, target) : 0,
    reached,
    relevant,
  }
}

/** Calculates the binary progress rule for becoming strictly net-worth positive. */
export function calculatePositiveNetWorthProgress(netWorth) {
  const reached = Number(netWorth) > 0
  return { currentValue: netWorth, progress: Number(reached), reached, relevant: true }
}

/** Calculates bounded payoff progress from an initial debt balance to a current balance. */
export function calculateDebtReductionProgress(currentBalance, startingBalance) {
  const start = Math.max(0, Number(startingBalance) || 0)
  const current = Math.max(0, Number(currentBalance) || 0)
  const relevant = start > 0
  return {
    currentValue: current,
    startingValue: start,
    progress: relevant ? boundedRatio(start - current, start) : 0,
    reached: relevant && current <= 0,
    relevant,
  }
}

function boundedRatio(value, target) {
  if (!(target > 0)) return 0
  return Math.min(1, Math.max(0, Number(value || 0) / target))
}
