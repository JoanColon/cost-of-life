/* eslint-disable no-unused-vars */
import { defineStore } from 'pinia'
import { db } from 'src/js/firebase'
import { doc, onSnapshot } from 'firebase/firestore'

// import update apiData functions
import { updateMarketData } from 'src/js/rapidApiCall.js'

// import and declare storeAuth
import { useStoreAuth } from 'src/stores/storeAuth'

export const useStoreUserSettings = defineStore('storeUserSettings', {
  // ---------------------------------------------- STATE ---------------------------------------- //
  state: () => {
    return {
      userSettings: {
        userName: '',
        email: '',
        currency: '',
        taxRate: 0,
        plan: '',
        planName: '',
        updateApiPreferences: {},
        navigationNames: {
          planner: 'FinancialIndicators',
          progress: 'keyProgress',
        },
        investmentTableColumns: {},
        investmentTableColumnsMobile: {
          detailBrokerageAccount: ['symbol', 'marketValueFull', 'incomeYearFull', 'actions'],
          detailRealEstate: ['symbol', 'marketValueFull', 'incomeYearFull', 'actions'],
          detailFixedIncome: ['symbol', 'marketValueFull', 'incomeYearFull', 'actions'],
          detailBusinessEquity: ['symbol', 'marketValueFull', 'incomeYearFull', 'actions'],
          detailCashSavings: ['symbol', 'marketValueFull', 'incomeYearFull', 'actions'],
          detailOthers: ['symbol', 'marketValueFull', 'incomeYearFull', 'actions'],
          detailCryptoAssets: ['symbol', 'marketValueFull', 'actions'],
        },
      },
      currencyString: '',
    }
  },

  // ---------------------------------------------- ACTIONS ---------------------------------------- //
  actions: {
    // get onSnapShot data (read and update)
    getUserSettingsSnapShot() {
      const storeAuth = useStoreAuth()
      this.investmentTableColumns = {}
      this.tableColumnsBroker = []

      const userData = onSnapshot(doc(db, 'users', storeAuth.user.id), (doc) => {
        try {
          this.userSettings.userName = doc.data().userName
          this.userSettings.email = doc.data().email
          this.userSettings.currency = doc.data().currency
          this.userSettings.plan = doc.data().plan
          this.userSettings.planName = doc.data().planName
          this.userSettings.taxRate = doc.data().taxRate
          this.userSettings.updateApiPreferences = doc.data().updateApiPreferences
          this.userSettings.investmentTableColumns = doc.data().investmentTableColumns
          switch (this.userSettings.currency) {
            case 'EUR':
              this.currencyString = '€'
              break
            case 'USD':
              this.currencyString = '$'
              break
            case 'GBP':
              this.currencyString = '£'
              break
            default:
              this.currencyString = '$'
          }
        } catch (error) {
          console.log('data not received yet')
        }
      })
    },
    changeNavigationNames(tab) {
      switch (tab) {
        case 'simulation':
          this.userSettings.navigationNames.planner = tab
          break
        case 'keyProgress':
        case 'savings':
        case 'investments':
          this.userSettings.navigationNames.progress = tab
          break
      }
    },
  },
})
