#!/usr/bin/env node
// @flow

require('@babel/register');

const core = require('@actions/core'); //flow-uncovered-line

const {runOnComment} = require('./runOnComment');
const {runPush} = require('./runOnPush.js');
const {runOnPullRequest} = require('./runOnPullRequest.js');
const {context} = require('./setup');
const {PULL_REQUEST, ENV_EVENT, COMMENT} = require('./constants');

const run = async () => {
    try {
        if (process.env[ENV_EVENT] === PULL_REQUEST) {
            await runOnPullRequest();
        } else if (process.env[ENV_EVENT] === COMMENT) {
            await runOnComment();
        } else {
            await runPush(context);
        }
        /* flow-uncovered-block */
    } catch (error) {
        core.setFailed(error.toString());
        /* end flow-uncovered-block */
    }
};

/* flow-uncovered-block */
run().catch(error => {
    core.setFailed(error.toString());
});
/* end flow-uncovered-block */
