#!/usr/bin/env node
// @flow

import {
    type Octokit,
    type Octokit$IssuesListCommentsResponseItem,
    type Octokit$PullsListResponseItem,
    type Octokit$PullsListCommitsResponseItemCommit,
} from '@octokit/rest';

type Context = {|
    issue: {|owner: string, repo: string, number: number|},
    payload: {|
        pull_request: Octokit$PullsListResponseItem,
        before: string,
        after: string,
        commits: {id: string, ...Octokit$PullsListCommitsResponseItemCommit}[],
    |},
    actor: string,
|};
require('@babel/register');

const core = require('@actions/core'); //flow-uncovered-line
const octokit = require('@actions/github'); //flow-uncovered-line

const extraPermGithub: Octokit = new octokit.GitHub(process.argv[2]);
const context: Context = octokit.context;

core.setOutput('fetchDepth', context.payload.commits.length); //flow-uncovered-line
