require('dotenv').config();
const express = require('express');
const path = require('path')
const { init } = require('@heroku/applink')


const port = process.env.PORT || 5006
const app = express()
app.use(express.json());

// Initialize Salesforce SDK
const sdk = init();
console.log('@@@sdkini',sdk);
app.use(sdk.express());
// Get connection names from environment variable
const connectionNames = process.env.CONNECTION_NAMES ? process.env.CONNECTION_NAMES.split(',') : []
console.log('@@@connectionNames',connectionNames);
app.use(express.static(path.join(__dirname, 'public')))
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')


function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

app.post('/create-quote-lines-sap', async (req, res) => {
 /* const emptyOrgName = 'devcpq-org'
    console.log('@@@emptyOrgName',emptyOrgName);
    console.log('@@@reqsdk',req);
    if (!connectionNames.includes(emptyOrgName)) {
      return res.status(400).send('empty-org connection not found')
    }
    
      try {
      const org = await sdk.addons.applink.getAuthorization(emptyOrgName);
      console.log('@@@org', org);
    } catch (err) {
      console.error('Authorization error:', err);
    }*/
  
  try {
    const { quoteId, sapLineIds } = req.body;
    const { event, context, logger } = req.sdk;
    console.log('@@@quoteId ',quoteId);
    if (!quoteId || !sapLineIds || sapLineIds.length === 0) {
      return res.status(400).json({ status: 'error', message: 'Missing quoteId or sapLineIds' });
    }

    logger.info(`Processing Quote: ${quoteId}`);
    const org = context.org;
    console.log('@@@org ',org);
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
    });

    const queryResults = await Promise.all(sapLineQueries);
    const allSapLines = queryResults.flatMap(result => result.records);

    logger.info(`Total SAP lines fetched: ${allSapLines.length}`);

    return res.json({
      status: 'success',
      quoteId,
      totalLines: allSapLines.length,
      sapLines: allSapLines
    });
  } catch (error) {
    console.error('Error fetching SAP lines:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});