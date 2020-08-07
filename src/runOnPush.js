// @flow

import {getNotified, getFileDiffs} from './utils';
import {execCmd} from './execCmd';
import {ownerAndRepo, extraPermGithub, type Context} from './setup';
import {PUSH, GERALD_COMMIT_COMMENT_HEADER} from './constants';

const makeCommitComment = async (
    peopleToFiles: {[string]: Array<string>, ...},
    commitSHA: string,
) => {
    const names: string[] = Object.keys(peopleToFiles);
    if (peopleToFiles && names.length) {
        let body: string = GERALD_COMMIT_COMMENT_HEADER;
        names.forEach((person: string) => {
            const files = peopleToFiles[person];
            body += `${person} for changes to \`${files.join('`, `')}\`\n`;
        });

        await extraPermGithub.repos.createCommitComment({
            ...ownerAndRepo,
            commit_sha: commitSHA,
            body: body,
        });
    }
};

export const runPush = async (usedContext: Context) => {
    // loop through each commit in the push
    let prevCommit = usedContext.payload.before;
    for (const commit of usedContext.payload.commits) {
        const commitData = await extraPermGithub.git.getCommit({
            ...ownerAndRepo,
            commit_sha: commit.id,
        });

        // commits with >1 parent are merge commits. we want to ignore those
        if (commitData.data.parents.length === 1) {
            const filesChanged = (
                await execCmd('git', [
                    'diff',
                    `${prevCommit}...${commitData.data.sha}`,
                    '--name-only',
                ])
            ).split('\n');
            const fileDiffs = await getFileDiffs(`${prevCommit}...${commitData.data.sha}`);
            const notified = getNotified(filesChanged, fileDiffs, PUSH);

            await makeCommitComment(notified, commitData.data.sha);
        }

        // we also want to ignore the diff of a merge commit
        prevCommit = commitData.data.sha;
    }
};

export type __TestCommit = {
    author: '__testAuthor',
    comment_count: -1,
    committer: '__testCommitter',
    id: string,
    message: string,
    tree: '__TESTING__',
    url: '__TESTING__',
    verification: '__TESTING__',
};

export const __makeCommitComment = makeCommitComment;
export const __extraPermGithub = extraPermGithub;
