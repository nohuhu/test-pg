const expect = require('expect.js');

const TestPg = require('../src/testpg');

const path = require('path');

let doIt;

try {
    // Postmaster lacks -C switch in versions < 9.2
    doIt = new TestPg({ _skipInit: true }).pgVersion >= 9.0 ? describe : xdescribe;
}
catch (e) {
    doIt = xdescribe;
}

doIt("populating database", function() {
    describe("with psql", function() {
        let testpg;
        
        it("should be able to start", async function() {
            testpg = new TestPg({
                database: 'fumblemumble',
            });
            
            await testpg.start();
            
            expect(testpg.started).to.be(true);
        });
        
        it("should be able to run psql commands one by one", async function() {
            await testpg.run_psql(['-c', "CREATE TABLE foo (bar int)"]);
            
            const out = await testpg.run_psql(
                ['-c', "INSERT INTO foo (bar) VALUES (42) RETURNING *;"]
            );
            
            // Output should be like:
            // 
            //  bar
            // -----
            //   42
            // (1 row)
            //
            expect(/bar.+42.+\(1 row\)/s.test(out)).to.be(true);
        });
        
        it("should be able to run multiple psql commands per invocation", async function() {
            // psql 9.6+ supports multiple -c commands, older versions do not
            if (testpg.pgVersion >= 9.6) {
                const psql_command = [
                    '-c', "CREATE TABLE plugh (blivit int)",
                    '-c', "INSERT INTO plugh (blivit) VALUES (42) RETURNING *",
                ];
                
                const out = await testpg.run_psql(psql_command);
                
                expect(/blivit.+42.+\(1 row\)/s.test(out)).to.be(true);
            }
        });
        
        it("should populate data with psql", async function() {
            const result = await testpg.query("SELECT bar FROM foo");
            
            expect(result.rows).to.eql([{
                bar: 42
            }]);
        });
        
        it("should be able to stop", async function() {
            await testpg.stop();
            
            expect(testpg.started).to.be(false);
        });
    });
    
    describe("with seed config", function() {
        const seedPath = path.join(__dirname, 'lib/seed');
        
        let testpg;
        
        it("should be able to start", async function() {
            testpg = new TestPg({
                database: 'throbbozongo',
                seed: [
                    path.join(seedPath, 'init.sql'),
                    path.join(seedPath, 'seed.sql'),
                ],
            });
            
            await testpg.start();
            
            expect(testpg.started).to.be(true);
        });
        
        it("should populate data", async function() {
            const result = await testpg.query("SELECT bar FROM foo");
            
            expect(result.rows).to.eql([{
                bar: 43
            }]);
        });
        
        it("should be able to stop", async function() {
            await testpg.stop();
            
            expect(testpg.started).to.be(false);
        });
    });
});
