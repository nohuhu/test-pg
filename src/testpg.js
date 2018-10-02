"use strict";

const os = require('os');
const fs = require('fs-extra');
const path = require('path');
const child_process = require('child_process');
const util = require('util');
const which = require('which');
const posix = require('posix');

const exec = util.promisify(child_process.exec);
const execFile = util.promisify(child_process.execFile);

const { Client } = require('pg');

const _defaults = {
    // NOT localhost! Some platforms might resolve `localhost` to IPv6 ::1
    // which might or might not work as expected
    host: '127.0.0.1',
    basePort: 15432,
    database: 'test',
    seedScripts: [],
};

const configs = [
    'host', 'port', 'user', 'password', 'database',
    'basePort', 'baseDir', 'serverConfig', 'extraInitdbArgs', 'extraPsqlArgs',
    'seedScripts', 'uid', 'extraPostmasterArgs',
];

const prefixedConfigs = [
    'initdb', 'initdbArgs', 'pg_ctl', 'psql', 'psqlArgs', 'postmaster', 'postmasterArgs',
    'databaseOwner',
];

class TestPg {
    constructor(config) {
        config = config ? { ...config } : {};
        
        configs.forEach(cfgName => {
            if (cfgName in config) {
                this[cfgName] = config[cfgName];
                delete config[cfgName];
            }
            else if (cfgName in _defaults) {
                this[cfgName] = _defaults[cfgName];
            }
        });
        
        prefixedConfigs.forEach(cfgName => {
            if (cfgName in config) {
                this[`_${cfgName}`] = config[cfgName];
                delete config[cfgName];
            }
        });
        
        // This is an exception. We always start test Postgres instance on localhost
        this.host = _defaults.host;
        
        if (!this.database) {
            this.database = _defaults.database;
        }
        
        if (!config._skipInit) {
            // Make sure we have one or the other ways of starting Postgres:
            if (!this.pg_ctl || !this.postmaster) {
                throw new Error("Cannot find how to start PostgreSQL!");
            }
            
            if (this.uid === 0) {
                throw new Error("uid should be set to a non-root user id.");
            }
            
            // Try to drop privileges
            if (this.uid == null && process.getuid() === 0) {
                const entry = posix.getpwnam('nobody');
                
                if (!entry) {
                    throw new Error(
                        "PostgreSQL cannot run under root user. Tried to find user 'nobody' " +
                        "but it does not exist. Use `uid` property to specify a non-root user id."
                    );
                }
                
                // TODO Is this really a case?
                if (entry.uid === 0) {
                    throw new Error(
                        "User nobody has uid 0; confused and exiting. Use `uid` property " +
                        "to specify a non-root user."
                    );
                }
                
                this.uid = entry.uid;
            }
            
            if (this.baseDir == null) {
                this.baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testpg-'));
                
                // Ensure base dir is writable by our target uid, if we were running as root
                if (this.uid != null && process.getuid() === 0) {
                    fs.chownSync(this.baseDir, this.uid, -1);
                }
                
                fs.chmodSync(this.baseDir, 0o700);
                
                this._cleanupBaseDir = true;
            }
            
            this._ownerPid = process.pid;
        }
    }
    
    get databaseOwner() {
        if (this._databaseOwner) {
            return this._databaseOwner;
        }
        
        const user = posix.getpwnam(this.uid || process.geteuid());
        
        if (!user) {
            throw new Error("Cannot resolve user name for Postgres database owner!");
        }
        
        return user.name;
    }
    
    get initdb() {
        if (this._initdb) {
            return this._initdb;
        }
        
        return this._initdb = this._findProgram('initdb');
    }
    
    get initdbArgs() {
        if (this._initdbArgs) {
            return this._initdbArgs;
        }
        
        return this._initdbArgs = [
            '-U', this.databaseOwner,
            '-A', 'trust',
            ...(this.extraInitdbArgs ? this.extraInitdbArgs : []),
        ];
    }
    
    get pg_ctl() {
        if ('_pg_ctl' in this) {
            return this._pg_ctl;
        }
        
        const pg_ctl = this._findProgram('pg_ctl');
        const pgVersion = this.pgVersion;
        
        if (pgVersion >= 9) {
            return this._pg_ctl = pg_ctl;
        }
        
        return this._pg_ctl = null;
    }
    
