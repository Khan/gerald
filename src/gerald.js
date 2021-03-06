#!/usr/bin/env node
// @flow

require('@babel/register');

const core = require('@actions/core'); //flow-uncovered-line

const {runOnComment} = require('./runOnComment');
const {runPush} = require('./runOnPush.js');
const {runOnPullRequest} = require('./runOnPullRequest.js');
const {context} = require('./setup');
const {PULL_REQUEST, ENV_EVENT, COMMENT} = require('./constants');

try {
    if (process.env[ENV_EVENT] === PULL_REQUEST) {
        runOnPullRequest();
    } else if (process.env[ENV_EVENT] === COMMENT) {
        runOnComment();
    } else {
        runPush(context);
    }
    /* flow-uncovered-block */
} catch (error) {
    core.setFailed(error.message);
    /* end flow-uncovered-block */
}
