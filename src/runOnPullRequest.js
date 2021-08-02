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
    getFileContents,
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

const makeReviewRequests = async (reviewers: Array<string>, teamReviewers: Array<string>) => {
    // figure out who has already reviewed
    const {data: reviews} = await extraPermGithub.pulls.listReviews({
        ...ownerAndRepo,
        pull_number: context.issue.number,
    });
    const alreadyReviewed: Array<string> = reviews.map(review => review.user.login);

    // unfulfilled reviewers = everyone who hasn't reviewed
    const unfulfilledReviewers = reviewers.filter(reviewer => !alreadyReviewed.includes(reviewer));
    const unfulfilledTeams = teamReviewers;

    for (const team of teamReviewers) {
        const {data: membership} = await extraPermGithub.teams.listMembersInOrg({
            org: ownerAndRepo.owner,
            team_slug: team,
        });
        const members = membership.map(member => member.login);

        // if a requested team has a review from a member, consider it fulfilled
        for (const reviewer of alreadyReviewed) {
            if (members.includes(reviewer)) {
                unfulfilledTeams.splice(unfulfilledTeams.indexOf(team), 1);
                break;
            }
        }
    }

    await extraPermGithub.pulls.createReviewRequest({
        ...ownerAndRepo,
        pull_number: context.issue.number,
        reviewers: unfulfilledReviewers,
        team_reviewers: unfulfilledTeams,
    });
};

export const runOnPullRequest = async () => {
    // three dots (...) needed to only get files on HEAD and not base
    const asymmetricBaseStr = `origin/${context.payload.pull_request.base.ref}...`;
    // get the files changed between the head of this branch and the origin of the base branch
    const filesChanged = (await execCmd('git', ['diff', asymmetricBaseStr, '--name-only'])).split(
        '\n',
    );
    // get the actual diff between the head of this branch and the origin of the base branch, split by files
    const fileDiffs = await getFileDiffs(asymmetricBaseStr);
    const fileContents = await getFileContents(asymmetricBaseStr);

    // figure out who to notify and request reviews from
    const notified = getNotified(
        filesChanged,
        fileDiffs,
        fileContents,
        context.payload.pull_request.user.login,
        PULL_REQUEST,
    );
    const {reviewers, requiredReviewers} = getReviewers(
        filesChanged,
        fileDiffs,
        fileContents,
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
    await makeReviewRequests(actualReviewers, teamReviewers);

    await updatePullRequestComment(megaComment, notified, reviewers, requiredReviewers);
};
