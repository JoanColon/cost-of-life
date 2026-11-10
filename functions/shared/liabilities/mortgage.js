import {
  addCalendarMonthsClamped,
  dateInFinancialTimeZone,
  requireCanonicalDate,
} from '../core/dates.js'
import { roundMoneyOrZero } from '../core/money.js'
import { nominalMonthlyRateFromAnnualPercent } from '../core/rates.js'

const MAX_MORTGAGE_SCHEDULE_MONTHS = 1_200

/**
 * Calculates one French-amortization payment from a known opening balance.
 * Interest is rounded before principal, matching the persisted Cost of Life mortgage contract.
 */
export function calculateFrenchMortgagePaymentStep({
  balance,
  annualInterestRate,
  monthlyPayment,
  extraMonthlyPayment = 0,
}) {
  const openingBalance = requireNonNegativeNumber(balance, 'mortgage balance')
  const regularPayment = requireNonNegativeNumber(monthlyPayment, 'monthly payment')
  const extraPayment = requireNonNegativeNumber(extraMonthlyPayment, 'extra monthly payment')
  const interest = roundMoneyOrZero(
    openingBalance * nominalMonthlyRateFromAnnualPercent(annualInterestRate),
  )
  const payment = roundMoneyOrZero(
    Math.min(roundMoneyOrZero(regularPayment + extraPayment), openingBalance + interest),
  )
  const principal = roundMoneyOrZero(Math.min(openingBalance, payment - interest))
  if (openingBalance > 0 && principal <= 0) {
    throw new RangeError('The monthly payment does not cover the accrued interest')
  }
  return {
    payment,
    interest,
    principal,
    remainingBalance: roundMoneyOrZero(Math.max(0, openingBalance - principal)),
  }
}

/** Calculates the contractual French-mortgage payment for a principal and fixed term. */
export function calculateFrenchMortgageMonthlyPayment({
  principal,
  annualInterestRate,
  termMonths,
}) {
  const amount = requireNonNegativeNumber(principal, 'principal')
  const months = requirePositiveInteger(termMonths, 'term months')
  if (amount === 0) return 0
  const monthlyRate = nominalMonthlyRateFromAnnualPercent(annualInterestRate)
  if (monthlyRate === 0) return roundMoneyOrZero(amount / months)
  return roundMoneyOrZero((amount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months)))
}

/**
 * Builds a forward amortization schedule from a balance known at the projection date.
 * This does not reconstruct historical payments; use calculateMortgageBalanceFromAnchor for that.
 */
export function buildFrenchMortgageScheduleFromBalance({
  currentBalance,
  annualInterestRate,
  monthlyPayment,
  extraMonthlyPayment = 0,
  asOfDate = new Date(),
  startDate = null,
}) {
  let balance = roundMoneyOrZero(requireNonNegativeNumber(currentBalance, 'current balance'))
  const regularPayment = roundMoneyOrZero(
    requireNonNegativeNumber(monthlyPayment, 'monthly payment'),
  )
  const extraPayment = roundMoneyOrZero(
    requireNonNegativeNumber(extraMonthlyPayment, 'extra monthly payment'),
  )
  const projectionDate = canonicalProjectionDate(asOfDate)
  const contractualStartDate = startDate ?
    requireCanonicalDate(startDate, 'mortgage start date') :
    null
  const firstContractualPayment = contractualStartDate ?
    firstPaymentNumberAfter(contractualStartDate, projectionDate) :
    null

  if (balance === 0) return []
  if (regularPayment === 0) throw new RangeError('A positive monthly payment is required')

  const schedule = []
  for (let paymentNumber = 1; paymentNumber <= MAX_MORTGAGE_SCHEDULE_MONTHS; paymentNumber += 1) {
    const step = calculateFrenchMortgagePaymentStep({
      balance,
      annualInterestRate,
      monthlyPayment: regularPayment,
      extraMonthlyPayment: extraPayment,
    })
    balance = step.remainingBalance
    schedule.push({
      paymentNumber,
      date: contractualStartDate ?
        addCalendarMonthsClamped(
            contractualStartDate,
            firstContractualPayment + paymentNumber - 1,
          ) :
        addCalendarMonthsClamped(projectionDate, paymentNumber),
      ...step,
    })
    if (balance === 0) return schedule
  }
  throw new RangeError('The mortgage cannot be repaid within the supported projection period')
}

/**
 * Compares the contractual payoff path with a path that includes an extra monthly payment.
 * Both paths start from the same known current balance and projection date.
 */
