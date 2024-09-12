'use strict';

const EventEmitter = require('events');
const PostgreSQLHandler = require("../postgre")

const EVENT_SRV_INITIALIZED = "srvinitialized";
const EVENT_POOL = "poolevent";
const EVENT_ERROR = "error";

let singleton = Symbol();
let singletonEnforcer = Symbol();

class PostgresServer extends PostgreSQLHandler {
    constructor(host, dbport, dbuser, dbpass, database, protocol) {
        super(host, dbport, dbuser, dbpass, database, protocol);
    }

    async CreatePool() {
        await super.CreatePool();
    }

    async Terminate() {
        await super.Terminate();
    }

    validatechk() {
        return true;
    }

    chksrv() {
    }

    chktimer() {
    }

    // Populate data about the node such as the role  
    async initialize() {
        try {
            this.chktimer();
            return true;
        }
        catch (err) {
            throw new Error(`Initializing db failed: ${err.message}`)
        }

        return false;
    }
}


class StandAloneConn extends EventEmitter {
    constructor(enforcer) {
        if (enforcer !== singletonEnforcer) {
            throw "Cannot construct singleton";
        }
        // call the events constructor
        super();

        this.Server = undefined;
    }

    static get instance() {
        if (!this[singleton]) {
            this[singleton] = new StandAloneConn(singletonEnforcer);
        }
        return this[singleton];
    }

    execute() {
        console.log("StandAloneConn execute")
    }

    close() {
        console.log("StandAloneConn close connection")
    }

    async execute(query, params, callback) {
        try {
            if (!callback || (typeof callback !== "function")) {
                return this.emit(EVENT_ERROR, "Invalid callback function at execute()");
            }

            const result = await this.Server.ExecuteQuery(query, params);
            callback(null, result);

            //
        }
        catch (err) {
            if (callback && (typeof callback == "function")) {
                callback(err);
            }
            else {
                this.emit(EVENT_ERROR, err);
            }
        }
    }

    async execute_read(query, params, callback) {
        // console.log("Using the replica server")
        this.execute(query, params, callback, true);
    }

    async initpool() {
        try {
            await this.Server.CreatePool();
            this.emit(EVENT_POOL, `Connection pool is created at ${this.Server.Host}`);
        }
        catch (err) {
            this.emit(EVENT_ERROR, `Failed to initilize database server connection at ${this.Server.Host}. Error: ${err.message | err}`);
        }
    }

    async shutdown() {
        console.log("shutdown PatroniConn");
        for (let i = 0; i < this.Servers.length; i++) {
            try {
                await this.Server.Terminate();
            }
            catch (err) {
                this.emit(EVENT_ERROR, err);
            }
        }
    }

    async init(host, dbport, dbuser, dbpass, database, protocol) {
        if (!host) {
            throw new Error("Invalid patroni database host parameter")
        }

        if (!dbport) {
            throw new Error("Invalid patroni database port parameter")
        }

        if (!protocol) {
            throw new Error("Invalid patroni database protocol parameter")
        }

        if (!dbuser) {
            throw new Error("Invalid patroni database dbuser parameter")
        }

        if (!dbpass) {
            throw new Error("Invalid patroni database dbpass parameter")
        }

        if (!database) {
            throw new Error("Invalid patroni database name parameter")
        }


        this.Server = new PostgresServer(host, dbport, dbuser, dbpass, database, protocol);

        // Create the database connection pools 
        await this.initpool();

        // initialize the health check loop
        //this.chkinit();

        this.emit(EVENT_SRV_INITIALIZED, this.Server.Host);        
    }
}

module.exports = StandAloneConn.instance;