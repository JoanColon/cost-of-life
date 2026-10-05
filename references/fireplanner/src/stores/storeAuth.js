import { defineStore } from 'pinia'
import { auth } from 'src/js/firebase'
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'

export const useStoreAuth = defineStore('storeAuth', {
  // ---------------------------------------------- STATE ---------------------------------------- //
  state: () => {
    return {
      user: {
        id: '',
        email: '',
      },
    }
  },

  // ---------------------------------------------- ACTIONS ---------------------------------------- //
  actions: {
    // init action triggered in app.vue component (onMounted hook)
    init() {
      onAuthStateChanged(auth, (user) => {
        if (user) {
          this.user.id = user.uid
          this.user.email = user.email
          this.router.push('/loading')
        } else {
          this.user = {}
          console.log(user)
          // this.router.push('/login')
        }
      })
    },

    // register user
    registerUser(credentials) {
      createUserWithEmailAndPassword(auth, credentials.email, credentials.password)
        .then((userCredential) => {
          // Signed in succesful
          const user = userCredential.user
          console.log('user created as:', user.email)
        })
        .catch((error) => {
          console.log('error.message', error.message)
        })
    },

    // sign existing user
    loginUser(credentials) {
      signInWithEmailAndPassword(auth, credentials.email, credentials.password)
        .then((userCredential) => {
          // Signed in succesful
          // eslint-disable-next-line no-unused-vars
          const user = userCredential.user
          // console.log(user)
        })
        .catch((error) => {
          console.log('error.message', error.message)
        })
    },

    // sign existing user with Google
    loginUserWithGoogle() {
      const provider = new GoogleAuthProvider()
      const auth = getAuth()

      signInWithPopup(auth, provider)
        .then((result) => {
          // eslint-disable-next-line no-unused-vars
          const user = result.user
          // console.log(user)
        })
        .catch((error) => {
          console.log(error)
        })
    },

    // logout signed user
    logoutUser() {
      signOut(auth)
        .then(() => {
          // sign out succesful
          this.user.id = ''
          this.user.email = ''
          console.log('User signed out')
          this.router.push('/')
        })
        .catch((error) => {
          console.log('error when loggin out:', error.message)
        })
    },
  },
})
