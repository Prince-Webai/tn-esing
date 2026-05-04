const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function checkDatabase() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.log('Connected to MariaDB successfully!');

    const [tables] = await connection.query('SHOW TABLES');
    console.log('Tables in database:');
    console.log(tables);

    for (const table of tables) {
      const tableName = Object.values(table)[0];
      console.log(`\nSchema for table: ${tableName}`);
      const [schema] = await connection.query(`DESCRIBE \`${tableName}\``);
      console.table(schema);
    }

  } catch (err) {
    console.error('Error connecting to MariaDB:', err);
  } finally {
    if (connection) await connection.end();
  }
}

checkDatabase();
