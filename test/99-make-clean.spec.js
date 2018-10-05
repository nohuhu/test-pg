const expect = require('expect.js');

const os = require('os');
const path = require('path');
const child_process = require('child_process');
const glob = require('glob');

describe("make realclean", function() {
    it("should not leave child processes", function() {
        let out;
        
        try {
            out = child_process.execSync(`pgrep -P ${process.pid}`, { encoding: 'utf8' });
        }
        catch (e) {
            // pgrep bombs when no children are found
            if (e.status === 1) {
                out = '';
            }
            else {
                throw e;
            }
        }
        
        expect(/^$/s.test(out)).to.be(true);
    });
    
    it("should not leave temporary directories", function() {
        const tmpDirs = glob.sync(path.join(os.tmpdir(), 'testpg-*'));
        
        expect(tmpDirs.length).to.be(0);
    });
});
