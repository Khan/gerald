#!/usr/bin/env node
// @flow

require('@babel/register');

const core = require('@actions/core'); //flow-uncovered-line

const {runPush} = require('./main.js');

try {
    runPush();
    /* flow-uncovered-block */
} catch (error) {
    core.setFailed(error.message);
    /* end flow-uncovered-block */
}
