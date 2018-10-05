const expect = require('expect.js');

const TestPg = require('../src/testpg');
const Pg = require('pg').Client;

const path = require('path');
const fs = require('fs-extra');

let doIt;

try {
    // Postmaster lacks -C switch in versions < 9.2
    doIt = new TestPg({ _skipInit: true }).pgVersion >= 9.2 ? describe : xdescribe;
}
catch (e) {
    doIt = xdescribe;
}

doIt("configuration", function() {
    let testpg;
    
    describe("server instance parameters", function() {
        after(function() {
            testpg = null;
        });
        
        it("should be able to create TestPg instance", function() {
            expect(function() {
                testpg = new TestPg({
                    database: 'fumbaroo',
                    databaseOwner: 'quxfreddo',
                    host: 'localhost',
                    port: 25432,
                });
            })
            .to.not.throwException();
        });
        
        it("should be able to set up", async function() {
            await testpg.setup();
            
            const out = await testpg.execProgram(
                [testpg.postmaster, '-D', testpg.baseDir, '-C', 'synchronous_commit']
            );
            
            // Default for synchronous_commit is on
            expect(/^on/.test(out)).to.be(true);
        });
        
        it("should be able able to start", async function() {
            await testpg.start();
            
            expect(testpg.started).to.be(true);
        });
        
        it("should be able to connect", async function() {
            const pg = new Pg({
                host: 'localhost',
                port: 25432,
                database: 'fumbaroo',
                user: 'quxfreddo',
            });
            
            await pg.connect();
            
            // This is NOT a typo: "usename" not "username"!
            const result = await pg.query(
                "SELECT usename FROM pg_catalog.pg_user WHERE usesuper = 't'"
            );

            await pg.end();
            
            expect(result.rows.length).to.be(1);
            expect(result.rows).to.eql([{
                usename: 'quxfreddo'
            }]);
        });
        
        it("should be able to stop", async function() {
            await testpg.stop();
            
            expect(testpg.started).to.be(false);
        });
    });
    
    describe("serverConfig", function() {
        after(function() {
            testpg = null;
        });
        
        it("should be able to create TestPg instance", function() {
            expect(function() {
                testpg = new TestPg({
                    'postgresql.conf': `# foo baroo mymse throbbozongo
fsync = off
synchronous_commit = off
full_page_writes = off
bgwriter_lru_maxpages = 0
`,
                    'pg_hba.conf': `# zurgo kleffe poot blivit
local all all trust
host all all 127.0.0.1/32 trust
`,

                    'pg_ident.conf': `# gurgle plugh fumble zingbong
`
                });
            })
            .to.not.throwException();
        });
        
        it("should be able to setup", async function() {
            await testpg.start();
            
            expect(testpg.started).to.be(true);
        });
        
        it("should write custom postgresql.conf", function() {
            const conf = fs.readFileSync(path.join(testpg.baseDir, 'postgresql.conf'));
            
            expect(/^# foo baroo mymse throbbozongo/.test(conf)).to.be(true);
        });
        
        it("should write custom pg_hba.conf", function() {
            const conf = fs.readFileSync(path.join(testpg.baseDir, 'pg_hba.conf'));
            
            expect(/^# zurgo kleffe poot blivit/.test(conf)).to.be(true);
        });
        
        it("should write custom pg_ident.conf", function() {
            const conf = fs.readFileSync(path.join(testpg.baseDir, 'pg_ident.conf'));
            
            expect(/^# gurgle plugh fumble zingbong/.test(conf)).to.be(true);
        });
        
        it("should start with custom parameters", async function() {
            const out = await testpg.execProgram(
                [testpg.postmaster, '-D', testpg.baseDir, '-C', 'synchronous_commit']
            );
            
            expect(/^off/.test(out)).to.be(true);
        });
        
        it("should stop", async function() {
            await testpg.stop();
            
            expect(testpg.started).to.be(false);
        });
    });
});
