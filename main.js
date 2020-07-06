// @flow

import {
    type Octokit,
    type Octokit$IssuesListCommentsResponseItem,
    type Octokit$PullsListResponseItem,
} from '@octokit/rest';

const path = require('path');
const octokit = require('@actions/github'); //flow-uncovered-line

type Context = {|
    issue: {|owner: string, repo: string, number: number|},
    payload: {|pull_request: Octokit$PullsListResponseItem|},
|};

const {
    getReviewers,
    getNotified,
    getFileDiffs,
    parseExistingComments,
    getFilteredLists,
} = require('./utils');
const {execCmd} = require('./execCmd');

/* flow-uncovered-block */
// argv looks like: ['node', '.github/workflows/pr-notify.js', personalAuthToken, githubActionsToken]
const personalGithub: Octokit = new octokit.GitHub(process.argv[2]);
const github: Octokit = new octokit.GitHub(process.argv[3]);
const context: Context = octokit.context;
/* end flow-uncovered-block */

const ownerAndRepo = {owner: context.issue.owner, repo: context.issue.repo};
const separator =
    '__________________________________________________________________________________________________________________________________';

/**
 * @desc Helper function to update, delete, or create a comment
 * @param comment - existing Github comment to update/delete or undefined
 * @param title - this will end up being the first line of the comment
 * @param people - people to tag mapped to the files that each person is tagged for
 */
const updateComment = async (
    comment: ?Octokit$IssuesListCommentsResponseItem,
    title: 'Reviewers:\n\n' | 'Required reviewers:\n\n' | 'Notified:\n\n',
    people: {[string]: Array<string>, ...},
) => {
    let body: string = title;
    const names: string[] = Object.keys(people);
    if (people && names.length) {
        names.forEach((person: string) => {
            const files = people[person];
            body += `${person} for changes to \`${files.join('`, `')}\`\n`;
        });
        body += `\n${separator}\n_Don't want to be involved in this pull request? Comment \`#removeme\` and we won't notify you of further changes._`;

        if (comment) {
            await github.issues.updateComment({
                ...ownerAndRepo,
                comment_id: comment.id,
                body: body, // flow-uncovered-line
            });
        } else {
            await github.issues.createComment({
                ...ownerAndRepo,
                issue_number: context.issue.number,
                body: body, // flow-uncovered-line
            });
        }
    } else if (comment) {
        await github.issues.deleteComment({
            ...ownerAndRepo,
            comment_id: comment.id,
        });
    }
};

const run = async () => {
    // get the files changed between the head of this branch and the origin of the base branch
    const filesChanged = (
        await execCmd('git', [
            'diff',
            'origin/' + context.payload.pull_request.base.ref,
            '--name-only',
        ])
    ).split('\n');
    // get the actual diff between the head of this branch adn the origin of the base branch, split by files
    const fileDiffs = await getFileDiffs(context);

    // figure out who to notify and request reviews from
    const notified = getNotified(filesChanged, fileDiffs);
    const {reviewers, requiredReviewers} = getReviewers(
        filesChanged,
        fileDiffs,
        context.payload.pull_request.user.login,
    );

    // find any #removeme or existing Github-Actions[bot] comments
    const existingComments = await github.issues.listComments({
        ...ownerAndRepo,
        issue_number: context.issue.number,
    });
    const {
        notifiedComment,
        reviewersComment,
        reqReviewersComment,
        removedJustNames,
    } = parseExistingComments<Octokit$IssuesListCommentsResponseItem>(existingComments);

    // filter out anyone that has commented #removeme
    const actualReviewers = getFilteredLists(
        reviewers,
        requiredReviewers,
        notified,
        removedJustNames,
    );

    await personalGithub.pulls.createReviewRequest({
        ...ownerAndRepo,
        pull_number: context.issue.number,
        reviewers: actualReviewers,
        team_reviewers: actualReviewers,
    });

    await updateComment(notifiedComment, 'Notified:\n\n', notified);
    await updateComment(reviewersComment, 'Reviewers:\n\n', reviewers);
    await updateComment(reqReviewersComment, 'Required reviewers:\n\n', requiredReviewers);
};

module.exports = {run};