    get postmaster() {
        if (this._postmaster) {
            return this._postmaster;
        }
        
        const prog = this._findProgram('postgres', true) || this._findProgram('postmaster', true);
        
        if (!prog) {
            throw new Error(
                "Cannot find PostgreSQL server executable (either postgres or postmaster). " +
                "Please set appropriate PATH or POSTGRES_HOME."
            );
        }
        
        return this._postmaster = prog;
    }
    
    get postmasterArgs() {
        if (this._postmasterArgs) {
            return this._postmasterArgs;
        }
        
        return [
            '-h', this.host,
            ...(this.extraPostmasterArgs ? ['-F', this.extraPostmasterArgs] : []),
        ];
    }
    
    get psql() {
        if (this._psql) {
            return this._psql;
        }
        
        return this._psql = this._findProgram('psql');
    }
    
    get psqlArgs() {
        if (this._psqlArgs) {
            return this._psqlArgs;
        }
        
        return [
            '-U', this.databaseOwner,
            '-d', this.database,
            '-h', this.host,
            '-p', this.port,
            ...(this.extraPsqlArgs ? this.extraPsqlArgs : []),
        ];
    }
    
    get pgVersion() {
        if (this._pgVersion) {
            return this._pgVersion;
        }
        
        const out = child_process.execFileSync(
            this.postmaster, ['--version'], { encoding: 'utf8' }
        );
        
        const match = out.match(/(\d+(?:\.(?:\d+|devel))?)/);
        
        if (match) {
            // PostgreSQL version can be something like 11.devel, not exactly a number.
            // We assume .devel === .0
            const version = parseFloat(match.shift().replace('.devel', '.0'));
            
            if (!isNaN(version)) {
                this._pgVersion = version;
            }
        }
        
        if (!this._pgVersion) {
            throw new Error("Cannot find PostgreSQL version!");
        }
        
        return this._pgVersion;
    }
    
    get connectionString() {
        if (this._connectionString) {
            return this._connectionString;
        }
        
        const user = this.user;
        const password = this.password;
        const userPass = user ? `${user}${password ? ":" + password : ""}` : null;
        
        const uri = 'postgresql://' + (userPass ? userPass + '@' : '') +
                    `${this.host}:${this.port}/${this.database}`;
        
        return this._connectionString = uri;
    }
    
    clientConnectionParameters(extraParams) {
        return {
            host: this.host,
            port: this.port,
            ...(this.user ? { user: this.user } : {}),
            ...(this.user && this.password ? { password: this.password } : {}),
            database: this.database,
            ...(extraParams || {}),
        };
    }
    
    getClient(extraParams) {
        return new Client(this.clientConnectionParameters(extraParams));
    }
    
    async start() {
        if (this.pid != null) {
            process.emitWarning(
                `Apparently a TestPg instance is already started with pid ` +
                `${this.pid}; not restarting.`
            );
            
            return Promise.reject();
        }
        
        if (!this._setupDone) {
            await this.setup();
        }
        
        if (this.port > 0) {
            await this._tryStart(this.port);
        }
        else {
            await this._findPortAndLaunch();
        }
        
        this.started = true;
        
        this._exitListener = this.stopSync.bind(this);
        process.once('exit', this._exitListener);
        
        return this._createTestDatabase(this.database);
    }
    
    async stop(signal = 'SIGQUIT') {
        if (this.started) {
            const cmd = [
                this.pg_ctl,
                'stop', '-s', '-w',
                '-D', path.join(this.baseDir, 'data'),
                '-m', 'fast'
            ];
            
            await this._execCommand(cmd);
            
            this.pid = null;
            
            if (this._cleanupBaseDir) {
                await fs.remove(this.baseDir);
                this.baseDir = null;
            }
            
            this.started = false;
            
            process.removeListener('exit', this._exitListener);
            this._exitListener = null;
        }
        else {
            // Old style is todo
        }
        
        return Promise.resolve();
    }
    
    stopSync() {
        // This method is used on Node 'exit' event so everything here must be synchonous
        if (!this.started) {
            return;
        }
        
        const cmd = [
            this.pg_ctl,
            'stop', '-s',
            '-D', path.join(this.baseDir, 'data'),
            '-m', 'fast'
        ];
        
        this._execCommandSync(cmd);
        
        this.pid = null;
        
        if (this._cleanupBaseDir) {
            fs.removeSync(this.baseDir);
            this.baseDir = null;
        }
        
        this.started = false;
        
        process.removeListener('exit', this._exitListener);
        this._exitListener = null;
    }
    
