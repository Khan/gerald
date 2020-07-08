#!/usr/bin/env node
// @flow

require('@babel/register');

const core = require('@actions/core'); //flow-uncovered-line

const {runPullRequest} = require('./main.js');

try {
    runPullRequest();
    /* flow-uncovered-block */
} catch (error) {
    core.setFailed(error.message);
    /* end flow-uncovered-block */
}
