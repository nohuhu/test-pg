module.exports = {
    'extends': 'eslint:recommended',
    env: {
        es6: true,
        node: true,
    },
    parserOptions: {
        ecmaVersion: 2018,
        sourceType: "module"
    },
    rules: {
        indent: [
            "error",
            4,
            {
                SwitchCase: 1,
                ArrayExpression: "first",
                ObjectExpression: "first",
                MemberExpression: "off",
                FunctionDeclaration: {
                    parameters: "first",
                    body: 1
                },
                CallExpression: {
                    "arguments": "first"
                },
                outerIIFEBody: 0,
                ignoreComments: false,
                flatTernaryExpressions: true,
                VariableDeclarator: 1
            }
        ],
        "linebreak-style": ["error", "unix"],
        "no-floating-decimal": "error",
        semi: ["error", "always"],
        "no-console": 0,
        "no-debugger": 0,
        curly: ["error"],
        "nonblock-statement-body-position": ["error", "below"],
        "space-before-blocks": [
            "error",
            {
                functions: "always",
                keywords: "always",
                classes: "always"
            }
        ],
        "space-infix-ops": ["error"],
        "block-spacing": ["error", "always"],
        "semi-spacing": ["error", { before: false, after: true }],
        "no-whitespace-before-property": ["error"],
        "keyword-spacing": ["error", { before: true, after: true }],
        "space-before-function-paren": ["error", "never"],
        "func-call-spacing": ["error", "never"],
        "space-in-parens": ["error", "never"],
        "no-multi-spaces": ["error", { ignoreEOLComments: true }],
        "brace-style": ["error", "stroustrup"],
        "comma-spacing": ["error", { after: true }],
        "dot-notation": ["error", { allowKeywords: false }],
        "dot-location": ["error", "property"],
        "multiline-ternary": ["error", "always-multiline"],
        "operator-linebreak": [
            "error",
            "after",
            {
                overrides: {
                    "?": "before",
                    ":": "before"
                }
            }
        ],
        "eqeqeq": ["error", "always", { null: "ignore" }],
        "no-trailing-spaces": ["error", {
            "skipBlankLines": true,
            "ignoreComments": true
        }],
        "spaced-comment": [
            "error", "always",
            {
                block: {
                    balanced: true
                }
            }
        ],
        "key-spacing": [
            "error",
            { beforeColon: false, afterColon: true }
        ],
        "computed-property-spacing": ["error", "never"],
        "eol-last": ["error", "always"],
        "object-curly-spacing": ["error", "always"],
        "vars-on-top": ["error"],
        "no-extra-boolean-cast": "off",
        "no-unused-vars": [
            "error",
            {
                vars: "all",
                args: "none",
                ignoreRestSiblings: false
            }
        ],
        "one-var-declaration-per-line": ["error", "initializations"],
        "max-len": [
            "error",
            {
                code: 100,
                ignoreComments: false,
                ignoreStrings: false,
                ignoreRegExpLiterals: true,
                ignoreUrls: true
            }
        ],
        "comma-style": [
            "error", "last",
            {
                exceptions: {
                    ArrayExpression: false,
                    CallExpression: false,
                    FunctionDeclaration: false,
                    FunctionExpression: false,
                    ObjectExpression: false,
                    VariableDeclaration: false,
                    NewExpression: false
                }
            }
        ],
        "padding-line-between-statements": [
            "error",
            { blankLine: "always", prev: "*", next: "case" },
            { blankLine: "any", prev: "case", next: "case" },
            { blankLine: "always", prev: "break", next: "case" },
            { blankLine: "always", prev: "break", next: "default" },
            { blankLine: "always", prev: "var", next: "*" },
            { blankLine: "always", prev: "*", next: "block-like" },
            { blankLine: "always", prev: "*", next: "return" },
            { blankLine: "always", prev: "block-like", next: "block-like" },
            { blankLine: "always", prev: "block-like", next: "return" },
            { blankLine: "always", prev: "block-like", next: "break" },
            { blankLine: "always", prev: "block-like", next: "expression" }
        ]
    },
    overrides: [{
        files: [
            'test/**/*.spec.js',
        ],
        env: {
            mocha: true,
        }
    }]
};