export function compareFrenchMortgagePayoffScenarios({ extraMonthlyPayment = 0, ...mortgage }) {
  const schedule = buildFrenchMortgageScheduleFromBalance(mortgage)
  const acceleratedSchedule = buildFrenchMortgageScheduleFromBalance({
    ...mortgage,
    extraMonthlyPayment,
  })
  const totalRemainingInterest = totalScheduleInterest(schedule)
  const acceleratedInterest = totalScheduleInterest(acceleratedSchedule)
  return {
    monthlyRate: nominalMonthlyRateFromAnnualPercent(mortgage.annualInterestRate),
    monthlyPayment: roundMoneyOrZero(Number(mortgage.monthlyPayment) || 0),
    nextPayment: schedule[0] || null,
    remainingPayments: schedule.length,
    payoffDate: schedule.at(-1)?.date || null,
    totalRemainingInterest,
    schedule,
    accelerated: {
      extraMonthlyPayment: roundMoneyOrZero(Number(extraMonthlyPayment) || 0),
      remainingPayments: acceleratedSchedule.length,
      payoffDate: acceleratedSchedule.at(-1)?.date || null,
      totalRemainingInterest: acceleratedInterest,
      monthsEarlier: Math.max(0, schedule.length - acceleratedSchedule.length),
      interestSaved: roundMoneyOrZero(
        Math.max(0, totalRemainingInterest - acceleratedInterest),
      ),
      schedule: acceleratedSchedule,
    },
  }
}

/**
 * Reconstructs a mortgage balance at a date by replaying contractual payments after a recorded
 * balance anchor. The anchor is an observed historical fact, not a projection starting balance.
 */
export function calculateMortgageBalanceFromAnchor(mortgage, asOfDate) {
  if (mortgage?.schemaVersion !== 2 || !mortgage.balanceAnchor) {
    throw new Error('A mortgage balance anchor is required')
  }
  const anchorAmount = requireMoneyWithAtMostTwoDecimals(
    mortgage.balanceAnchor.amount,
    'anchor balance',
  )
  const anchorDate = requireCanonicalDate(mortgage.balanceAnchor.date, 'anchor date')
  const startDate = requireCanonicalDate(mortgage.startDate, 'start date')
  const valuationDate = requireCanonicalDate(asOfDate, 'valuation date')
  const monthlyPayment = requireMoneyWithAtMostTwoDecimals(
    mortgage.monthlyPayment,
    'monthly payment',
  )
  const annualInterestRate = requireNonNegativeNumber(
    mortgage.annualInterestRate,
    'annual interest rate',
  )
  if (valuationDate <= anchorDate || anchorAmount === 0) return roundMoneyOrZero(anchorAmount)
  if (monthlyPayment === 0) throw new Error('A positive monthly payment is required')

  let balance = roundMoneyOrZero(anchorAmount)
  for (let paymentNumber = 1; paymentNumber <= MAX_MORTGAGE_SCHEDULE_MONTHS; paymentNumber += 1) {
    const paymentDate = addCalendarMonthsClamped(startDate, paymentNumber)
    if (paymentDate <= anchorDate) continue
    if (paymentDate > valuationDate || balance === 0) return balance
    balance = calculateFrenchMortgagePaymentStep({
      balance,
      annualInterestRate,
      monthlyPayment,
    }).remainingBalance
  }
  throw new Error('The mortgage cannot be repaid within the supported projection period')
}

/** Returns whether a mortgage still has a contractual payment due within a calendar month. */
export function isMortgagePaymentDueInCalendarMonth(mortgage, year, monthIndex) {
  const startDate = requireCanonicalDate(mortgage?.startDate, 'start date')
  const firstPaymentDate = addCalendarMonthsClamped(startDate, 1)
  const monthEnd = new Date(Date.UTC(Number(year), Number(monthIndex) + 1, 0))
    .toISOString()
    .slice(0, 10)
  if (monthEnd < firstPaymentDate) return false
  const dayBeforeMonth = new Date(Date.UTC(Number(year), Number(monthIndex), 0))
    .toISOString()
    .slice(0, 10)
  return calculateMortgageBalanceFromAnchor(mortgage, dayBeforeMonth) > 0
}

function firstPaymentNumberAfter(startDate, asOfDate) {
  for (let paymentNumber = 1; paymentNumber <= MAX_MORTGAGE_SCHEDULE_MONTHS; paymentNumber += 1) {
    if (addCalendarMonthsClamped(startDate, paymentNumber) > asOfDate) return paymentNumber
  }
  throw new RangeError('The projection date exceeds the supported mortgage schedule')
}

function totalScheduleInterest(schedule) {
  return roundMoneyOrZero(schedule.reduce((total, payment) => total + payment.interest, 0))
}

function canonicalProjectionDate(value) {
  return value instanceof Date ?
    dateInFinancialTimeZone(value) :
    requireCanonicalDate(value, 'projection date')
}

function requireMoneyWithAtMostTwoDecimals(value, label) {
  const number = requireNonNegativeNumber(value, label)
  if (roundMoneyOrZero(number) !== number) throw new Error(`A valid ${label} is required`)
  return number
}

function requireNonNegativeNumber(value, label) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) throw new RangeError(`A valid ${label} is required`)
  return number
}

function requirePositiveInteger(value, label) {
  const number = Number(value)
  if (!Number.isInteger(number) || number <= 0) throw new RangeError(`A valid ${label} is required`)
  return number
}
