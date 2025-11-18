require('dotenv').config();
const express = require('express')
const path = require('path');
const { init } = require('@heroku/applink');
const jsforce = require('jsforce');
const salesforcesdk = require('@heroku/salesforce-sdk-nodejs');

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
  const accountsByOrg = await Promise.all(
  connectionNames.map(async (connectionName) => {
    try {
      console.log('SDK initialized:', sdk.addons.applink);
      console.log('SDKK :', sdkk.addons.applink);
      const sdkk = salesforcesdk.init();
console.log('Connection names:', connectionNames);
      const org = await sdkk.addons.applink.getAuthorization(connectionName.trim());
if (!org || !org.dataApi) {
  throw new Error(`Org ${connectionName} is not properly authorized`);
}

      console.log('Connected to Salesforce org:', {
        orgId: org.id,
        username: org.user.username
      });

      const queryResult = await org.dataApi.query('SELECT Name, Id FROM Account');
      const accounts = queryResult.records.map(record => ({
        Name: record.fields.Name,
        Id: record.fields.Id
      }));

      return { connectionName, accounts };
    } catch (error) {
      console.error(`Error querying org ${connectionName}:`, error.message);
      return {
        connectionName,
        error: error.message.includes('500') 
          ? 'Internal Server Error: Check AppLink configuration or reconnect the org.'
          : error.message,
        accounts: []
      };
    }
  })
);
})

const server = app.listen(port, () => {
  console.log(`Listening on ${port}`)
})

process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: gracefully shutting down')
  if (server) {
    server.close(() => {
      console.log('HTTP server closed')
    })
  }
})