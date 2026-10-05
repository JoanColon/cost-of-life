/* eslint-disable no-unused-vars */
// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app'
import { getAnalytics } from 'firebase/analytics'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions'
// import { getAnalytics } from 'firebase/analytics'
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: 'AIzaSyBrP7uyN7oMUyEJ6c5O7dYGWY0aSL70-vM',
  authDomain: 'fireplanner-58e12.firebaseapp.com',
  projectId: 'fireplanner-58e12',
  storageBucket: 'fireplanner-58e12.appspot.com',
  messagingSenderId: '621413898722',
  appId: '1:621413898722:web:1f3e2e15235dbea36b01bb',
  measurementId: 'G-911YQY6E89',
}
// Initialize Firebase
const app = initializeApp(firebaseConfig)
const analytics = getAnalytics(app)
// const analytics = getAnalytics(app)

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(app)

// Initialize Firebase Authentication and get a reference to the service
const auth = getAuth(app)

// Initializae Firebase functions
const functions = getFunctions(app)
// connectFunctionsEmulator(functions, 'localhost', 5001) // comment before uploading to firebase, only for testing

export { app, db, auth, functions, firebaseConfig }
