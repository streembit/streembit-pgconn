'use strict';

const EventEmitter = require('events');
const PostgreSQLHandler = require("../postgre")


let singleton = Symbol();
let singletonEnforcer = Symbol();

const ROLE_REPLICA = "replica";
const ROLE_MASTER = "master";
const STATE_RUNNING = "running";
const EVENT_SRV_INITIALIZED = "srvinitialized";
const EVENT_POOL = "poolevent";
const EVENT_ERROR = "error";
const CHKINTERVAL = 5000;

class PatroniServer extends PostgreSQLHandler {
    constructor(host, dbport, healthport, dbuser, dbpass, database, protocol) {

        super(host, dbport, dbuser, dbpass, database, protocol);

        this.Protocol = protocol;
        this.HealthPort = healthport;
        this.HealthUri = `${this.Protocol}://${host}:8008`;
        this.IsRunning = false;
        this.Role = undefined;
        this.IsMaster = false;
        this.IsReplica = false;    

        this.PoolIsInvalid = true;

        this.ChkTimerId = undefined;
    }

    async CreatePool() {
        await super.CreatePool();
        if (this.Pool) {
            this.PoolIsInvalid = false;            
        }
    }

    async Terminate() {
        await super.Terminate();
        try {
            if (this.ChkTimerId) {
                clearInterval(this.ChkTimerId);
            }
        }
        catch (err) {
            console.log(`Closing timer failed: ${err.message | err}`);
        }      
    }

    validatechk(state, role) {

        this.IsRunning = false;

        const new_isrunning_state = state === STATE_RUNNING;
        if (this.IsRunning != new_isrunning_state) {
            // the connection pool must be reinitialized            
            this.PoolIsInvalid = true;
            if (new_isrunning_state === false) {
                //TODO close the connection pool
            }
        }

        this.IsRunning = new_isrunning_state;

        this.Role = role;
        if (this.Role === ROLE_REPLICA) {
            this.IsReplica = true;
            this.IsMaster = false;
        }
        else if (this.Role === ROLE_MASTER) {
            this.IsReplica = false;
            this.IsMaster = true;
        }
        else {
            // invalid role in the response
            this.IsReplica = false;
            this.IsMaster = false;
            return false;
        }

        //console.log(`PatroniConn healtcheck for host ${this.Host}: role is ${this.Role} the server is ${this.IsRunning ? "running" : "not running" }`);

        return true;
    }

    chksrv() {
        fetch(this.HealthUri, { headers: {'Accept': 'application/json'} })
            .then(response => response.json())
            .then((data) => {
                let result = this.validatechk(data.state, data.role);
                //console.log(`chksrv() at ${this.HealthUri} ${new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')} result: ${result} state: ${data.state} role: ${data.role}`);
            })
            .catch((err) =>{
                console.log(`chksrv() unable to fetch at ${this.HealthUri}`, err);
            });

    }

    chktimer() {
        this.ChkTimerId = setInterval(() => {
            this.chksrv()
        },
        CHKINTERVAL);
    }

    // Populate data about the node such as the role  
    async initialize() {
        try {
            this.chktimer();

            const response = await fetch(this.HealthUri, {
                headers: {
                    'Accept': 'application/json'
                }
            });
            const data = await response.json()
            if (data) {
                return this.validatechk(data.state, data.role);
            }
            else {
                return false;
            }
            
        }
        catch (err) {
            throw new Error(`Initializing ${this.Host} failed: ${err.message}`)
        }

        return false;
    }
}


class PatroniConn extends EventEmitter {
    constructor(enforcer) {
        if (enforcer !== singletonEnforcer) {
            throw "Cannot construct singleton";
        }

        // call the events constructor
        super();   

        this.Servers = [];
    }

    static get instance() {
        if (!this[singleton]) {
            this[singleton] = new PatroniConn(singletonEnforcer);
        }
        return this[singleton];
    }

    getserver(isreplica=false) {
        for (let i = 0; i < this.Servers.length; i++) {
            if (this.Servers[i].IsReplica == isreplica) {
                if (isreplica) {
                    return this.Servers[i];
                }
                else {
                    // check if the server is really a master
                    if (this.Servers[i].IsMaster === true) {
                        return this.Servers[i];
                    }                    
                }
                
            }
        }
    }

    async execute(query, params, callback, isreplica = false) {
        try {
            if (!callback || (typeof callback !== "function")) {
                return this.emit(EVENT_ERROR, "Invalid callback function at execute()");
            }

            // get the write server
            const srv = this.getserver(isreplica);
            if (!srv) {
                return this.emit(EVENT_ERROR, "Unable to find a server at execute()");
            }

            const result = await srv.ExecuteQuery(query, params);
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
  
    async initpools() {
        for (let i = 0; i < this.Servers.length; i++) {
            try {
                await this.Servers[i].CreatePool();
                this.emit(EVENT_POOL, `Connection pool is created at ${this.Servers[i].Host}`);
            }
            catch (err) {
                this.emit(EVENT_ERROR, `Failed to initilize database server connection at ${this.Servers[i].Host}. Error: ${err.message | err}`);
            }
        }
    }

    async shutdown() {
        console.log("shutdown PatroniConn");
        for (let i = 0; i < this.Servers.length; i++) {
            try {
                await this.Servers[i].Terminate();
            }
            catch (err) {
                this.emit(EVENT_ERROR, err);
            }
        }
    }

    async srvsinits() {
        for (let i = 0; i < this.Servers.length; i++) {
            try {
                let result = await this.Servers[i].initialize();
                if (!result) {
                    this.emit(EVENT_ERROR, `Failed to initilize database server connection at ${this.Servers[i].Host}`);
                }
            }
            catch (err) {
                this.emit(EVENT_ERROR, err);
            }
        }
    }

    async init(servers, dbport, healthport, protocol, dbuser, dbpass, database) {
        if (!servers || !Array.isArray(servers) || servers.length < 3) {
            throw new Error("Invalid patroni servers parameter")
        }

        if (!dbport) {
            throw new Error("Invalid patroni database port parameter")
        }

        if (!healthport) {
            throw new Error("Invalid patroni database healthport parameter")
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

        this.servers = servers;
        this.dbport = dbport;
        this.healthport = healthport;

        servers.forEach((host) => {
            this.Servers.push(new PatroniServer(host, dbport, healthport, dbuser, dbpass, database, protocol));
        });

        // Initialize the server connection by first identifying the roles and statuses of nodes
        await this.srvsinits();

        // Create the database connection pools 
        await this.initpools();

        // initialize the health check loop
        //this.chkinit();

        for (let i = 0; i < this.Servers.length; i++) {
            this.emit(EVENT_SRV_INITIALIZED, this.Servers[i].Host, this.Servers[i].Role, this.Servers[i].IsRunning);
        }
    }
}

module.exports = PatroniConn.instance;