    async setup() {
        if (this._setupDone) {
            return true;
        }
        
        // initdb
        const dataDir = path.join(this.baseDir, 'data');
        
        let exists;
        
        try {
            exists = fs.statSync(dataDir).isDirectory();
        }
        catch (e) {
            // ignore;
        }
        
        if (!exists) {
            if (this.pg_ctl) {
                const cmd = [
                    this.pg_ctl, 'init', '-s', '-w', '-D', dataDir, '-o', this.initdbArgs.join(' '),
                ];
                
                await this._execCommand(cmd);
            }
            else {
                throw new Error("Pre-9.0 PostgreSQL is to do");
            }
            
            const conf_file = path.join(this.baseDir, 'data', 'postgresql.conf');
            
            if (this.serverConfig) {
                try {
                    fs.writeFileSync(conf_file, this.serverConfig);
                }
                catch (e) {
                    throw new Error(`Cannot write PostgreSQL configuration file! ${e || ''}`);
                }
            }
            else {
                // use Postgres hardcoded configuration as some packagers mess around
                // with postgresql.conf.sample too much:
                try {
                    fs.truncateSync(conf_file);
                }
                catch (e) {
                    throw new Error(`Cannot truncate PostgreSQL configuration file! ${e || ''}`);
                }
            }
        }
        
        return this._setupDone = true;
    }
    
    async run_psql(args) {
        const cmd = [
            this.psql,
            this.psqlArgs,
            this.extraPsqlArgs,
            this.runPsqlArgs(),
            ...(Array.isArray(args) ? args : [args]),
        ].join(' ');
        
        // Usually anything less than WARNING is not really helpful in batch mode.
        // Does it make sense to make this configurable?
        process.env.PGOPTIONS = '--client-min-messages=warning';
        
        try {
            // We want to return promise result, not promise itself!
            return await this._execCommand(cmd);
        }
        catch (e) {
            throw new Error(`Error executing psql: ${e || ''}`);
        }
    }
    
    async run_psql_scripts(paths) {
        let psql_commands = (paths || []).map(p => `-f ${p}`);
        
        // psql 9.6+ supports multiple -c and -f commands invoked at once, older psql does not.
        // Executing psql multiple times breaks single transaction semantics but it is unlikely
        // to cause problems in real world testing scenarios.
        if (this.pgVersion > 9.6) {
            psql_commands = [psql_commands.join(' ')];
        }
        
        await Promise.all(psql_commands.forEach(cmd => this.run_psql(cmd)));
        
        return true;
    }
    
    searchPaths() {
        // Various paths that Postgres gets installed under, sometimes with a version on the end,
        // in which case take the highest version. We append /bin/ and so forth to the path later.
        // *Note that these are used only if the program isn't already in the path!*
        if (this._searchPaths) {
            return this._searchPaths;
        }
        
        const readDir = (dirPath) => {
            try {
                return fs.readdirSync(dirPath)
                         .sort((a, b) => +b > +a ? 1 : +a > +b ? -1 : 0)
                         .map(entry => path.join(dirPath, entry))
                         .filter(entry => fs.statSync(entry).isDirectory());
            }
            catch (e) {
                return [];
            }
        }
        
        const basePaths = [
            // Popular installation dir?
            '/usr/local/pgsql',
            
            // Ubuntu (maybe Debian as well)
            ...(readDir('/usr/lib/postgresql')),
            
            // Mac ports
            ...(readDir('/opt/local/lib/postgresql')),
            
            // Postgresapp.com
            ...(readDir('/Applications/Postgres.app/Contents/Versions')),
            
            // BSDs end up with it in /usr/local/bin which doesn't appear to be in path sometimes:
            '/usr/local'
        ];
        
        if (process.env.POSTGRES_HOME != null) {
            basePaths.unshift(process.env.POSTGRES_HOME);
        }
        
        return this._searchPaths = basePaths;
    }
    
