# test-pg
[![Build Status](https://travis-ci.org/nohuhu/test-pg.svg?branch=master)](https://travis-ci.org/nohuhu/test-pg)

Transparently create temporary PostgreSQL server instances for testing.

## Instalation

```sh
npm install test-pg
```

## Usage

This module is intended to be a drop-in replacement for
[pg-pool](https://www.npmjs.com/package/pg-pool), with server cluster creation
and initialization magic happening behind the scenes:

```js
const TestPg = require('test-pg');

(async () => {
    const pg = new TestPg({
        database: 'foo',   // Default: 'test'
        host: 'localhost', // Default: '127.0.0.1'
        port: 54321,       // Default: 15432+ (see below)
        user: 'blergo',    // Default: $USER (see below)
        password: 'todo',  // Not yet supported
        ssl: true,         // Ignored
        ...
    });
    
    const client = await pg.connect();
    const result = await client.query('SELECT foo FROM bar');
    
    ...
})();
```

Or as simple as it can get:

```js
const TestPg = require('test-pg');

(async () => {
    const pg = new TestPg();
    
    const result = await pg.query('SELECT datname FROM pg_database ORDER BY datname');
    
    console.log(result);
})();
```

For more `pg-pool` API specific examples, see [pg-pool](https://www.npmjs.com/package/pg-pool).

## Configuration

Some config options passed to the constructor are interpreted as TestPg specific:

- `basePort`: TestPg will try to start first server instance on this port,
followed by increased number if Postgres fails to start.

- `baseDir`: Base directory where PostgreSQL server cluster data is kept. If this option
is provided, it is assumed to be an already initialized Postgres cluster. If not provided,
TestPg will create a temporary directory, initialize a new cluster in it, and remove it
when `stop` or `end` method is called (also on Node process exit).

- `serverConfig`: Optional `postgresql.conf` text. If not provided, empty `postgresql.conf`
will be used for temporary server clusters.

- `seed`: Optional but highly recommended, an array of file paths to seed SQL files
for populating temporary database upon creation. These scripts will be executed via
`psql` utility, e.g. `psql -f <seed1.sql> -f <seed2.sql>`.

## TestPg API

TODO

## See also

This module is inspired and heavily based upon Perl module
[Test::PostgreSQL](https://metacpan.org/pod/Test::PostgreSQL). In fact most of the TestPg code
dealing with program finding is shamelessly borrowed from that module, along with API bits
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
