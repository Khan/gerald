#!/usr/bin/env node
// @flow

require('@babel/register');

import {
    type Octokit,
    type Octokit$PullsListResponseItem,
    type Octokit$PullsListCommitsResponseItemCommit,
} from '@octokit/rest';

const core = require('@actions/core'); //flow-uncovered-line
const octokit = require('@actions/github'); //flow-uncovered-line

const {runPullRequest, runPush} = require('./main.js');

export type Context = {|
    issue: {|owner: string, repo: string, number: number|},
    payload: {|
        pull_request: Octokit$PullsListResponseItem,
        before: string,
        after: string,
        commits: Array<{id: string, ...Octokit$PullsListCommitsResponseItemCommit}>,
    |},
    actor: string,
|};

/* flow-uncovered-block */
export const extraPermGithub: Octokit = new octokit.GitHub(process.env['ADMIN_PERMISSION_TOKEN']);
export const context: Context = octokit.context;
/* end flow-uncovered-block */

export let ownerAndRepo = {owner: '__TESTING__', repo: '__TESTING__'};
if (process.env['ADMIN_PERMISSION_TOKEN']) {
    ownerAndRepo = {owner: context.issue.owner, repo: context.issue.repo};
}

try {
    if (process.env['EVENT'] === 'pull_request') {
        runPullRequest();
    } else {
        runPush(context);
    }
    /* flow-uncovered-block */
} catch (error) {
    core.setFailed(error.message);
    /* end flow-uncovered-block */
}
