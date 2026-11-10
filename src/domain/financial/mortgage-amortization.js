import {
  addCalendarMonths,
  canonicalDate,
  financialDate,
  frenchMortgagePaymentStep,
  nominalMonthlyRate,
  roundMoney,
} from '../../../functions/shared/financial-core.js'

const MAX_SCHEDULE_MONTHS = 1_200

export function monthlyInterestRate(annualInterestRate) {
  return nominalMonthlyRate(annualInterestRate)
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
  startDate = null,
}) {
  let balance = roundMoney(finiteNonNegativeNumber(currentBalance, 'current balance'))
  const regularPayment = roundMoney(finiteNonNegativeNumber(monthlyPayment, 'monthly payment'))
  const extraPayment = roundMoney(
    finiteNonNegativeNumber(extraMonthlyPayment, 'extra monthly payment'),
  )
  const projectionDate = dateString(asOfDate)
  const contractualStartDate = startDate ? canonicalDate(startDate, 'mortgage start date') : null
  const firstContractualPayment = contractualStartDate
    ? firstPaymentAfter(contractualStartDate, projectionDate)
    : null

  if (balance === 0) return []
  if (regularPayment === 0) throw new RangeError('A positive monthly payment is required')

  const schedule = []
  for (let paymentNumber = 1; paymentNumber <= MAX_SCHEDULE_MONTHS; paymentNumber += 1) {
    const step = frenchMortgagePaymentStep({
      balance,
      annualInterestRate,
      monthlyPayment: regularPayment,
      extraMonthlyPayment: extraPayment,
    })
    balance = step.remainingBalance
    schedule.push({
      paymentNumber,
      date: contractualStartDate
        ? addCalendarMonths(contractualStartDate, firstContractualPayment + paymentNumber - 1)
        : addCalendarMonths(projectionDate, paymentNumber),
      payment: step.payment,
      interest: step.interest,
      principal: step.principal,
      remainingBalance: balance,
    })

    if (balance === 0) return schedule
  }

  throw new RangeError('The mortgage cannot be repaid within the supported projection period')
}

function firstPaymentAfter(startDate, asOfDate) {
  for (let paymentNumber = 1; paymentNumber <= MAX_SCHEDULE_MONTHS; paymentNumber += 1) {
    if (addCalendarMonths(startDate, paymentNumber) > asOfDate) return paymentNumber
  }
  throw new RangeError('The projection date exceeds the supported mortgage schedule')
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

function dateString(value) {
  return value instanceof Date ? financialDate(value) : canonicalDate(value, 'projection date')
}