    _findProgram(prog, suppressErrors) {
        let found = which.sync(prog, { nothrow: true });
        
        if (!found) {
            this.searchPaths().find(searchPath => {
                found = which.sync(prog, { path: path.join(searchPath, 'bin'), nothrow: true }) ||
                        which.sync(prog, { path: searchPath, nothrow: true });
                
                if (found) {
                    return true;
                }
            });
        }
        
        if (!found && !suppressErrors) {
            throw new Error(`Cannot find ${prog}, please set appropriate PATH or POSTGRES_HOME`);
        }
        
        return found;
    }
    
    async _findPortAndLaunch() {
        let tries = 10;
        
        let port = this.basePort;
        
        // try by incrementing port number
        while (true) {
            let started;
            
            try {
                await this._tryStart(port);
                started = true;
            }
            catch (e) {
                if (tries-- <= 0) {
                    throw new Error(`Failed to start PostgreSQL on port ${port}: ${e}`);
                }
            }
            
            if (started) {
                return true;
            }
            
            port++;
        }
    }
    
    async _tryStart(port) {
        const logfile = path.join(this.baseDir, 'postgres.log');
        
        if (this.pg_ctl) {
            const cmd = [
                this.pg_ctl,
                'start', '-s', '-w', '-D', path.join(this.baseDir, 'data'),
                '-l', logfile,
                '-o', `${[].concat(this.postmasterArgs, '-p', port).join(' ')}`,
            ];
            
            await this._execCommand(cmd, true);
            
            const pid_path = path.join(this.baseDir, 'data', 'postmaster.pid');
            
            try {
                const pids = fs.readFileSync(pid_path).toString();
                
                // Note that the file contains several lines; we only want the PID from the first
                const pid = parseInt(pids.split('\n').shift());
                
                if (!(pid > 0)) {
                    throw new Error(`Invalid process id: ${pid}`);
                }
                
                this.pid = pid;
            }
            catch (e) {
                throw new Error(`Cannot read pid file ${pid_path}: ${e || ''}`);
            }
            
            this.port = port;
            
            return true;
        }
        else {
            throw new Error("PostgreSQL versions below 9.0 are to do");
        }
    }
    
    async _createTestDatabase(dbname) {
        const pg = this.getClient({ database: 'template1' });
        
        let tries = 5,
            connected;
        
        while (tries--) {
            try {
                await pg.connect();
                connected = true;
                
                break;
            }
            catch (e) {
                await new Promise(resolve => {
                    setTimeout(resolve, 1000);
                });
            }
        }
        
        if (!connected) {
            throw new Error("Cannot connect to the database after 5 tries");
        }
        
        // Camel case does not work here, gets lowercased somewhere along the line.
        // Not sure if this is Postgres or node-pg.
        let result = await pg.query({
            text: 'SELECT count(*) AS have_database FROM pg_database WHERE datname = $1',
            values: [this.database],
        });
        
        if (!result.rows.length || parseInt(result.rows[0].have_database) === 0) {
            result = await pg.query(`CREATE DATABASE ${this.database}`);
        }
        
        if (this.seedScripts && this.seedScripts.length) {
            return this.run_psql_scripts(this.seedScripts);
        }
        
        await pg.end();
        
        return Promise.resolve();
    }
    
    _formatCommandOptions(cmd, options) {
        options = {...(options || {})};
        
        const quiet = { options };
        delete options.quiet;
        
        if (this.uid != null) {
            options.uid = this.uid;
        }
        
        if (!('encoding' in options)) {
            options.encoding = 'utf8';
        }
        
        options.cwd = this.baseDir;
        
        const executable = cmd.shift();
        
        return {
            executable,
            args: cmd,
            options,
        };
    }
    
    async _execCommand(cmd, _options) {
        const { executable, args, options } = this._formatCommandOptions(cmd, _options);
        
        let stdout, stderr;
        
        try {
            const ret = await execFile(executable, args, options);
            
            stdout = ret.stdout;
            stderr = ret.stderr;
            
            if (stderr && !quiet) {
                console.error(ret.stderr);
            }
        }
        catch (e) {
            throw new Error(`Cannot execute ${executable}: ${e || ''}`);
        }
        
        return stdout;
    }
    
    _execCommandSync(cmd, _options) {
        const { executable, args, options } = this._formatCommandOptions(cmd, _options);
        
        let stdout, stderr;
        
        try {
            return child_process.execFileSync(executable, args, options);
        }
        catch (e) {
            throw new Error(`Cannot execute ${executable}: ${e || ''}`);
        }
    }
}

module.exports = TestPg;
