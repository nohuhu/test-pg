const expect = require('expect.js');

const path = require('path');
const os = require('os');
const fs = require('fs-extra');
const TestPg = require('../src/testpg');

let doIt;

try {
    doIt = new TestPg({ _skipInit: true }).postmaster ? describe : xdescribe;
}
catch (e) {
    doIt = xdescribe;
}

doIt("starting/stopping", function() {
    describe("single instance", function() {
        let testpg, pid, baseDir;
        
        before(function() {
            testpg = new TestPg();
        });
        
        after(function() {
            testpg = null;
        });
        
        describe("starting", function() {
            it("should be able to start TestPg instance", async function() {
                this.timeout(5000);
                
                await testpg.start();
    
                pid = testpg.pid;
                baseDir = testpg.baseDir;
                
                expect(testpg.started).to.be(true);
            });
            
            it("should create baseDir", function() {
                expect(fs.pathExistsSync(baseDir)).to.be(true);
            });
            
            it("should create data dir", function() {
                expect(fs.pathExistsSync(path.join(baseDir, 'data'))).to.be(true);
            });
            
            it("should start Postgres process", function() {
                expect(typeof pid).to.be('number');
                expect(function() {
                    process.kill(pid, 0);
                })
                .to.not.throwException();
            });
        });
        
        describe("connecting", function() {
            let pg;
            
            before(function() {
                pg = testpg._getClient();
                
                return pg.connect();
            });
            
            after(function() {
                return pg.end();
            });
            
            it("should be able to connect to the database", async function() {
                const result = await pg.query('SELECT datname FROM pg_database ORDER BY datname');
                
                expect(result.rows.length).to.be(4);
                expect(result.rows).to.eql([
                    { datname: 'postgres' },
                    { datname: 'template0' },
                    { datname: 'template1' },
                    { datname: 'test' },
                ]);
            });
        });
        
        describe("stopping", function() {
            it("should be able to stop TestPg instance", async function() {
                this.timeout(5000);
                
                await testpg.stop();
                
                expect(testpg.started).to.be(false);
            });
            
            it("should stop Postgres process", function() {
                expect(testpg.pid).to.be(null);
                
                // This should throw if no such pid exists
                expect(function() {
                    process.kill(pid, 0);
                })
                .to.throwException();
            });
            
            it("should clean up temporary baseDir", function() {
                expect(testpg.baseDir).to.be(null);
                expect(fs.pathExistsSync(baseDir)).to.be(false);
            });
        });
    });
    
    describe("recycle baseDir", function() {
        let baseDir, testpg1, testpg2, pg1, pg2;
        
        before(function() {
            baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-pg-baseDir-'));
            fs.ensureFileSync(path.join(baseDir, 'fumblemumble.txt'));
        });
        
        after(function() {
            testpg1 = testpg2 = null;
            
            return fs.remove(baseDir);
        });
        
        describe("first instance", function() {
            it("should create first instance", function() {
                expect(function() {
                    testpg1 = new TestPg({
                        baseDir: baseDir,
                        database: 'zingbong'
                    });
                })
                .to.not.throwException();
            });
            
            it("should use configured baseDir", function() {
                expect(testpg1.baseDir).to.be(baseDir);
            });
            
            it("should not remove or recreate configured baseDir", function() {
                expect(fs.pathExistsSync(path.join(baseDir, 'fumblemumble.txt'))).to.be(true);
            });
            
            it("should start", async function() {
                await testpg1.start();
                
                expect(testpg1.started).to.be(true);
            });
            
            it("should connect", async function() {
                pg1 = await testpg1.connect();
                
                expect(pg1._connected).to.be(true);
            });
            
            it("should query", async function() {
                const result = await pg1.query('SELECT datname FROM pg_database ORDER BY datname');
                
                expect(result.rows.length).to.be(4);
                expect(result.rows).to.eql([
                    { datname: 'postgres' },
                    { datname: 'template0' },
                    { datname: 'template1' },
                    { datname: 'zingbong' },
                ]);
            });
            
            it("should create table", async function() {
                const result = await pg1.query(`
                    CREATE TABLE foo (
                        bar int
                    );
                `);
                
                expect(result.command).to.be('CREATE');
            });
            
            it("should insert into table", async function() {
                const result = await pg1.query(`
                    INSERT INTO foo (bar) VALUES (42);
                `);
                
                expect(result.rowCount).to.be(1);
            });
            
            it("should disconnect", function() {
                // When this resolves it's a success
                return pg1.end();
            });
            
            it("should stop", async function() {
                this.timeout(5000);
                
                const pid = testpg1.pid;
                
                await testpg1.stop();
                
                expect(testpg1.started).to.be(false);
                
                expect(function() {
                    process.kill(pid, 0);
                })
                .to.throwException();
            });
            
            it("should not remove baseDir", function() {
                expect(fs.pathExistsSync(baseDir)).to.be(true);
            });
        });
        
        describe("second instance", function() {
            it("should create second instance", function() {
                expect(function() {
                    testpg2 = new TestPg({
                        baseDir: baseDir,
                        database: 'zingbong',
                    });
                })
                .to.not.throwException();
            });
            
            it("should use configured baseDir", function() {
                expect(testpg2.baseDir).to.be(baseDir);
            });
            
            it("should not remove or recreate configured baseDir", function() {
                expect(fs.pathExistsSync(path.join(baseDir, 'fumblemumble.txt'))).to.be(true);
            });
            
            it("should start", async function() {
                await testpg2.start();
                
                expect(testpg2.started).to.be(true);
            });
            
            it("should connect", async function() {
                pg2 = await testpg2.connect();
                
                expect(pg2._connected).to.be(true);
            });
            
            it("should query", async function() {
                const result = await pg2.query('SELECT bar FROM foo ORDER BY bar');
                
                expect(result.rows.length).to.be(1);
                expect(result.rows).to.eql([{ bar: 42 }]);
            });
            
            it("should disconnect", function() {
                return pg2.end();
            });
            
            it("should stop", async function() {
                this.timeout(5000);
                
                const pid = testpg2.pid;
                
                await testpg2.stop();
                
                expect(testpg2.started).to.be(false);
                
                expect(function() {
                    process.kill(pid, 0);
                })
                .to.throwException();
            });
            
            it("should not remove baseDir", function() {
                expect(fs.pathExistsSync(baseDir)).to.be(true);
            });
        });
    });
    
    describe("multiple instances", function() {
        let testpg1, testpg2, testpg3;
        
        before(function() {
            testpg1 = new TestPg({ database: 'gurgle' });
            testpg2 = new TestPg({ database: 'blivit' });
            testpg3 = new TestPg({ database: 'throbbe' });
        });
        
        after(function() {
            testpg1 = testpg2 = testpg3 = null;
        });
        
        describe("starting", function() {
            it("should be able to start first instance", async function() {
                this.timeout(5000);
                
                await testpg1.start();
                
                expect(testpg1.started).to.be(true);
            });
            
            it("should be able to start second instance", async function() {
                this.timeout(5000);
                
                await testpg2.start();
                
                expect(testpg2.started).to.be(true);
            });
            
            it("should be able to start third instance", async function() {
                this.timeout(5000);
                
                await testpg3.start();
                
                expect(testpg3.started).to.be(true);
            });
        });
        
        describe("connecting", function() {
            let pg1, pg2, pg3;
            
            before(function() {
                pg1 = testpg1._getClient();
                pg2 = testpg2._getClient();
                pg3 = testpg3._getClient();
            });
            
            after(function() {
                return Promise.all([pg1.end(), pg2.end(), pg3.end()]);
            });
            
            it("should be able to connect to all instances", async function() {
                await Promise.all([pg1.connect(), pg2.connect(), pg3.connect()]);
                
                expect(pg1._connected).to.be(true);
                expect(pg2._connected).to.be(true);
                expect(pg3._connected).to.be(true);
            });
            
            it("should be able to query all instances", async function() {
                // Give Postgres a chance to do its thing!
                this.timeout(10000);
                
                const result = await Promise.all([
                    pg1.query('SELECT datname FROM pg_database ORDER BY datname'),
                    pg2.query('SELECT datname FROM pg_database ORDER BY datname'),
                    pg3.query('SELECT datname FROM pg_database ORDER BY datname')
                ]);
                
                expect(result.length).to.be(3);
                
                expect(result[0].rows.length).to.be(4);
                expect(result[0].rows).to.eql([
                    { datname: 'gurgle' },
                    { datname: 'postgres' },
                    { datname: 'template0' },
                    { datname: 'template1' },
                ]);
                
                expect(result[1].rows.length).to.be(4);
                expect(result[1].rows).to.eql([
                    { datname: 'blivit' },
                    { datname: 'postgres' },
                    { datname: 'template0' },
                    { datname: 'template1' },
                ]);
                
                expect(result[2].rows.length).to.be(4);
                expect(result[2].rows).to.eql([
                    { datname: 'postgres' },
                    { datname: 'template0' },
                    { datname: 'template1' },
                    { datname: 'throbbe' },
                ]);
            });
        });
        
        describe("stopping", function() {
            let baseDir1, baseDir2, baseDir3,
                pid1, pid2, pid3;
            
            before(function() {
                baseDir1 = testpg1.baseDir;
                baseDir2 = testpg2.baseDir;
                baseDir3 = testpg3.baseDir;
                
                pid1 = testpg1.pid;
                pid2 = testpg2.pid;
                pid3 = testpg3.pid;
            });
            
            describe("sanity check", function() {
                it("instance 1 process should be started", function() {
                    expect(function() {
                        process.kill(pid1, 0);
                    })
                    .to.not.throwException();
                });
                
                it("instance 1 directories should exist", function() {
                    expect(fs.pathExistsSync(baseDir1)).to.be(true);
                    expect(fs.pathExistsSync(path.join(baseDir1, 'data'))).to.be(true);
                });
                
                it("instance 2 process should be started", function() {
                    expect(function() {
                        process.kill(pid2, 0);
                    })
                    .to.not.throwException();
                });
                
                it("instance 2 directories should exist", function() {
                    expect(fs.pathExistsSync(baseDir2)).to.be(true);
                    expect(fs.pathExistsSync(path.join(baseDir2, 'data'))).to.be(true);
                });
                
                it("instance 3 process should be started", function() {
                    expect(function() {
                        process.kill(pid3, 0);
                    })
                    .to.not.throwException();
                });
                
                it("instance 3 directories should exist", function() {
                    expect(fs.pathExistsSync(baseDir3)).to.be(true);
                    expect(fs.pathExistsSync(path.join(baseDir3, 'data'))).to.be(true);
                });
            });
            
            describe("sync stop", function() {
                it("should stop all instances synchronously", function() {
                    this.timeout(10000);
                
                    testpg1.stopSync();
                    testpg2.stopSync();
                    testpg3.stopSync();
                });
                
                it("should stop instance 1 process", function() {
                    expect(function() {
                        process.kill(pid1, 0);
                    })
                    .to.throwException();
                });
                
                it("should clean up instance 1 baseDir", function() {
                    expect(fs.pathExistsSync(baseDir1)).to.be(false);
                });
                
                it("should stop instance 2 process", function() {
                    expect(function() {
                        process.kill(pid2, 0);
                    })
                    .to.throwException();
                });
                
                it("should clean up instance 2 baseDir", function() {
                    expect(fs.pathExistsSync(baseDir2)).to.be(false);
                });
                
                it("should stop instance 3 process", function() {
                    expect(function() {
                        process.kill(pid3, 0);
                    })
                    .to.throwException();
                });
                
                it("should clean up instance 3 baseDir", function() {
                    expect(fs.pathExistsSync(baseDir3)).to.be(false);
                });
            });
        });
    });
});
