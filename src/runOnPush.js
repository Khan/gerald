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
    let prevCommit = usedContext.payload.before;

    // we only want to look at the squashed diff for each file
    const squashedDiffs = await getFileDiffs(`${prevCommit}...${usedContext.payload.after}`);

    // loop through each commit in the push
    for (const commit of usedContext.payload.commits) {
        const commitData = await extraPermGithub.git.getCommit({
            ...ownerAndRepo,
            commit_sha: commit.id,
        });

        // commits with >1 parent are merge commits. we want to ignore those
        // we also want to ignore commits that have been verified.
        if (commitData.data.parents.length === 1 && !commit.verification.verified) {
            const filesChanged = (
                await execCmd('git', [
                    'diff',
                    `${prevCommit}...${commitData.data.sha}`,
                    '--name-only',
                ])
            ).split('\n');
            const thisDiff = await getFileDiffs(`${prevCommit}...${commitData.data.sha}`);

            // get the squashed diffs of the files that were changed in this commit
            const fileDiffs: {[string]: string, ...} = {};
            for (const file of filesChanged) {
                if (thisDiff[file] && squashedDiffs[file]) {
                    // get all the diff lines in *this* commit and *all* commits
                    const diffByLines = thisDiff[file].split('\n');
                    const squashedDiffByLines = squashedDiffs[file].split('\n');

                    // only run the regex on the diff lines that are both in *this* commit and all commits
                    const committedAndSquashedDiff = diffByLines.filter(line =>
                        squashedDiffByLines.includes(line),
                    );
                    fileDiffs[file] = committedAndSquashedDiff.join('\n');
                }
            }
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
    verification: {verified: boolean},
};

export const __makeCommitComment = makeCommitComment;
export const __extraPermGithub = extraPermGithub;
