import { afterEach, describe, expect, it } from 'vitest'
import {
  currencySymbol,
  formatCurrency,
  setWorkspaceCurrency,
  workspaceCurrency,
} from '../../src/utils/formatters.js'

describe('workspace currency formatting', () => {
  afterEach(() => setWorkspaceCurrency('EUR'))

  it('defaults legacy workspaces to EUR', () => {
    setWorkspaceCurrency(null)
    expect(workspaceCurrency.value).toBe('EUR')
    expect(formatCurrency(1250)).toContain('1,250')
  })

  it('updates both formatted values and input symbols', () => {
    setWorkspaceCurrency('USD')
    expect(workspaceCurrency.value).toBe('USD')
    expect(currencySymbol.value).toContain('$')
    expect(formatCurrency(1250)).toContain('$')
  })
})
