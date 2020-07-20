#!/usr/bin/env node
// @flow

require('@babel/register');

const core = require('@actions/core'); //flow-uncovered-line

const {runPullRequest, runPush} = require('./main.js');

try {
    if (process.env['EVENT'] === 'pull_request') {
        runPullRequest();
    } else {
        runPush();
    }
    /* flow-uncovered-block */
} catch (error) {
    core.setFailed(error.message);
    /* end flow-uncovered-block */
}
