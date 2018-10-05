# test-pg-pool
[![Build Status](https://travis-ci.org/nohuhu/test-pg-pool.svg?branch=master)](https://travis-ci.org/nohuhu/test-pg-pool)

Transparently create temporary PostgreSQL server instances for testing.

## Instalation

```sh
npm install test-pg-pool
```

## Usage

This module is intended to be a drop-in replacement for
[pg-pool](https://www.npmjs.com/package/pg-pool), with server cluster creation
and initialization magic happening behind the scenes:

```js
const TestPool = require('test-pg-pool');

(async () => {
    const pool = new TestPool();
    
    const result = await pool.query('SELECT datname FROM pg_database ORDER BY datname');
    
    console.log(result.rows);
    
    pool.end();
})();
```

Or with more control over what is happening:

```js
const TestPool = require('test-pg-pool');

(async () => {
    const pool = new TestPool({
        database: 'foo',   // Default: 'test'
        host: 'localhost', // Default: '127.0.0.1'
        port: 54321,       // Default: 15432+ (see below)
        user: 'blergo',    // Default: $USER (see below)
        password: 'todo',  // Not yet supported
        ssl: true,         // Ignored
        ...
    });
    
    const client = await pool.connect();
    const result = await client.query('SELECT foo FROM bar');
    
    console.log(result);
    
    pool.end();
})();
```

For more `pg-pool` API specific examples, see [pg-pool](https://www.npmjs.com/package/pg-pool).

## Configuration

Pass the following config options to change TestPool behavior:

- `host`: Although this option is accepted, internally it is always changed to
`127.0.0.1`. This is done to support passing Pool configuration that might be used in other
test environments without causing an error.

Keep in mind that using `localhost` might or might not work as expected since some platforms
resolve `localhost` to IPv6 `::1` address first. Depending on your system configuration,
Postgres instance might fail to listen on this address so using `127.0.0.1` is always a safe bet.

- `port`: When this option is provided, TestPool will first try to start Postgres instance
on the configured port. If the first attempt fails, TestPool will start at `basePort` and
increment it, trying to find an unused port. Some randomness is added to try avoiding collisions.

- `user`: User name to pass to `pg-pool` constructor. This is "normal" user, which might be
different from `databaseOwner` user. Default is to use current system user for both.

If you want to use `user` config it is your responsibility to create the corresponding
database role in a `seed` script.

- `password`: Default is no password; it will be used if provided but see the note below.

Note that default PostgreSQL policy is to trust localhost connections with no password
checks being done, even if a password is provided. If you want user credentials to be checked,
you will need to pass `'pg_hba.conf'` config option, or modify `pg_hba.conf` file manually
after `setup` phase (see below).

- `database`: Database name to use, default is `test`.

Some config options passed to the constructor are interpreted as TestPool specific:

- `basePort`: TestPool will try to start first server instance on this port,
followed by increased number if Postgres fails to start.

- `baseDir`: Base directory where PostgreSQL server cluster data is kept. If this option
is provided, it is assumed to be an already initialized Postgres cluster. If not provided,
TestPool will create a temporary directory, initialize a new cluster in it, and remove it
when `stop` or `end` method is called (also on Node process exit).

`databaseOwner`: User name for database cluster owner. Defaults to current user name.

- `'postgresql.conf'`: Optional `postgresql.conf` text. If not provided, `postgresql.conf` file
will be truncated to zero length, in order to force PostgreSQL to use hardcoded default settings.

Note that this is option name contains a dot and needs to be quoted:

```js
const pool = new TestPool({
    user: 'foo',
    password: 'bar',
    'postgresql.conf': `
# Valid postgresql.conf content here
...
`
});
```

- `'pg_hba.conf'`: Optional `pg_hba.conf` text. If not provided, default configuration file
created by `initdb` will be used, with no modifications. See security note for `password` option.

Note that this option name contains a dot and needs to be quoted:

```js
const pool = new TestPool({
    user: 'foo',
    password: 'bar',
    'pg_hba.conf': `
# Valid pg_hba.conf content here
...
`
});
```

- `'pg_ident.conf'`: Optional `pg_ident.conf` text. If not provided, default configuration file
created by `initdb` will be used, with no modifications.

Note that this option name contains a dot and needs to be quoted:

```js
const pool = new TestPool({
    user: 'foo',
    password: 'bar',
    'pg_ident.conf': `
# Valid pg_ident.conf content here
...
`
});
```

- `seed`: Optional but highly recommended, an array of file paths to seed SQL files
for populating temporary database upon creation. These scripts will be executed via
`psql` utility, e.g. `psql -f <seed1.sql> -f <seed2.sql>`.

- `uid`: User id to use for starting PostgreSQL when Node process is running under root
(typical for Docker environment). PostgreSQL will refuse to start under root so `uid` is
necessary. If not provided, TestPool will try to resolve uid for user `nobody` and use that.

Note that this option is only relevant when running as root, and ignored otherwise.

## API

If more control over the PostgreSQL instance lifecycle is desired, you can use the following
methods:

- `setup()`: Call this to create temporary directory, initialize database cluster and
write config files. This method accepts no arguments and returns a Promise that resolves
when setup is finished.

When setup is done, the database server is not running and it is safe to modify contents
of the `baseDir`, i.e. adjust Postgres configuration to your liking.

Note that the configured *database* is not created yet at this point. Creating a database
requires starting Postgres process and connecting to it, which might depend on cluster
configuration.

- `start()`: Call this to start the database server. This method accepts no arguments and
returns a Promise.

When this method has finished, the database server is running, configured database is created
and ready to use.

- `stop()`: Call this to stop the database server. This method accepts no arguments and returns
a Promise that resolves when the server is stopped and cleanup is performed.

When this method is finished, database server is shut down and temporary `baseDir` is removed.
If `baseDir` path was passed as an option to TestPool constructor, it will not be removed.

## See also

This module is inspired and heavily based upon Perl module
[Test::PostgreSQL](https://metacpan.org/pod/Test::PostgreSQL). In fact most of the `test-pg-pool`
code dealing with program finding is shamelessly borrowed from that module, along with API bits
that make sense in event-based JavaScript.

## License

MIT License

Copyright (c) 2018 Alex Tokarev

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
