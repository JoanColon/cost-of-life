/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
import { defineStore } from 'pinia'
import { db } from 'src/js/firebase'
import { doc, onSnapshot } from 'firebase/firestore'
import _groupBy from 'lodash/groupBy'
// import * as math from 'mathjs'

// import and declare storeAuth
import { useStoreAuth } from 'src/stores/storeAuth'

export const useStoreSavings = defineStore('storeSavings', {
  // ---------------------------------------------- STATE ---------------------------------------- //
  state: () => {
    return {
      savingsDocDict: {},
    }
  },

  // ---------------------------------------------- ACTIONS ---------------------------------------- //
  actions: {
    // get onSnapShot data (read and update)
    getSavingsDoc() {
      const storeAuth = useStoreAuth()

      const savingsDoc = onSnapshot(
        doc(db, 'users', storeAuth.user.id, 'savings', 'savingsDoc'),
        (doc) => {
          this.savingsDocDict = doc.data()
        },
      )
    },
  },
  getters: {
    getSavingsList: (state) => {
      // transform the networthDocDict into an array of dicts
      const savingsDocDict = state.savingsDocDict
      try {
        const savingsList = Object.entries(savingsDocDict).map(([key, value]) => ({
          key,
          ...value,
        }))
        savingsList.sort((a, b) => b.timestamp - a.timestamp)
        return savingsList
      } catch {
        const savingsList = []
        return savingsList
      }
    },
    savingsTotals: (state) => {
      // STEP 1. Get all savings data (individual entries), transform the networthDocDict into an array of dicts
      const savingsDocDict = state.savingsDocDict
      const savingsEntries = Object.entries(savingsDocDict).map(([key, value]) => ({
        key,
        ...value,
      }))

      // STEP 2. group savings entries by saving choice (results is an object of objects)
      let groupedSavings = _groupBy(savingsEntries, 'savingsChoice')

      // STEP 3. get all keys from the grouped object (Each key is a savingsChoice)
      const savingsChoiceList = Object.keys(groupedSavings)

      // STEP 4. Aggregate results per saving choice
      let savingTotals = {}
      let timeInvested = {}
      savingsChoiceList.forEach((savingChoice) => {
        let obj = {}
        // total investment per savingChoice
        const savingChoiceTotal = groupedSavings[savingChoice]
          .map((element) => element.savingsAmount)
          .reduce((acc, cur) => acc + cur, 0)

        // save the results into the objects
        savingTotals[savingChoice] = savingChoiceTotal
        // timeInvested[savingChoice] = elapsedTimeDays
      })

      return savingTotals
    },
    savingsSummaryResults: (state) => {
      // STEP 1. transform the networthDocDict into an array of dicts
      const savingsDocDict = state.savingsDocDict
      const savingsList = Object.entries(savingsDocDict).map(([key, value]) => ({ key, ...value }))

      // STEP 2. Calculate the total amount saved over time
      const totalSavings = savingsList.reduce((acc, cur) => acc + cur.savingsAmount, 0)

      // STEP 3. Adds a new array containg only the year in which the savings where added
      const savingsListAddedYear = savingsList.map((item) => {
        const newDate = new Date(item.date)
        const year = newDate.getFullYear()
        item.year = year
        return item
      })

      // STEP 4. Get only savings data from last year
      const groupedYears = _groupBy(savingsListAddedYear, 'year')
      const lastYear = Object.keys(groupedYears).slice(-1)
      const lastYearArray = groupedYears[lastYear]

      // STEP 5. Calculate the total amount saved over the last year
      const yearlySavings = lastYearArray.reduce((acc, cur) => acc + cur.savingsAmount, 0)

      const results = {
        totalSavings,
        yearlySavings,
      }

      return results
    },
  },
})
