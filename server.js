var express = require('express');
const axios = require('axios');
var bodyParser = require('body-parser');
var pg = require('pg');

var app = express();

const port = process.env.PORT || 3000;
console.log('2233Se',process.env.DATABASE_URL);
var connectionString = "postgres://u53mp4qmcr9ml5:p93b5813abff26b78ce5d548dd5d36f08311d35026ff75c23f7095301e9a608e1@c7itisjfjj8ril.cluster-czrs8kj4isg7.us-east-1.rds.amazonaws.com:5432/dakm542hgqntso";

const { Pool } = require('pg');
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});


app.get('/', (req, res) => {
  res.send('Heroku App is running!');
});

// API endpoint to get record by Salesforce ID
app.get('/pricebook/:recordId', async (req, res) => {
  const recordId = req.params.recordId;
  
  try {
    const result = await pool.query(
      'SELECT * FROM salesforce.disw_price_book__c'
    );
    
    console.log('@@@leng',result.rows.length);
    //res.json(result);
    if (result.rows.length > 0) {
      
 console.log('@@@leng',result.rows[0]);
    res.json(result.rows);
    } 
    else {
      res.status(404).send('Record not found');
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Server errorcust43om');
  }
});

const jsforce = require('jsforce');
app.use(express.json());
app.post('/create-price-book', async (req, res) => {
  const recordData = req.body;
  console.log('@@@'+recordData);
  const conn = new jsforce.Connection({
    accessToken: req.headers['authorization']?.split(' ')[1],
    instanceUrl: req.headers['salesforce-instance-url']
  });
  console.log('@@@conn'+conn);
  try {
    const result = await conn.sobject("contact").create(recordData);
    res.status(200).json({ message: "Record created", result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/clone-contact', async (req, res) => {
  const { accountId } = req.body;
  console.log('@@req ',req.body);
  const accessToken = req.headers['authorization']?.split(' ')[1];
  const instanceUrl = req.headers['salesforce-instance-url'];

  if (!accessToken || !instanceUrl || !accountId) {
    return res.status(400).json({ error: 'Missing required data' });
  }

  const conn = new jsforce.Connection({ accessToken, instanceUrl });

  try {
    
    const contacts = await conn.query(
      `SELECT FirstName, LastName, Email, AccountId FROM Contact WHERE AccountId = '${accountId}' LIMIT 1`
    );
    console.log('@@',contacts);
    if (!contacts.records.length) {
      return res.status(404).json({ error: 'No contact found for this account' });
    }

    const contact = contacts.records[0];

   
    const newContact = {
      FirstName: contact.FirstName,
      LastName: contact.LastName,
      Email: contact.Email,
      AccountId: contact.AccountId
    };

    const result = await conn.sobject('Contact').create(newContact);

    res.status(200).json({ message: 'Contact cloned', result });
  } catch (err) {
    console.error('Error cloning contact:', err);
    res.status(500).json({ error: err.message });
  }
});


app.post('/create-quote-lines', async (req, res) => {
  const { quoteId, sapInstallLines } = req.body;
  const accessToken = req.headers['authorization']?.split(' ')[1];
  const instanceUrl = req.headers['salesforce-instance-url'];

  if (!accessToken || !instanceUrl || !quoteId || !sapInstallLines) {
    return res.status(400).json({ error: 'Missing required data' });
  }

  const conn = new jsforce.Connection({ accessToken, instanceUrl });

  try {
    const quoteLinesToInsert = [];

    for (const lineItem of sapInstallLines) {
      
     // const licenseType = translateLicenseType(lineItem.License_Type__c);

      
      const startDate = lineItem.End_Date_Consolidated__c
        ? getAdjustedStartDate(lineItem.End_Date_Consolidated__c)
        : new Date();
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 12);

      const quoteLine = {
        SBQQ__Product__c: lineItem.CPQ_Product__c,
        SBQQ__Quote__c: quoteId,
        Install__c: lineItem.Install__c,
        Access_Range__c: lineItem.CPQ_Product__r?.Access_Range__c,
        Account__c: lineItem.Install__r?.AccountID__c,
        Partner_Account__c: lineItem.Install__r?.Partner_Account__c,
        Sales_Org__c: lineItem.Install__r?.CPQ_Sales_Org__c,
        SBQQ__Quantity__c: lineItem.Quantity__c,
        SBQQ__StartDate__c: startDate.toISOString().split('T')[0],
        SBQQ__EndDate__c: endDate.toISOString().split('T')[0],
        CPQ_License_Type__c: 'MAINT'
      };

      quoteLinesToInsert.push(quoteLine);
    }

    const result = await conn.sobject('SBQQ__QuoteLine__c').create(quoteLinesToInsert);
    res.status(200).json({ message: 'Quote lines created', result });
  } catch (err) {
    console.error('Error creating quote lines:', err);
    res.status(500).json({ error: err.message });
  }
});

function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

app.post('/create-quote-lines-sap', async (req, res) => {
  const { quoteId, sapLineIds } = req.body;
  const accessToken = req.headers['authorization']?.split(' ')[1];
  const instanceUrl = req.headers['salesforce-instance-url'];

  if (!accessToken || !instanceUrl || !quoteId || !sapLineIds?.length) {
    return res.status(400).json({ error: 'Missing required data' });
  }

  const conn = new jsforce.Connection({ accessToken, instanceUrl });

  try {
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
      return conn.query(query);
    });

    const queryResults = await Promise.all(sapLineQueries);
    const allSapLines = queryResults.flatMap(result => result.records);

    const quoteLinesToInsert = allSapLines.map(lineItem => {
      const startDate = lineItem.End_Date_Consolidated__c
        ? getAdjustedStartDate(lineItem.End_Date_Consolidated__c)
        : new Date();
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 12);

      return {
        SBQQ__Product__c: lineItem.CPQ_Product__c,
        SBQQ__Quote__c: quoteId,
        Install__c: lineItem.Install__c,
        Access_Range__c: lineItem.CPQ_Product__r?.Access_Range__c,
        Account__c: lineItem.Install__r?.AccountID__c,
        Partner_Account__c: lineItem.Install__r?.Partner_Account__c,
        Sales_Org__c: lineItem.Install__r?.CPQ_Sales_Org__c,
        SBQQ__Quantity__c: lineItem.Quantity__c,
        SBQQ__StartDate__c: startDate.toISOString().split('T')[0],
        SBQQ__EndDate__c: endDate.toISOString().split('T')[0],
        CPQ_License_Type__c: 'MAINT'
      };
    });

    const quoteLineChunks = chunkArray(quoteLinesToInsert, 200);
    const insertResults = await Promise.all(
      quoteLineChunks.map(chunk => conn.sobject('SBQQ__QuoteLine__c').create(chunk))
    );

    const allResults = insertResults.flat();

    res.status(200).json({ message: 'Quote lines created', result: allResults.size() });
  } catch (err) {
    console.error('Error creating quote lines:', err);
    res.status(500).json({ error: err.message });
  }
});



