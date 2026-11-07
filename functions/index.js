import { setGlobalOptions } from 'firebase-functions'
import { initializeApp } from 'firebase-admin/app'

export * from './financial-years.js'
export * from './financial-model.js'
export * from './investment-portfolios.js'
export * from './workspaces.js'

setGlobalOptions({ maxInstances: 10 })

initializeApp()
