require('dotenv').config();
const express = require('express')
const path = require('path')
const { init } = require('@heroku/applink')

const port = process.env.PORT || 5006
const app = express()

// Initialize Salesforce SDK
const sdk = init();

// Get connection names from environment variable
const connectionNames = process.env.CONNECTION_NAMES ? process.env.CONNECTION_NAMES.split(',') : []

app.use(express.static(path.join(__dirname, 'public')))
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')

app.post('/create-quote-lines-sap', async (req, res) => {
  try {
    // Query accounts from all connected orgs
    const accountsByOrg = await Promise.all(
      connectionNames.map(async (connectionName) => {
        try {
          // Initialize connection for this org
          const org = await sdk.addons.applink.getAuthorization(connectionName.trim())
          console.log('Connected to Salesforce org:', {
            orgId: org.id,
            username: org.user.username
          })

          // Execute SOQL query
          const queryResult = await org.dataApi.query('SELECT Name, Id FROM Account')
          console.log('Query results:', {
            totalSize: queryResult.totalSize,
            done: queryResult.done,
            recordCount: queryResult.records.length
          })

          // Transform the records to the expected format
          const accounts = queryResult.records.map(record => ({
            Name: record.fields.Name,
            Id: record.fields.Id
          }))

          return {
            connectionName: connectionName.trim(),
            accounts
          }
        } catch (error) {
          console.error(`Error querying org ${connectionName}:`, error)
          return {
            connectionName: connectionName.trim(),
            error: error.message,
            accounts: []
          }
        }
      })
    )

    res.render('pages/index', { accountsByOrg })
  } catch (error) {
    console.error('Error rendering index:', error)
    res.status(500).send(error.message)
  }
})