const { setGlobalOptions } = require('firebase-functions')
const { initializeApp } = require('firebase-admin/app')

setGlobalOptions({ maxInstances: 10 })

initializeApp()

const financialYears = require('./financial-years')
const workspaces = require('./workspaces')

Object.assign(exports, financialYears)
Object.assign(exports, workspaces)
