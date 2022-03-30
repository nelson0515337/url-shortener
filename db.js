const Pool = require('pg').Pool;

const pool = new Pool({
    user: 'kevin',
    password: 'kd861027',
    database: 'demodb',
    port: 5432
});

module.exports = pool;