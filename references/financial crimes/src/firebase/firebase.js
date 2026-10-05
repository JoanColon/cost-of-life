import { initializeApp } from 'firebase/app'

const firebaseConfig = {
  apiKey: 'AIzaSyCux8hioGPguv5eSofqlGuuCsIa9ME9WLg',
  authDomain: 'financial-crimes.firebaseapp.com',
  projectId: 'financial-crimes',
  storageBucket: 'financial-crimes.firebasestorage.app',
  messagingSenderId: '900610196752',
  appId: '1:900610196752:web:c6a66cee537b0a68105195',
  measurementId: 'G-HHPM5QGVSG',
}

export const app = initializeApp(firebaseConfig)
