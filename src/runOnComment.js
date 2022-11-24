// @flow
type Octokit$IssuesListCommentsResponseItem = $FlowFixMe;

import {parseExistingComments} from './utils';
import {ownerAndRepo, context, extraPermGithub} from './setup';

const makeNewComment = (existingBody: string, removedJustNames: Array<string>): string => {
    let newComment = existingBody;
    // look through each of the names and see if the existing comment mentions these names
    for (const justName of removedJustNames) {
        const regex = new RegExp(`\n^@${justName}.*$\n`, 'gm');

        // if so, remove them. $TODO{Stanley} - remove review requests as well.
        if (newComment.match(regex)) {
            newComment = newComment.replace(regex, '');
        }
    }
    return newComment;
};

/**
 * @desc Looks at the existing comment and takes out any lines that match the name
 * of a person who has commented #removeme. Then, if there are still usernames in the
 * remainder of the comment, it will update the comment, otherwise it will delete it.
 *
 * @param comment - Octokit Comment
 * @param removedJustNames - List of people who have commented #removeme
 */
const updateOrDeletePRComment = async (
    newComment: string,
    commentID: number,
    removedJustNames: Array<string>,
) => {
    // look for any usernames or team slugs in the remainder of the comment
    const keepComment = newComment.match(/@([A-Za-z]*\/)?\S*/g);

    if (keepComment) {
        await extraPermGithub.rest.issues.updateComment({
            ...ownerAndRepo,
            comment_id: commentID,
            body: newComment, // flow-uncovered-line
        });
    } else {
        await extraPermGithub.rest.issues.deleteComment({
            ...ownerAndRepo,
            comment_id: commentID,
        });
    }
};

export const runOnComment = async () => {
    const existingComments = await extraPermGithub.rest.issues.listComments({
        ...ownerAndRepo,
        issue_number: context.issue.number,
    });
    const {
        megaComment,
        removedJustNames,
    } = parseExistingComments<Octokit$IssuesListCommentsResponseItem>(existingComments);

    if (megaComment) {
        const newComment = makeNewComment(megaComment.body, removedJustNames);
        await updateOrDeletePRComment(newComment, megaComment.id, removedJustNames);
    }
};

// exported for testing
export const __makeNewComment = makeNewComment;
