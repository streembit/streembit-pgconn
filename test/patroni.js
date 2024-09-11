
const assert = require('assert');
const expect = require("chai").expect;

const EventEmitter = require('events');
const { PatroniConn, StandAloneConn } = require("../index.js")

describe("Patroni connection handler", () => {
    it("Patroni event handler instance", function () {
        it("the PatroniConn instance should return an EventEmitter object", function () {
            assert.equal(true, PatroniConn instanceof EventEmitter);
        });
    });
    it("init() should thrown an exception when the servers parameter is not defined", async () => {
        return PatroniConn.init()
            .catch((err) => {
                expect(err).to.have.property('message');
            });  
    });
    it("init() should thrown an exception when the servers parameterarray length is smaller than 3", async () => {
        return PatroniConn.init([])
            .catch((err) => {
                expect(err).to.have.property('message');
            });
    });
    it("init() should thrown an exception when the dbport parameter is not defined", async () => {
        return PatroniConn.init(["a", "b", "c"])
            .catch((err) => {
                expect(err).to.have.property('message').include("port");
            });
    });
    it("init() should thrown an exception when the healthport parameter is not defined", async () => {
        return PatroniConn.init(["a", "b", "c"], "1234" )
            .catch((err) => {
                expect(err).to.have.property('message').include("healthport");
            });
    });
    it("init() should thrown an exception when the protocol parameter is not defined", async () => {
        return PatroniConn.init(["a", "b", "c"], "1234", "5678")
            .catch((err) => {
                expect(err).to.have.property('message').include("protocol");
            });
    });
    it("init() should thrown an exception when the dbuser parameter is not defined", async () => {
        return PatroniConn.init(["a", "b", "c"], "1234", "5678", "http")
            .catch((err) => {
                expect(err).to.have.property('message').include("dbuser");
            });
    });
    it("init() should thrown an exception when the dbpass parameter is not defined", async () => {
        return PatroniConn.init(["a", "b", "c"], "1234", "5678", "http", "user")
            .catch((err) => {
                expect(err).to.have.property('message').include("dbpass");
            });
    });
    it("init() should thrown an exception when the database name parameter is not defined", async () => {
        return PatroniConn.init(["a", "b", "c"], "1234", "5678", "http", "user", "pwd")
            .catch((err) => {
                expect(err).to.have.property('message').include("database name");
            });
    });
});