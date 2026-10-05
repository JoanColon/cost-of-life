import { ref } from 'vue'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { auth } from '@/firebase/firebase'

export const authUser = ref(null)

let resolveAuthReady
const authReady = new Promise((resolve) => {
  resolveAuthReady = resolve
})

onAuthStateChanged(
  auth,
  (user) => {
    authUser.value = user
    resolveAuthReady()
  },
  () => resolveAuthReady(),
)

export function waitForAuth() {
  return authReady
}

export function signIn(email, password) {
  return signInWithEmailAndPassword(auth, email, password)
}

export function createAccount(email, password) {
  return createUserWithEmailAndPassword(auth, email, password)
}

export function signInWithGoogle({ redirect = false } = {}) {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })

  return redirect ? signInWithRedirect(auth, provider) : signInWithPopup(auth, provider)
}

export function finishGoogleRedirect() {
  return getRedirectResult(auth)
}

export function sendPasswordReset(email) {
  return sendPasswordResetEmail(auth, email)
}

export function signOut() {
  return firebaseSignOut(auth)
}
