'use strict';

let singleton = Symbol();
let singletonEnforcer = Symbol();

class StandAloneConn {
    constructor(enforcer) {
        if (enforcer !== singletonEnforcer) {
            throw "Cannot construct singleton";
        }

        console.log ("StandAloneConn constructor")

        this.conn = 0;
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
}

module.exports = StandAloneConn.instance;