function getAdjustedStartDate(dateStr) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + 1);
  return date;
}



app.post('/get-json-from-salesforce', async (req, res) => {
  const { parentId } = req.body;
  const accessToken = req.headers['authorization']?.split(' ')[1];
  const instanceUrl = req.headers['salesforce-instance-url'];

  if (!parentId || !accessToken || !instanceUrl) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }
    console.log('@@req.body',req.body);
  try {
   
    const linkQuery = `
      SELECT ContentDocumentId 
      FROM ContentDocumentLink 
      WHERE LinkedEntityId = '${parentId}' 
      ORDER BY ContentDocumentId DESC 
      LIMIT 1
    `;
    const linkRes = await axios.get(
      `${instanceUrl}/services/data/v59.0/query?q=${encodeURIComponent(linkQuery)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    console.log('@@linkRes',linkRes);
    const contentDocumentId = linkRes.data.records[0]?.ContentDocumentId;
    if (!contentDocumentId) {
      return res.status(404).json({ error: 'No file linked to this record' });
    }

   console.log('@@contentDocumentId',contentDocumentId);
    const versionQuery = `
      SELECT Id, VersionData 
      FROM ContentVersion 
      WHERE ContentDocumentId = '${contentDocumentId}' 
      ORDER BY CreatedDate DESC 
      LIMIT 1
    `;
    const versionRes = await axios.get(
      `${instanceUrl}/services/data/v59.0/query?q=${encodeURIComponent(versionQuery)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const versionId = versionRes.data.records[0]?.Id;
    const versionDataUrl = versionRes.data.records[0]?.VersionData;
    console.log('@@versionId',versionId);
    if (!versionId || !versionDataUrl) {
      return res.status(404).json({ error: 'No version data found' });
    }

    
    const fileRes = await axios.get(`${instanceUrl}${versionDataUrl}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    let jsonData;

    try {
        if (typeof fileRes.data === 'string') {
            jsonData = JSON.parse(fileRes.data);
        } else {
            jsonData = fileRes.data;
        }
        } catch (err) {
        console.error('Failed to parse JSON:', err.message);
        return res.status(500).json({ error: 'Invalid JSON format in file' });
    }

    res.status(200).json({ message: 'File retrieved successfully', data: jsonData });

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to retrieve file' });
  }
});


/*app.post('/create-price-book', async (req, res) => {
  const recordData = req.body;
  console.log('@@@Creat',recordData);
  const authHeader = req.headers['authorization'];
  const accessToken = authHeader?.split(' ')[1];
  const instanceUrl = req.headers['salesforce-instance-url'];

  if (!accessToken || !instanceUrl) {
    return res.status(401).json({ error: 'Missing Salesforce auth info' });
  }

  const conn = new jsforce.Connection({
    accessToken,
    instanceUrl
  });

  try {
    const result = await conn.sobject("disw_price_book__c").create(recordData);
    res.status(200).json({ message: "Record created", result });
  } catch (err) {
    console.error("Insert error:", err);
    res.status(500).json({ error: err.message });
  }
});*/


app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});


/*app.use(express.static('public'));
app.use(bodyParser.json());

app.post('/update', function(req, res) {
    pg.connect(process.env.DATABASE_URL, function (err, conn, done) {
        // watch for any connect issues
        if (err) console.log(err);
        conn.query(
            'UPDATE salesforce.Contact SET Phone = $1, MobilePhone = $1 WHERE LOWER(FirstName) = LOWER($2) AND LOWER(LastName) = LOWER($3) AND LOWER(Email) = LOWER($4)',
            [req.body.phone.trim(), req.body.firstName.trim(), req.body.lastName.trim(), req.body.email.trim()],
            function(err, result) {
                if (err != null || result.rowCount == 0) {
                  conn.query('INSERT INTO salesforce.Contact (Phone, MobilePhone, FirstName, LastName, Email) VALUES ($1, $2, $3, $4, $5)',
                  [req.body.phone.trim(), req.body.phone.trim(), req.body.firstName.trim(), req.body.lastName.trim(), req.body.email.trim()],
                  function(err, result) {
                    done();
                    if (err) {
                        res.status(400).json({error: err.message});
                    }
                    else {
                        // this will still cause jquery to display 'Record updated!'
                        // eventhough it was inserted
                        res.json(result);
                    }
                  });
                }
                else {
                    done();
                    res.json(result);
                }
            }
        );
    });
});*/
