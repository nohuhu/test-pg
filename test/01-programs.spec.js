const path = require('path');
const expect = require('expect.js');
const TestPg = require('../src/testpg');

describe("programs", function() {
    let testpg, hadPostgresHome, oldPostgresHome;
    
    before(function() {
        if ('POSTGRES_HOME' in process.env) {
            hadPostgresHome = true;
            oldPostgresHome = process.env.POSTGRES_HOME;
        }
    });
    
    after(function() {
        if (hadPostgresHome) {
            if (oldPostgresHome !== null) {
                process.env.POSTGRES_HOME = oldPostgresHome;
            }
            else {
                delete process.env.POSTGRES_HOME;
            }
        }
    });
    
    beforeEach(function() {
        testpg = new TestPg({ _skipInit: true });
    });
    
    afterEach(function() {
        testpg = null;
    });
    
    function makeSuite(prog, want) {
        describe(prog, function() {
            let have;
            
            it("should not throw", function() {
                expect(function() {
                    have = testpg[prog];
                })
                .to.not.throwException();
            });
            
            it("should find the program", function() {
                expect(have).to.be(want);
            });
        });
    }
    
    describe("with PATH", function() {
        let oldPath;
        
        before(function() {
            oldPath = process.env.PATH;
            
            process.env.PATH = path.join(__dirname, 'lib', 'mock_bin');
            delete process.env.POSTGRES_HOME;
        });
        
        after(function() {
            process.env.PATH = oldPath;
            oldPath = null;
        });
        
        makeSuite('pg_ctl', path.join(__dirname, 'lib', 'mock_bin', 'pg_ctl'));
        makeSuite('postmaster', path.join(__dirname, 'lib', 'mock_bin', 'postgres'));
        makeSuite('psql', path.join(__dirname, 'lib', 'mock_bin', 'psql'));
        
        describe("pgVersion", function() {
            it("should not throw", function() {
                expect(function() {
                    +testpg.pgVersion;
                })
                .to.not.throwException();
            });
            
            it("should return correct value", function() {
                expect(testpg.pgVersion).to.be(99.999);
            });
        });
    });
    
    describe("with POSTGRES_HOME", function() {
        before(function() {
            process.env.POSTGRES_HOME = path.join(__dirname, 'lib', 'mock_bin');
        });
        
        makeSuite('pg_ctl', path.join(__dirname, 'lib', 'mock_bin', 'pg_ctl'));
        makeSuite('postmaster', path.join(__dirname, 'lib', 'mock_bin', 'postgres'));
        makeSuite('psql', path.join(__dirname, 'lib', 'mock_bin', 'psql'));
        
        describe("pgVersion", function() {
            it("should not throw", function() {
                expect(function() {
                    +testpg.pgVersion;
                })
                .to.not.throwException();
            });
            
            it("should return correct value", function() {
                expect(testpg.pgVersion).to.be(99.999);
            });
        });
    });
});
