/* eslint-disable no-unused-vars */
import { defineStore } from 'pinia'
import { db } from 'src/js/firebase'
import { collection, onSnapshot } from 'firebase/firestore'
import * as Math from 'mathjs'

// import and declare storeAuth
import { useStoreAuth } from 'src/stores/storeAuth'

export const useStoreKeyMetrics = defineStore('storeKeyMetrics', {
  // ---------------------------------------------- STATE ---------------------------------------- //
  state: () => {
    return {
      keyMetricsDict: {
        year: '',
        timestamp: '',
        incomeDict: {},
        expensesDict: {},
        savingsDict: {},
      },
      keyMetricsDocDict: {},
    }
  },
  // ---------------------------------------------- ACTIONS ---------------------------------------- //
  actions: {
    getkeyMetricsDoc() {
      const storeAuth = useStoreAuth()

      // Reference to your collection
      const keyMetricsCollection = collection(db, 'users', storeAuth.user.id, 'keyMetrics')

      // Get all documents and listen for changes
      try {
        const data = onSnapshot(keyMetricsCollection, (querySnapshot) => {
          const obj = {}
          let lastYear = 0

          querySnapshot.forEach((doc) => {
            try {
              const data = doc.data()
              const keysArray = Object.keys(data)
              const keyMetricsKeysNumb = keysArray.map((element) => Number(element))
              lastYear = keyMetricsKeysNumb.length > 0 ? Math.max(keyMetricsKeysNumb) : 0 // to be used to get the state keyMetricsDict

              switch (doc.id) {
                case 'metricsExpensesDoc':
                  keysArray.forEach((key) => {
                    obj[key] = {}
                    const element = 'expensesDict'
                    obj[key].year = key
                    obj[key][element] = data[key].expensesDict
                  })
                  break
                case 'metricsIncomeDoc':
                  keysArray.forEach((key) => {
                    obj[key] = obj[key] || {}
                    const element = 'incomeDict'
                    obj[key][element] = data[key].incomeDict
                  })
                  break
                case 'metricsSavingsDoc':
                  keysArray.forEach((key) => {
                    obj[key] = obj[key] || {}
                    const element = 'savingsDict'
                    obj[key][element] = data[key].savingsDict
                  })
                  break
              }
            } catch (error) {
              console.log('storeKeyMetrics not able to update when deleting data', error)
            }
          })
          // all keymetrics elements
          this.keyMetricsDocDict = obj

          // only the last element
          this.keyMetricsDict = obj[lastYear]
        })
      } catch (error) {
        console.error('Error fetching key metrics data:', error)
      }
    },
  },
  // ---------------------------------------------- GETTERS ---------------------------------------- //
  getters: {
    getAllKeyMetricsList: (state) => {
      // transform the keyMetricsDocDict into an array of dicts
      const keyMetricsDocDict = state.keyMetricsDocDict
      const allKeyMetricsList = Object.entries(keyMetricsDocDict).map(([key, value]) => ({
        key,
        ...value,
      })) // changed to upate networth
      allKeyMetricsList.sort((a, b) => Number(b.year) - Number(a.year))
      return allKeyMetricsList
    },
  },
})
