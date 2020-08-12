// @flow

import {type Octokit$IssuesListCommentsResponseItem} from '@octokit/rest';

import {
    getReviewers,
    getNotified,
    getFileDiffs,
    parseExistingComments,
    getFilteredLists,
    makeCommentBody,
    maybeRemoveReviewRequests,
} from './utils';
import {execCmd} from './execCmd';
import {ownerAndRepo, context, extraPermGithub} from './setup';
import {
    GERALD_COMMENT_FOOTER,
    PULL_REQUEST,
    GERALD_COMMENT_HEADER,
    GERALD_COMMENT_NOTIFIED_HEADER,
    GERALD_COMMENT_REQ_REVIEWERS_HEADER,
    GERALD_COMMENT_REVIEWERS_HEADER,
    MATCH_COMMENT_HEADER_REGEX,
} from './constants';

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
    let body: string = GERALD_COMMENT_HEADER;
    body += makeCommentBody(notifyees, GERALD_COMMENT_NOTIFIED_HEADER);
    body += makeCommentBody(reviewers, GERALD_COMMENT_REVIEWERS_HEADER);
    body += makeCommentBody(requiredReviewers, GERALD_COMMENT_REQ_REVIEWERS_HEADER);
    if (body.match(MATCH_COMMENT_HEADER_REGEX)) {
        body += GERALD_COMMENT_FOOTER;

        if (comment) {
            await extraPermGithub.issues.updateComment({
                ...ownerAndRepo,
                comment_id: comment.id,
                body: body, // flow-uncovered-line
            });
        } else {
            await extraPermGithub.issues.createComment({
                ...ownerAndRepo,
                issue_number: context.issue.number,
                body: body, // flow-uncovered-line
            });
        }
    } else if (comment) {
        await extraPermGithub.issues.deleteComment({
            ...ownerAndRepo,
            comment_id: comment.id,
        });
    }
};

export const runOnPullRequest = async () => {
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
    const notified = getNotified(filesChanged, fileDiffs, PULL_REQUEST);
    const {reviewers, requiredReviewers} = getReviewers(
        filesChanged,
        fileDiffs,
        context.payload.pull_request.user.login,
    );

    // find any #removeme or existing khan-actions-bot comments
    const existingComments = await extraPermGithub.issues.listComments({
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

    await maybeRemoveReviewRequests(
        removedJustNames,
        {...ownerAndRepo, pull_number: context.issue.number},
        extraPermGithub,
    );
    await extraPermGithub.pulls.createReviewRequest({
        ...ownerAndRepo,
        pull_number: context.issue.number,
        reviewers: actualReviewers,
        team_reviewers: teamReviewers,
    });

    await updatePullRequestComment(megaComment, notified, reviewers, requiredReviewers);
};
