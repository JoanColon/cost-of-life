import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/firebase/firebase'

export async function getFinancialHistory(workspaceId) {
  const snapshot = await getDocs(collection(db, 'workspaces', workspaceId, 'positionSnapshots'))
  const years = {}
  for (const document of snapshot.docs) {
    const data = document.data()
    const period = String(data.period || document.id)
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) continue
    const [year, month] = period.split('-')
    const target = (years[year] ||= { id: year, year: Number(year), months: {} })
    target.months[month] = {
      assets: data.assets || { categories: {} },
      liabilities: data.liabilities || { categories: {} },
      positionStatus: data.status,
      positionAsOf: data.asOfDate,
    }
  }
  return Object.values(years).sort((left, right) => left.year - right.year)
}
