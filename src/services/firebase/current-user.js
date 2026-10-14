import { auth } from '@/firebase/firebase'

export function currentUserId() {
  const userId = auth.currentUser?.uid
  if (!userId) throw new Error('Authentication is required')
  return userId
}
