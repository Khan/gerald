const path = require('path');
const octokit = require('@actions/github');

const {
    getReviewers,
    getNotified,
    getFileDiffs,
    parseExistingComments,
    getPullRequestBody,
    getFilteredLists,
} = require('./utils');
const {execCmd} = require('./execCmd');

const personalGithub = new octokit.GitHub(process.argv[2]);
const github = new octokit.GitHub(process.argv[3]);
const context = octokit.context;
const ownerAndRepo = {owner: context.issue.owner, repo: context.issue.repo};
const separator =
    '__________________________________________________________________________________________________________________________________';

/**
 * @desc Helper function to update, delete, or create a comment
 * @param comment - existing GithubComment to update/delete or undefined
 * @param title - Currently "Reviewers" | "Required Reviewers" | "Notified", but this will end up being the first line of the comment
 * @param people - {[username: string] filesChanged: string[]} Object of the people to tag in the comment and the list of files that make it necessary
 */
const updateComment = async (comment, title, people) => {
    let body = title;
    const entries = Object.entries(people);
    if (people && entries.length) {
        entries.forEach(([person, files]) => {
            body += `${person} for changes to \`${files.join('`, `')}\`\n`;
        });
        body += `\n${separator}\n_Don't want to be involved in this pull request? Comment \`#removeme\` and we won't notify you of further changes._`;

        if (comment) {
            await github.issues.updateComment({
                ...ownerAndRepo,
                comment_id: comment.id,
                body: body,
            });
        } else {
            await github.issues.createComment({
                ...ownerAndRepo,
                issue_number: context.issue.number,
                body: body,
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
    const filesChanged = (
        await execCmd('git', [
            'diff',
            'origin/' + context.payload.pull_request.base.ref,
            '--name-only',
        ])
    ).split('\n');
    const fileDiffs = await getFileDiffs(context);

    const notified = getNotified(filesChanged, fileDiffs);
    const {reviewers, requiredReviewers} = getReviewers(
        filesChanged,
        fileDiffs,
        context.payload.pull_request.user.login,
    );

    const existingComments = await github.issues.listComments({
        ...ownerAndRepo,
        issue_number: context.issue.number,
    });

    const {
        notifiedComment,
        reviewersComment,
        reqReviewersComment,
        removedJustNames,
    } = parseExistingComments(existingComments);

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

    await github.pulls.update({
        ...ownerAndRepo,
        pull_number: context.issue.number,
        body: getPullRequestBody(requiredReviewers, context.payload.pull_request.body),
    });

    await updateComment(notifiedComment, 'Notified:\n\n', notified);
    await updateComment(reviewersComment, 'Reviewers:\n\n', reviewers);
    await updateComment(reqReviewersComment, 'Required reviewers:\n\n', requiredReviewers);
};

module.exports = {run};
