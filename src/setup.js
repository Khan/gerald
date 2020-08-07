// @flow

import {
    type Octokit,
    type Octokit$PullsListResponseItem,
    type Octokit$PullsListCommitsResponseItemCommit,
} from '@octokit/rest';

export type Context = {|
    issue: {|owner: string, repo: string, number: number|},
    payload: {|
        pull_request: Octokit$PullsListResponseItem,
        before: string,
        after: string,
        commits: {id: string, ...Octokit$PullsListCommitsResponseItemCommit}[],
    |},
    actor: string,
|};

const octokit = require('@actions/github'); //flow-uncovered-line

/* flow-uncovered-block */
export const extraPermGithub: Octokit = new octokit.GitHub(process.env['ADMIN_PERMISSION_TOKEN']);
export const github: Octokit = new octokit.GitHub(process.env['GITHUB_TOKEN']);
export const context: Context = octokit.context;
/* end flow-uncovered-block */
export const ownerAndRepo = {owner: context.issue.owner, repo: context.issue.repo};
