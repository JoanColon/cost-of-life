const MAX_SCHEDULE_MONTHS = 1_200

export function monthlyInterestRate(annualInterestRate) {
  const annualRate = finiteNonNegativeNumber(annualInterestRate, 'annual interest rate')
  return annualRate / 100 / 12
}

export function calculateFrenchMonthlyPayment({ principal, annualInterestRate, termMonths }) {
  const amount = finiteNonNegativeNumber(principal, 'principal')
  const months = positiveInteger(termMonths, 'term months')
  if (amount === 0) return 0

  const rate = monthlyInterestRate(annualInterestRate)
  if (rate === 0) return roundMoney(amount / months)

  return roundMoney((amount * rate) / (1 - Math.pow(1 + rate, -months)))
}

export function buildFrenchAmortizationSchedule({
  currentBalance,
  annualInterestRate,
  monthlyPayment,
  extraMonthlyPayment = 0,
  asOfDate = new Date(),
}) {
  let balance = roundMoney(finiteNonNegativeNumber(currentBalance, 'current balance'))
  const regularPayment = roundMoney(finiteNonNegativeNumber(monthlyPayment, 'monthly payment'))
  const extraPayment = roundMoney(
    finiteNonNegativeNumber(extraMonthlyPayment, 'extra monthly payment'),
  )
  const rate = monthlyInterestRate(annualInterestRate)
  const projectionDate = canonicalDate(asOfDate)

  if (balance === 0) return []
  if (regularPayment === 0) throw new RangeError('A positive monthly payment is required')

  const schedule = []
  for (let paymentNumber = 1; paymentNumber <= MAX_SCHEDULE_MONTHS; paymentNumber += 1) {
    const interest = roundMoney(balance * rate)
    const plannedPayment = roundMoney(regularPayment + extraPayment)
    const payment = roundMoney(Math.min(plannedPayment, balance + interest))
    const principal = roundMoney(Math.min(balance, payment - interest))

    if (principal <= 0) {
      throw new RangeError('The monthly payment does not cover the accrued interest')
    }

    balance = roundMoney(Math.max(0, balance - principal))
    schedule.push({
      paymentNumber,
      date: addUtcMonths(projectionDate, paymentNumber),
      payment,
      interest,
      principal,
      remainingBalance: balance,
    })

    if (balance === 0) return schedule
  }

  throw new RangeError('The mortgage cannot be repaid within the supported projection period')
}

export function calculateMortgageProjection({ extraMonthlyPayment = 0, ...mortgage }) {
  const schedule = buildFrenchAmortizationSchedule(mortgage)
  const acceleratedSchedule = buildFrenchAmortizationSchedule({
    ...mortgage,
    extraMonthlyPayment,
  })
  const totalRemainingInterest = scheduleTotalInterest(schedule)
  const acceleratedInterest = scheduleTotalInterest(acceleratedSchedule)

  return {
    monthlyRate: monthlyInterestRate(mortgage.annualInterestRate),
    monthlyPayment: roundMoney(Number(mortgage.monthlyPayment) || 0),
    nextPayment: schedule[0] || null,
    remainingPayments: schedule.length,
    payoffDate: schedule.at(-1)?.date || null,
    totalRemainingInterest,
    schedule,
    accelerated: {
      extraMonthlyPayment: roundMoney(Number(extraMonthlyPayment) || 0),
      remainingPayments: acceleratedSchedule.length,
      payoffDate: acceleratedSchedule.at(-1)?.date || null,
      totalRemainingInterest: acceleratedInterest,
      monthsEarlier: Math.max(0, schedule.length - acceleratedSchedule.length),
      interestSaved: roundMoney(Math.max(0, totalRemainingInterest - acceleratedInterest)),
      schedule: acceleratedSchedule,
    },
  }
}

export function mortgageDetailFromLiability(liability) {
  const detail = liability?.detail?.mortgage
  if (!detail || detail.amortizationType !== 'french' || detail.fixedRate !== true) return null

  return {
    originalPrincipal: detail.originalPrincipal,
    currentBalance: liability.balance,
    annualInterestRate: detail.annualInterestRate,
    monthlyPayment: detail.monthlyPayment,
    startDate: detail.startDate,
    termMonths: detail.termMonths,
    amortizationType: detail.amortizationType,
    fixedRate: detail.fixedRate,
  }
}

function scheduleTotalInterest(schedule) {
  return roundMoney(schedule.reduce((total, payment) => total + payment.interest, 0))
}

function finiteNonNegativeNumber(value, label) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) throw new RangeError(`A valid ${label} is required`)
  return number
}

function positiveInteger(value, label) {
  const number = Number(value)
  if (!Number.isInteger(number) || number <= 0) throw new RangeError(`A valid ${label} is required`)
  return number
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

function canonicalDate(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()))
  }

  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) throw new RangeError('A valid projection date is required')
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() !== Number(match[2]) - 1 ||
    date.getUTCDate() !== Number(match[3])
  ) {
    throw new RangeError('A valid projection date is required')
  }
  return date
}

function addUtcMonths(date, months) {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + months
  const day = date.getUTCDate()
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const result = new Date(Date.UTC(year, month, Math.min(day, lastDay)))
  return result.toISOString().slice(0, 10)
}
