import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '@/firebase/firebase'

export async function getFinancialHistory(workspaceId) {
  const historyQuery = query(
    collection(db, 'workspaces', workspaceId, 'history'),
    orderBy('year', 'asc'),
  )
  const snapshot = await getDocs(historyQuery)

  return snapshot.docs.map((historyDocument) => ({
    id: historyDocument.id,
    ...historyDocument.data(),
  }))
}
