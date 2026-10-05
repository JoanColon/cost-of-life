/* eslint-disable no-unused-vars */
import { defineStore } from 'pinia'
import { db } from 'src/js/firebase'
import { collection, onSnapshot } from 'firebase/firestore'
import * as Math from 'mathjs'

// import and declare storeAuth
import { useStoreAuth } from 'src/stores/storeAuth'

export const useStoreNetWorth = defineStore('storeNetWorth', {
  // ---------------------------------------------- STATE ---------------------------------------- //
  state: () => {
    return {
      netWorthDict: {
        date: '',
        timestamp: '',
        netWorthDataDict: {},
      },
      networthDocDict: {},
    }
  },

  // ---------------------------------------------- ACTIONS ---------------------------------------- //
  actions: {
    getNetworthDoc() {
      const storeAuth = useStoreAuth()

      // Reference to your collection
      const networthCollection = collection(db, 'users', storeAuth.user.id, 'networth')

      // Get all documents and listen for changes
      try {
        const data = onSnapshot(networthCollection, (querySnapshot) => {
          const obj = {}
          let lastMonth = 0

          querySnapshot.forEach((doc) => {
            try {
              const data = doc.data()
              const keysArray = Object.keys(data)
              const networthNumb = keysArray.map((element) => Number(element))
              lastMonth = networthNumb.length > 0 ? Math.max(networthNumb) : 0

              switch (doc.id) {
                case 'networthAssetsDoc':
                  keysArray.forEach((key) => {
                    obj[key] = {}
                    const element1 = 'netWorthDict'
                    const element2 = 'assets'
                    obj[key].date = data[key].date
                    obj[key].timestamp = data[key].timestamp
                    obj[key][element1] = {}
                    obj[key][element1][element2] = data[key].netWorthAssetsList
                  })
                  break
                case 'networthLiabilitiesDoc':
                  keysArray.forEach((key) => {
                    obj[key] = obj[key] || {}
                    const element1 = 'netWorthDict'
                    const element2 = 'liabilities'
                    obj[key][element1][element2] = data[key].netWorthLiabilitiesList
                  })
                  break
                case 'networthTotalDoc':
                  keysArray.forEach((key) => {
                    obj[key] = obj[key] || {}
                    const element1 = 'netWorthDict'
                    const element2 = 'totalNetWorth'
                    obj[key][element1][element2] = data[key].totalNetWorth
                  })
                  break
              }
            } catch (error) {
              console.log('storeNetworth not able to update when deleting data')
            }
          })

          // final networthDocDict (all elements)
          this.networthDocDict = obj

          // final networthDict (only last element)
          // As I have 3 docs and I am updating all docs, in runs a loop that can not operate until the three docs are finished,
          // if not, throws an error, the try catch block prevent that, and while looping the docs says goes to the catch section and
          // when finished goes to the try block
          const networthDocDictLenght = Object.keys(obj)
          try {
            if (networthDocDictLenght.length !== 0) {
              this.netWorthDict.date = obj[lastMonth].date
              this.netWorthDict.timestamp = obj[lastMonth].timestamp
              this.netWorthDict.netWorthDataDict = obj[lastMonth].netWorthDict
            } else {
              console.log('networth doc is still empty, please add a networth document')
            }
          } catch (error) {
            console.log('updating docs')
          }
        })
      } catch (error) {
        console.error('Error fetching key metrics data:')
      }
    },
  },
  getters: {
    getAllNetWorthList: (state) => {
      // transform the networthDocDict into an array of dicts
      const networthDocDict = state.networthDocDict
      const allNetWorthList = Object.entries(networthDocDict).map(([key, value]) => ({
        key,
        ...value,
      }))
      allNetWorthList.sort((a, b) => b.timestamp - a.timestamp)
      return allNetWorthList
    },
  },
})
