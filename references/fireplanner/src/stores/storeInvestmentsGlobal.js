/* eslint-disable dot-notation */
/* eslint-disable prefer-const */
import { defineStore } from 'pinia'
import { db } from 'src/js/firebase'
import { doc, getDoc } from 'firebase/firestore'

// // import and declare storeAuth
// import { useStoreAuth } from 'src/stores/storeAuth'

export const useStoreInvestmentsGlobal = defineStore('storeInvestmentsGlobal', {
  // ---------------------------------------------- STATE ---------------------------------------- //
  state: () => {
    return {
      currencyExchange: {},
    }
  },

  // ---------------------------------------------- ACTIONS ---------------------------------------- //
  actions: {
    async getCurrencyExchange() {
      const docRef = doc(db, 'apiData', 'dailyCurrencyExchange')
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        this.currencyExchange = {}
        const currencyExchangeAPI = docSnap.data().currencyExchangeDict.rates
        currencyExchangeAPI.GBp = currencyExchangeAPI.GBP * 100
        this.currencyExchange = currencyExchangeAPI
        this.currencyExchange['USD'] = 1
      } else {
        // doc.data() will be undefined in this case
        console.log('No such document!')
      }
    },
  },
})
