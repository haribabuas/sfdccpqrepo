var express = require('express');
const axios = require('axios');
var bodyParser = require('body-parser');
var pg = require('pg');
const { sdkMiddleware } = require('@heroku/salesforce-sdk-nodejs');
var app = express();

const port = process.env.PORT || 3000;
app.use(express.json());
app.use(sdkMiddleware());


function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

app.post('/create-quote-lines-sap', async (req, res) => {
  const { quoteId, sapLineIds } = req.body;
  const { event, context, logger } = req.sdk;
  console.log('Incoming request body:', req.body);
  const org = context.org;
    console.log('Org detaisl:', org);
    logger.info(`Querying Quote with Id: ${quoteId} from org ${org.id}`);
    const sapLineChunks = chunkArray(sapLineIds, 200);

    const sapLineQueries = sapLineChunks.map(chunk => {
      const query = `
        SELECT Id, License_Type__c, Quantity__c, End_Date_Consolidated__c,
               CPQ_Product__c, Install__c,
               CPQ_Product__r.Access_Range__c,
               Install__r.AccountID__c, Install__r.Partner_Account__c, Install__r.CPQ_Sales_Org__c
        FROM SAP_Install_Line_Item__c
        WHERE Id IN (${chunk.map(id => `'${id}'`).join(',')})
      `;
       return org.dataApi.query(query);
      //return conn.query(query);
    });

    const queryResults = await Promise.all(sapLineQueries);
    const allSapLines = queryResults.flatMap(result => result.records);
    console.log(`Total SAP lines fetched: ${allSapLines.length}`);
    
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

