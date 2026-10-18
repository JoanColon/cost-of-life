import { doc, getDoc, onSnapshot } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '@/firebase/firebase'

function financialYearRef(workspaceId, year) {
  return doc(db, 'workspaces', workspaceId, 'financialYears', String(year))
}

export async function getFinancialYear(workspaceId, year, { ensure = false } = {}) {
  assertYear(year)
  const reference = financialYearRef(workspaceId, year)
  let snapshot = await getDoc(reference)
  if (ensure && (!snapshot.exists() || Number(snapshot.data()?.schemaVersion || 0) < 2)) {
    await httpsCallable(
      functions,
      'ensureFinancialYear',
    )({
      workspaceId,
      year,
      refresh: snapshot.exists(),
    })
    snapshot = await getDoc(reference)
  }
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null
}

export function subscribeFinancialYear(workspaceId, year, onValue, onError) {
  assertYear(year)
  return onSnapshot(
    financialYearRef(workspaceId, year),
    (snapshot) => onValue(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null),
    onError,
  )
}

function assertYear(year) {
  if (!Number.isInteger(year) || year < 2000 || year > 9999) {
    throw new Error('A valid financial year is required')
  }
}
