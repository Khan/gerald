const path = require('path');
const octokit = require('@actions/github');
const personalGithub = new octokit.GitHub(process.argv[2]);
const github = new octokit.GitHub(process.argv[3]);
const context = octokit.context;
const ownerAndRepo = {owner: context.issue.owner, repo: context.issue.repo};

const {
    getReviewers,
    getNotified,
    getFileDiffs,
    parseExistingComments,
    getPullRequestBody,
} = require('./utils');
const {execCmd} = require('./execCmd');

const updateComment = async (comment, title, people) => {
    let body = title;
    const entries = Object.entries(people);
    if (people && entries.length) {
        entries.forEach(([person, files]) => {
            body += `${person} for changes to ${files.join(', ')}\n`;
        });

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

    const notified = await getNotified(filesChanged, fileDiffs);
    const {reviewers, requiredReviewers} = await getReviewers(
        filesChanged,
        fileDiffs,
        context.payload.pull_request.user.login,
    );

    const existingComments = await github.issues.listComments({
        ...ownerAndRepo,
        issue_number: context.issue.number,
    });

    const {notifiedComment, reviewersComment, reqReviewersComment} = parseExistingComments(
        existingComments,
    );

    const allReviewers = Object.keys(requiredReviewers).concat(
        Object.keys(reviewers).filter(
            reviewer => !Object.keys(requiredReviewers).includes(reviewer),
        ),
    );

    await personalGithub.pulls.createReviewRequest({
        ...ownerAndRepo,
        pull_number: context.issue.number,
        reviewers: allReviewers.map(reviewer => reviewer.slice(1)),
        team_reviewers: allReviewers.map(reviewer => reviewer.slice(1)),
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
