// @flow

import {
    type Octokit,
    type Octokit$IssuesListCommentsResponseItem,
    type Octokit$PullsListResponseItem,
    type Octokit$PullsListCommitsResponseItemCommit,
} from '@octokit/rest';

const path = require('path');
const octokit = require('@actions/github'); //flow-uncovered-line

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
const khanActionsBot: Octokit = new octokit.getOctokit(process.env['KHAN_ACTIONS_BOT_TOKEN']);
const github: Octokit = new octokit.getOctokit(process.env['GITHUB_TOKEN']);
const context: Context = octokit.context;
/* end flow-uncovered-block */

const ownerAndRepo = {owner: context.issue.owner, repo: context.issue.repo};
const separator =
    '__________________________________________________________________________________________________________________________________';

const makeCommentBody = (
    peopleToFiles: {[string]: Array<string>, ...},
    sectionHeader: 'Reviewers:\n' | 'Required reviewers:\n' | 'Notified:\n',
) => {
    const names: string[] = Object.keys(peopleToFiles);
    if (names.length) {
        let body = `### ${sectionHeader}`;
        names.forEach((person: string) => {
            const files = peopleToFiles[person];
            body += `${person} for changes to \`${files.join('`, `')}\`\n\n`;
        });
        return body;
    }
    return '';
};

/**
 * @desc Helper function to update, delete, or create a comment
 * @param comment - existing Github comment to update/delete or undefined
 * @param title - this will end up being the first line of the comment
 * @param people - people to tag mapped to the files that each person is tagged for
 */
const updatePullRequestComment = async (
    comment: ?Octokit$IssuesListCommentsResponseItem,
    notifyees: {[string]: Array<string>, ...},
    reviewers: {[string]: Array<string>, ...},
    requiredReviewers: {[string]: Array<string>, ...},
) => {
    let body: string = '# Gerald:\n\n';
    body += makeCommentBody(notifyees, 'Notified:\n');
    body += makeCommentBody(reviewers, 'Reviewers:\n');
    body += makeCommentBody(requiredReviewers, 'Required reviewers:\n');
    if (body.match(/^### (Reviewers:|Required Reviewers:|Notified:)$/m)) {
        body += `\n${separator}\n_Don't want to be involved in this pull request? Comment \`#removeme\` and we won't notify you of further changes._`;
        console.log(body);

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

const makeCommitComments = async (peopleToFiles: {[string]: Array<string>, ...}) => {
    const names: string[] = Object.keys(peopleToFiles);
    if (peopleToFiles && names.length) {
        let body: string = 'Notify of Push Without Pull Request\n\n';
        names.forEach((person: string) => {
            const files = peopleToFiles[person];
            body += `${person} for changes to \`${files.join('`, `')}\`\n`;
        });

        for (const commit of context.payload.commits) {
            await khanActionsBot.repos.createCommitComment({
                ...ownerAndRepo,
                commit_sha: commit.id,
                body: body,
            });
        }
    }
};

const runPullRequest = async () => {
    // get the files changed between the head of this branch and the origin of the base branch
    const filesChanged = (
        await execCmd('git', [
            'diff',
            'origin/' + context.payload.pull_request.base.ref,
            '--name-only',
        ])
    ).split('\n');
    // get the actual diff between the head of this branch adn the origin of the base branch, split by files
    const fileDiffs = await getFileDiffs('origin/' + context.payload.pull_request.base.ref);

    // figure out who to notify and request reviews from
    const notified = getNotified(filesChanged, fileDiffs, 'pull_request');
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
        megaComment,
        removedJustNames,
    } = parseExistingComments<Octokit$IssuesListCommentsResponseItem>(existingComments);

    // filter out anyone that has commented #removeme
    const {actualReviewers, teamReviewers} = getFilteredLists(
        reviewers,
        requiredReviewers,
        notified,
        removedJustNames,
    );

    await khanActionsBot.pulls.createReviewRequest({
        ...ownerAndRepo,
        pull_number: context.issue.number,
        reviewers: actualReviewers,
        team_reviewers: teamReviewers,
    });

    await updatePullRequestComment(megaComment, notified, reviewers, requiredReviewers);
};

const runPush = async () => {
    const filesChanged = (
        await execCmd('git', [
            'diff',
            `${context.payload.before}...${context.payload.after}`,
            '--name-only',
        ])
    ).split('\n');
    const fileDiffs = await getFileDiffs(`${context.payload.before}...${context.payload.after}`);
    const notified = getNotified(filesChanged, fileDiffs, 'push');

    // no such thing as reviewers on a push
    // no need to look thru existing comments, a new push can't have existing comments
    // no need to filter out, since we're not requesting reviewers

    await makeCommitComments(notified);
};

module.exports = {runPullRequest, runPush};
