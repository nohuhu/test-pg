const expect = require('expect.js');

describe("basic stuff", function() {
    let TestPg = require('../src/testpg');
    
    describe("class", function() {
        it("should export TestPg class", function() {
            expect(typeof TestPg).to.be('function');
        });
        
        it("should construct new instance", function() {
            const testpg = new TestPg({ _skipInit: true });
            
            expect(typeof testpg).to.be('object');
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
            const params = testpg.clientConnectionParameters();
            
            expect(params).to.eql({
                host: '127.0.0.1',
                port: 54321,
                database: 'blerg',
                user: 'foobaroo',
                password: 'throbbozongo',
            });
        });
    });
});
