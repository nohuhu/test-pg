const expect = require('expect.js');

const TestPg = require('../src/testpg');

let doIt;

try {
    doIt = new TestPg({ _skipInit: true }).postmaster ? describe : xdescribe;
}
catch (e) {
    doIt = xdescribe;
}

doIt("pg-pool api compat", function() {
    describe("connect", function() {
        let testpg;
        
        beforeEach(function() {
            testpg = new TestPg();
        });
        
        afterEach(function() {
            if (testpg && testpg.started) {
                return testpg.stop();
            }
            
            testpg = null;
        });
        
        it("should start the instance the first time connect() is called", async function() {
            // Sanity check
            expect(testpg.started).to.be(false);
            
            const client = await testpg.connect();
            
            expect(typeof client.query).to.be('function');
            expect(testpg.started).to.be(true);
        });
        
        it("should accept callback", function(done) {
            expect(testpg.started).to.be(false);
            
            testpg.connect((error, client) => {
                expect(error == null).to.be(true);
                expect(typeof client.query).to.be('function');
                expect(testpg.started).to.be(true);
                
                done();
            });
        });
    });
    
    describe("query", function() {
        let testpg;
        
        before(function() {
            testpg = new TestPg();
        });
        
        after(function() {
            if (testpg && testpg.started) {
                return testpg.stop();
            }
            
            testpg = null;
        });
        
        it("should start and connect the first time query() is called", async function() {
            expect(testpg.started).to.be(false);
            
            const result = await testpg.query(
                'SELECT datname FROM pg_database ORDER BY datname'
            );
            
            expect(testpg.started).to.be(true);
            expect(result.rows).to.eql([
                { datname: 'postgres' },
                { datname: 'template0' },
                { datname: 'template1' },
                { datname: 'test' },
            ]);
        });
        
        it("should accept text, values, and cb arguments", function(done) {
            testpg.query(
                'SELECT datname FROM pg_database WHERE datname LIKE $1 ORDER BY datname',
                ['template%'],
                (error, result) => {
                    expect(error == null).to.be(true);
                    expect(result.rows).to.eql([
                        { datname: 'template0' },
                        { datname: 'template1' },
                    ]);
                    
                    done();
                }
            );
        });
        
        describe("getters", function() {
            it("should return waitingCount", function() {
                expect(testpg.waitingCount).to.be(0);
            });
            
            it("should return idleCount", function() {
                expect(testpg.idleCount).to.be(1);
            });
            
            it("should return totalCount", function() {
                expect(testpg.totalCount).to.be(1);
            });
        });
    });
    
    describe("end", function() {
        let testpg;
        
        beforeEach(function() {
            testpg = new TestPg();
            
            return testpg.start();
        });
        
        afterEach(function() {
            if (testpg && testpg.started) {
                return testpg.stop();
            }
            
            testpg = null;
        });
        
        it("should support Promise based invocation", async function() {
            await testpg.end();
            
            expect(testpg._pool.ending).to.be(true);
            expect(testpg.started).to.be(false);
        });
        
        it("should support callback based invocation", function(done) {
            testpg.end((error) => {
                expect(error == null).to.be(true);
                expect(testpg._pool.ending).to.be(true);
                expect(testpg.started).to.be(false);
                
                done();
            });
        });
    });
});
