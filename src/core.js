#!/usr/bin/env node
// @flow

require('@babel/register');

const core = require('@actions/core'); //flow-uncovered-line

const {runPullRequest, runPush} = require('./main.js');
const {PULL_REQUEST, ENV_EVENT} = require('./constants');

try {
    if (process.env[ENV_EVENT] === PULL_REQUEST) {
        runPullRequest();
    } else {
        runPush();
    }
    /* flow-uncovered-block */
} catch (error) {
    core.setFailed(error.message);
    /* end flow-uncovered-block */
}
