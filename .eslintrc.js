module.exports = {
    env: {
        node: true,
        jest: true,
        es6: true,
    },
    parser: 'babel-eslint',
    parserOptions: {
        sourceType: 'module',
    },
    plugins: ['flowtype', 'import', 'prettier'],
    rules: {
        // The default rule wants to enforce // @flow, but we frequently have it
        // as part of the file's docstring.
        'flowtype/require-valid-file-annotation': [0, 'always'],
        // ---------------------------------------
        // ES6 rules.
        'constructor-super': 2,
        'no-const-assign': 2,
        'no-this-before-super': 2,
        'no-console': 0,
        'no-var': 2,
        'prefer-const': 2,
        'prefer-spread': 2,
        // We turned this off because it complains when you have a
        // multi-line string, which I think is going too far.
        'prefer-template': 0,
        // We've decided explicitly not to care about this.
        'arrow-parens': 0,
        // ---------------------------------------
        // ES6/jsx stuff that's disabled for now, but maybe shouldn't be.
        // TODO(csilvers): enable these if/when community agrees on it.
        'prefer-arrow-callback': 0,
        // We'd possibly like to remove the 'properties': 'never' one day.
        camelcase: [
            2,
            {
                properties: 'never',
                allow: ['^UNSAFE_'],
            },
        ],
        curly: 2,
        eqeqeq: [2, 'allow-null'],
        'guard-for-in': 2,
        'linebreak-style': [2, 'unix'],
        'max-lines': [2, 1000],
        'no-alert': 2,
        'no-array-constructor': 2,
        'no-debugger': 2,
        'no-dupe-class-members': 2,
        'no-dupe-keys': 2,
        'no-extra-bind': 2,
        'no-new': 2,
        'no-new-func': 2,
        'no-new-object': 2,
        'no-throw-literal': 2,
        'no-undef': 2,
        'no-unexpected-multiline': 2,
        'no-unreachable': 2,
        // NOTE: If you change the options here, be sure to update eslintrc.flow also
        'no-unused-expressions': [2, {allowShortCircuit: true, allowTernary: true}],
        'no-unused-vars': [2, {args: 'none', varsIgnorePattern: '^_*$'}],
        'no-useless-call': 2,
        'no-with': 2,
        'one-var': [2, 'never'],
        // TODO(scottgrant): Add additional a11y rules as we support them.
        // ---------------------------------------
        // Stuff that's disabled for now, but maybe shouldn't be.
        // TODO(jeresig): It's an anti-pattern but it appears to be used
        // frequently in reducers, the alternative would be super-clunky.
        'no-case-declarations': 0,
        // TODO(csilvers): enable these if/when community agrees on it.
        // Might be nice to turn this on one day, but since we don't
        // use jsdoc anywhere it seems silly to require it yet.
        'valid-jsdoc': 0,
        'require-jsdoc': 0,
        'flowtype/boolean-style': [2, 'boolean'],
        'flowtype/define-flow-type': 1, // suppress no-undef on flow types
        'flowtype/no-dupe-keys': 2,

        // Use Flow's version of no-unused-expressions
        'flowtype/no-unused-expressions': [2, {allowShortCircuit: true, allowTernary: true}],

        'flowtype/no-weak-types': 0, // allow 'any' for now
        // flow may still require parameter types in certain situations
        'flowtype/require-parameter-type': 0,
        'flowtype/require-return-type': 0,
        'flowtype/sort': 0,
        'flowtype/type-id-match': 0,
        'flowtype/use-flow-type': 1, // suppress no-unused-vars on flow types
        'prettier/prettier': 'error',
        'import/extensions': ['error', 'never'],
        'import/no-commonjs': 'error',
        'import/order': [
            'error',
            {
                groups: [['builtin', 'external'], 'parent', 'sibling'],
                'newlines-between': 'always',
            },
        ],
    },
    overrides: [
        {
<<<<<<< HEAD
            files: ['src/core.js', 'src/main.js', 'src/execCmd.js'],
=======
            files: ['src/pr-notify.js', 'src/main.js', 'src/execCmd.js'],
>>>>>>> Automated build push
            rules: {
                'import/no-commonjs': 'off',
            },
        },
    ],
    extends: ['prettier/flowtype'],
    globals: {
        DEBUG: false,
        Promise: false,
        Set: false,
        __DEV__: [false /* writable */, true /* readable */],
    },
};
