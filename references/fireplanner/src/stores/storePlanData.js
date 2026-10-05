/* eslint-disable no-unused-vars */
/* eslint-disable prefer-const */
import { defineStore } from 'pinia'
import { db } from 'src/js/firebase'
import { collection, getDocs, query, limit, where, onSnapshot } from 'firebase/firestore'

// import and declare storeAuth
import { useStoreAuth } from 'src/stores/storeAuth'
import { useStoreUserSettings } from 'src/stores/storeUserSettings'

export const useStorePlanData = defineStore('storeplanData', {
  // ---------------------------------------------- STATE ---------------------------------------- //
  state: () => {
    return {
      planDataDict: {
        timestamp: '',
        planName: '',
        plannerGoalDict: {},
        fireNumberDict: {},
        wealthNumberDict: {},
        fireMilestonesDict: {},
        wealthMilestonesDict: {},
        allocatedFundsDict: {},
      },
      planList: [],
    }
  },

  // ---------------------------------------------- ACTIONS ---------------------------------------- //
  actions: {
    // get all plan documents
    async getPlanNames() {
      const storeAuth = useStoreAuth()
      this.planList = []

      try {
        const planDataRef = collection(db, 'users', storeAuth.user.id, 'planData')
        const querySnapshot = await getDocs(planDataRef)
        querySnapshot.forEach((doc) => {
          let planName = doc.data().planName
          this.planList.push(planName)
        })
      } catch (err) {
        console.log(err)
      }
    },

    // get selected plan data
    async getPlanData() {
      const storeAuth = useStoreAuth()
      const storeUserSettings = useStoreUserSettings()

      try {
        let myPlanName = String(storeUserSettings.userSettings.planName)
        const planDataRef = collection(db, 'users', storeAuth.user.id, 'planData')
        const q = query(planDataRef, where('planName', '==', myPlanName), limit(1))

        const planData = onSnapshot(q, (querySnapshot) => {
          querySnapshot.forEach((doc) => {
            this.planDataDict.timestamp = doc.data().timestamp
            this.planDataDict.planName = doc.data().planName
            this.planDataDict.plannerGoalDict = doc.data().plannerGoalDict
            this.planDataDict.fireNumberDict = doc.data().fireNumberDict
            this.planDataDict.wealthNumberDict = doc.data().wealthNumberDict
            this.planDataDict.fireMilestonesDict = doc.data().fireMilestonesDict
            this.planDataDict.wealthMilestonesDict = doc.data().wealthMilestonesDict
            this.planDataDict.allocatedFundsDict = doc.data().allocatedFundsDict
          })
        })
      } catch (err) {
        console.log(err)
      }
    },
  },
})
