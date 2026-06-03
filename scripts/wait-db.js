const { Client } = require('pg');
const url = process.env.DATABASE_URL;
const client = new Client({ connectionString: url });
client.connect()
  .then(() => client.end())
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
