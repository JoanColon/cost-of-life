/**
 * Combines modeled and tracked expense values according to the selected reconciliation decision, both in aggregate and per member.
 */
import { normalizeNonNegativeMoneyOrNull, roundMoneyOrZero } from '../core/money.js'

/**
 * Reconciles a modeled expense with an optional tracked amount.
 * A missing tracked amount always falls back to the model, even if the requested decision is
 * `tracked` or `combined`.
 */
export function reconcileModeledAndTrackedExpense(modelValue, actualValue, decision) {
  const model = normalizeNonNegativeMoneyOrNull(modelValue) || 0
  const actual = actualValue == null ? null : normalizeNonNegativeMoneyOrNull(actualValue)
  const usesTracked = decision === 'tracked' && actual !== null
  const usesCombined = decision === 'combined' && actual !== null
  const source = usesTracked ? 'tracked' : usesCombined ? 'combined' : 'model'
  const effective = usesTracked ?
    actual :
    usesCombined ?
      roundMoneyOrZero(model + actual) :
      model
  return { model, actual, effective, source }
}

/** Reconciles two member-value maps using the same model/tracked/combined decision. */
export function reconcileExpenseMemberValues(estimated = {}, actual = {}, decision = 'model') {
  if (decision === 'tracked') return actual
  if (decision !== 'combined') return estimated
  const keys = new Set([...Object.keys(estimated), ...Object.keys(actual)])
  return Object.fromEntries(
    [...keys].map((key) => [
      key,
      roundMoneyOrZero((Number(estimated[key]) || 0) + (Number(actual[key]) || 0)),
    ]),
  )
}
