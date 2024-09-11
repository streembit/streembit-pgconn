
const assert = require('assert');

const EventEmitter = require('events');
const { PatroniConn, StandAloneConn } = require("../index.js")

describe("Patroni connection handler", () => {
    describe("Patroni event handler instance", function () {
        it("the PatroniConn instance should return an EventEmitter object", function () {
            assert.equal(true, PatroniConn instanceof EventEmitter);
        });
    });

});