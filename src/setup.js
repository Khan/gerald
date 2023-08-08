// @flow

import {type Octokit} from '@octokit/rest';

type Octokit$PullsListResponseItem = $FlowFixMe;
type Octokit$PullsListCommitsResponseItemCommit = $FlowFixMe;

import {ENV_ADMIN_TOKEN} from './constants';

export type Context =
    | {|
          issue: {|owner: string, repo: string, number: number|},
          payload: {|
              pull_request: Octokit$PullsListResponseItem,
              before: string,
              after: string,
              commits: Array<{id: string, ...Octokit$PullsListCommitsResponseItemCommit}>,
          |},
          actor: string,
      |}
    // this is what the testing context looks like
    | {|
          issue: {|owner: '__TESTING__', repo: '__TESTING__', number: -1|},
          payload: {|
              pull_request: {|base: {|ref: '__TESTING__'|}, user: {|login: '__testUser'|}|},
              before: string,
              after: string,
              commits: Array<{
                  author: '__testAuthor',
                  comment_count: -1,
                  committer: '__testCommitter',
                  id: string,
                  message: string,
                  tree: '__TESTING__',
                  url: '__TESTING__',
                  verification: {verified: boolean},
              }>,
          |},
          actor: '__testActor',
      |};

const octokit = require('@actions/github'); //flow-uncovered-line

/* flow-uncovered-block */
export const extraPermGithub: Octokit = octokit.getOctokit(process.env[ENV_ADMIN_TOKEN]).rest;
export const context: Context = octokit.context;
/* end flow-uncovered-block */
export let ownerAndRepo = {owner: '__TESTING__', repo: '__TESTING__'};
if (process.env[ENV_ADMIN_TOKEN]) {
    ownerAndRepo = {owner: context.issue.owner, repo: context.issue.repo};
}
