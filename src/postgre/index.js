'use strict';

const { Pool } = require('pg');

const MAXCONNS = 50;
const IDDLETIMEOUTMILLS = 30000;
const CONNTIMEOUTMILLS = 5000;

class PostgreSQLHandler {
    constructor(host, dbport, dbuser, dbpass, database, protocol) {
        this.Host = host;        
        this.DbPort = dbport;
        this.DbUser = dbuser;
        this.DbPassword = dbpass;
        this.Database = database;
        this.IsSSL = protocol === "https" ? true : false;

        // the main pool object
        this.Pool = undefined;
    }

    async CreatePool() {
        const config = {
            host: this.Host,
            user: this.DbUser,
            password: this.DbPassword,
            max: MAXCONNS,
            database: this.Database,
            ssl: this.IsSSL,
            idleTimeoutMillis: IDDLETIMEOUTMILLS,
            connectionTimeoutMillis: CONNTIMEOUTMILLS
        };
            
        this.Pool = new Pool(config);
    }

    async Terminate() {
        // release the resources here
        console.log(`Close database pool at ${this.Host}`);
        await this.Pool?.end();
    }

    async ExecuteQuery(query, params) {
        if (!this.Pool) {
            throw new Error(`Database pool does not exists at PostgreSQLHandler host: ${this.Host}`);
        }

        let client = await this.Pool.connect()
        const result = await client.query(query, params);
        client.release();

        return result;
    }
}

module.exports = PostgreSQLHandler;