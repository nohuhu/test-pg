const expect = require('expect.js');

describe("basic stuff", function() {
    let TestPg = require('../src/testpg');
    
    describe("class", function() {
        it("should export TestPg class", function() {
            expect(typeof TestPg).to.be('function');
        });
        
        it("should construct a new instance", function() {
            const testpg = new TestPg({ _skipInit: true });
            
            expect(typeof testpg).to.be('object');
        });
    });

    describe("pool options", function() {
        const Client = function() {
            this.isClient = true;
        };
        
        let testpg;
        
        beforeEach(function() {
            testpg = new TestPg({
                _skipInit: true,
                host: 'fumblemumble',
                port: 23451,
                database: 'zorg',
                user: 'screeble',
                max: 1000,
                idleTimeoutMillis: 1,
                Client,
            });
        });
        
        afterEach(function() {
            testpg = null;
        });
        
        it("should accept extra config options for the pool", function() {
            expect(testpg._poolOptions).to.eql({
                max: 1000,
                idleTimeoutMillis: 1,
                Client,
            });
        });
        
        it("should pass pool options to the Pool object", function() {
            const pool = testpg.getPool();
            
            expect(pool.options.max).to.be(1000);
            expect(pool.options.idleTimeoutMillis).to.be(1);
            expect(pool.Client).to.be(Client);
            expect(pool.Promise).to.be(Promise);
        });
        
        it("should use Client constructor from config", function() {
            const client = testpg._getClient();
            
            expect(client.isClient).to.be(true);
        });
    });
    
    describe("client connection parameters", function() {
        let testpg;
        
        beforeEach(function() {
            testpg = new TestPg({
                _skipInit: true,
                host: 'gurgleplugh',
                port: 54321,
                database: 'blerg',
                user: 'foobaroo',
                password: 'throbbozongo',
            });
        });
        
        afterEach(function() {
            testpg = null;
        });
        
        it("should construct correct connectionString", function() {
            expect(testpg.connectionString)
                .to.be('postgresql://foobaroo:throbbozongo@127.0.0.1:54321/blerg');
        });
        
        it("should construct correct client connection parameter object", function() {
            const params = testpg._clientConnectionParams();
            
            expect(params).to.eql({
                host: '127.0.0.1',
                port: 54321,
                database: 'blerg',
                user: 'foobaroo',
                password: 'throbbozongo',
            });
        });
        
        it("should accept extra parameters for client connection", function() {
            const params = testpg._clientConnectionParams({
                fubaru: 'bletch',
                zarg: 'poot',
            });
            
            expect(params).to.eql({
                host: '127.0.0.1',
                port: 54321,
                database: 'blerg',
                user: 'foobaroo',
                password: 'throbbozongo',
                fubaru: 'bletch',
                zarg: 'poot',
            });
        });
    });
});
