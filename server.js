const express = require('express');
const { sdkMiddleware } = require('@heroku/salesforce-sdk-nodejs');
const app = express();

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
  try {
    const { quoteId, sapLineIds } = req.body;
    const { event, context, logger } = req.sdk;

    if (!quoteId || !sapLineIds || sapLineIds.length === 0) {
      return res.status(400).json({ status: 'error', message: 'Missing quoteId or sapLineIds' });
    }

    logger.info(`Processing Quote: ${quoteId}`);
    const org = context.org;

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