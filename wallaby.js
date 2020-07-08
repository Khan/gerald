/* eslint-disable import/no-commonjs */
/**
 * Configuration for the wallabyjs test runner.
 * See https://wallabyjs.com/ for details.
 */
module.exports = wallaby => {
    const tests = ['cli/**/*.test.js', 'lib/**/*.test.js'];
    const files = ['cli/**/*.js', 'lib/**/*.js', ...tests.map(glob => `!${glob}`)];

    return {
        files,
        tests,
        env: {
            type: 'node',
            runner: 'node',
        },
        testFramework: 'jest',
        compilers: {
            '**/*.js': wallaby.compilers.babel({
                babel: require('@babel/core'),
            }),
        },
    };
};
