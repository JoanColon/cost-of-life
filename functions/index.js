const { setGlobalOptions } = require('firebase-functions')
const { initializeApp } = require('firebase-admin/app')

setGlobalOptions({ maxInstances: 10 })

initializeApp()

const financialYears = require('./financial-years')
const financialModel = require('./financial-model')
const workspaces = require('./workspaces')

Object.assign(exports, financialYears)
Object.assign(exports, financialModel)
Object.assign(exports, workspaces)
