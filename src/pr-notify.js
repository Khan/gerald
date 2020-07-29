#!/usr/bin/env node
// @flow

require('@babel/register');

const core = require('@actions/core'); //flow-uncovered-line

const {runPullRequest, runPush} = require('./main.js');

if (process.env['EVENT'] === 'pull_request') {
    runPullRequest().catch(err => {
        core.setFailed(err.message);
    });
} else {
    runPush().catch(err => {
        core.setFailed(err.message);
    });
}
