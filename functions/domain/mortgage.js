import {
  frenchMortgagePaymentStep,
  roundMoney,
} from '../shared/financial-core.js'

const MAX_SCHEDULE_MONTHS = 1_200

function effectiveMortgageBalance(mortgage, asOfDate) {
  if (mortgage?.schemaVersion !== 2 || !mortgage.balanceAnchor) {
    throw new Error('A mortgage balance anchor is required')
  }
  const anchorAmount = nonNegativeMoney(mortgage.balanceAnchor.amount, 'anchor balance')
  const anchorDate = canonicalDate(mortgage.balanceAnchor.date, 'anchor date')
  const startDate = canonicalDate(mortgage.startDate, 'start date')
  const valuationDate = canonicalDate(asOfDate, 'valuation date')
  const payment = nonNegativeMoney(mortgage.monthlyPayment, 'monthly payment')
  const annualRate = nonNegativeNumber(mortgage.annualInterestRate, 'annual interest rate')
  if (valuationDate <= anchorDate || anchorAmount === 0) return roundMoney(anchorAmount)
  if (payment === 0) throw new Error('A positive monthly payment is required')

  let balance = roundMoney(anchorAmount)
  for (let paymentNumber = 1; paymentNumber <= MAX_SCHEDULE_MONTHS; paymentNumber += 1) {
    const paymentDate = addMonths(startDate, paymentNumber)
    if (paymentDate <= anchorDate) continue
    if (paymentDate > valuationDate || balance === 0) return balance
    balance = frenchMortgagePaymentStep({
      balance,
      annualInterestRate: annualRate,
      monthlyPayment: payment,
    }).remainingBalance
  }
  throw new Error('The mortgage cannot be repaid within the supported projection period')
}

function isMortgagePaymentDueInMonth(mortgage, year, monthIndex) {
  const startDate = canonicalDate(mortgage?.startDate, 'start date')
  const firstPaymentDate = addMonths(startDate, 1)
  const monthEnd = new Date(Date.UTC(Number(year), Number(monthIndex) + 1, 0))
    .toISOString()
    .slice(0, 10)
  if (monthEnd < firstPaymentDate) return false

  const beforeMonth = new Date(Date.UTC(Number(year), Number(monthIndex), 0))
    .toISOString()
    .slice(0, 10)
  return effectiveMortgageBalance(mortgage, beforeMonth) > 0
}

function addMonths(value, months) {
  const [year, month, day] = value.split('-').map(Number)
  const targetMonth = month - 1 + months
  const lastDay = new Date(Date.UTC(year, targetMonth + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, targetMonth, Math.min(day, lastDay)))
    .toISOString()
    .slice(0, 10)
}

function canonicalDate(value, label) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) throw new Error(`A valid ${label} is required`)
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() !== Number(match[2]) - 1 ||
    date.getUTCDate() !== Number(match[3])
  ) {
    throw new Error(`A valid ${label} is required`)
  }
  return date.toISOString().slice(0, 10)
}

function nonNegativeMoney(value, label) {
  const number = nonNegativeNumber(value, label)
  if (roundMoney(number) !== number) throw new Error(`A valid ${label} is required`)
  return number
}

function nonNegativeNumber(value, label) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) throw new Error(`A valid ${label} is required`)
  return number
}

export { effectiveMortgageBalance, isMortgagePaymentDueInMonth }
export default { effectiveMortgageBalance, isMortgagePaymentDueInMonth }
