var express = require('express');
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
    const result = await conn.sobject("disw_price_book__c").create(recordData);
    res.status(200).json({ message: "Record created", result });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
