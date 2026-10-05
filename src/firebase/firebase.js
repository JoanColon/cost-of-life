import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyBo43_5VY5_W76APFbIxopO9iPnDWMnR4Q',
  authDomain: 'cost-of-life-f23b2.firebaseapp.com',
  projectId: 'cost-of-life-f23b2',
  storageBucket: 'cost-of-life-f23b2.firebasestorage.app',
  messagingSenderId: '472858873731',
  appId: '1:472858873731:web:a3878bbbd364f72c62b0b6',
}

const firebaseApp = initializeApp(firebaseConfig)

export const auth = getAuth(firebaseApp)
export const db = getFirestore(firebaseApp)
export default firebaseApp
