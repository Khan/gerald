// @flow

import {
    type Octokit,
    type Octokit$IssuesListCommentsResponseItem,
    type Octokit$PullsListResponseItem,
    type Octokit$PullsListCommitsResponseItemCommit,
} from '@octokit/rest';

import {parseExistingComments} from './utils';

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

const octokit = require('@actions/github'); //flow-uncovered-line

/* flow-uncovered-block */
const extraPermGithub: Octokit = new octokit.GitHub(process.env['ADMIN_PERMISSION_TOKEN']);
const context: Context = octokit.context;
/* end flow-uncovered-block */
const ownerAndRepo = {owner: context.issue.owner, repo: context.issue.repo};

const updatePullRequestComment = async (
    comment: Octokit$IssuesListCommentsResponseItem,
    body: string,
) => {
    if (body) {
        await extraPermGithub.issues.updateComment({
            ...ownerAndRepo,
            comment_id: comment.id,
            body: body, // flow-uncovered-line
        });
    } else {
        await extraPermGithub.issues.deleteComment({
            ...ownerAndRepo,
            comment_id: comment.id,
        });
    }
};

export const runOnComment = async () => {
    const existingComments = await extraPermGithub.issues.listComments({
        ...ownerAndRepo,
        issue_number: context.issue.number,
    });
    const {
        megaComment,
        removedJustNames,
    } = parseExistingComments<Octokit$IssuesListCommentsResponseItem>(existingComments);

    if (megaComment) {
        let newComment: string = megaComment.body;
        for (const justName of removedJustNames) {
            const regex = new RegExp(`^@${justName}.*$\n`, 'gm');
            newComment = newComment.replace(regex, '');
        }

        const keepComment = newComment.match(/@([A-Za-z]*\/)?\S*/g);
        await updatePullRequestComment(megaComment, keepComment ? newComment : '');
    }
};
