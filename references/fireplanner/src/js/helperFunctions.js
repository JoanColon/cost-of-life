// Format a TIMESTAMP value into a DATE string value (YY/MM/DD)
export function formatTimestampToDate(timestamp) {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = date.getMonth() + 1 // Month is zero-indexed, so add 1
  const day = date.getDate()

  const formattedDate = `${year}/${month}/${day}`

  return formattedDate
}

// Format a TIMESTAMP value into a DATE string value (YY/MM/DD)
export function formatUnixTimestampToDate(timestamp, yearDigits) {
  const date = new Date(timestamp * 1000)
  const numberOfDigits = yearDigits

  if (numberOfDigits === 2) {
    const options = { year: '2-digit', month: '2-digit' }
    const formattedDate = date.toLocaleDateString(undefined, options) // Example: '14/88'
    return formattedDate
  } else {
    const options = { year: 'numeric', month: '2-digit' }
    const formattedDate = date.toLocaleDateString(undefined, options) // Example: '14/1988'
    return formattedDate
  }
}

// tranform currency string (e.g. USD) into currency symbol (e.g., $)
export function currencyStringToSymbol(currencyString) {
  let currencySymbol = ''
  switch (currencyString) {
    case 'USD':
      currencySymbol = '$'
      break
    case 'EUR':
      currencySymbol = '€'
      break
    case 'GBP':
    case 'GBp':
      currencySymbol = '£'
      break
    default:
      currencySymbol = '$'
  }
  return currencySymbol
}

// tranform a number into a string formatted as currency (e.g. 4500 to 4,500€)
export function numberToCurrency(number, currency, numberOfDecimals) {
  const formattedNumberToCurrency =
    currency === ''
      ? number.toLocaleString('en-US', { maximumFractionDigits: numberOfDecimals })
      : number.toLocaleString('en-US', {
          style: 'currency',
          currency: currency,
          maximumFractionDigits: numberOfDecimals,
        })
  return formattedNumberToCurrency
}

// transform a number into a string formatted as percentage
export function numberToPercentage(number, numberOfDecimals) {
  const formattedNumberToPercentage = number.toLocaleString('en-Us', {
    style: 'percent',
    maximumFractionDigits: numberOfDecimals,
  })
  return formattedNumberToPercentage
}

// CurrencyExchange between GBp and GBP
export function GBpToGBP(number) {
  return number / 100
}
