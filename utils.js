// @flow

const fs = require('fs');
const glob = require('glob');

const {execCmd} = require('./execCmd');
const globOptions = {
    matchBase: true,
    dot: true,
    ignore: ['node_modules/**', 'coverage/**', '.git/**'],
};

import {
    type Octokit$PullsListResponseItem,
    type Octokit$IssuesListCommentsResponseItem,
    type Octokit$Response,
} from '@octokit/rest';

type Context = {|
    issue: {|owner: string, repo: string, number: number|},
    payload: {|pull_request: Octokit$PullsListResponseItem|},
|};
type NameToFiles = {[name: string]: string[], ...};

/**
 * @desc Add the username/files pair to the nameToFilesObj if the
 * diff of the file matches the pattern.
 * @param pattern - Pattern to test against file diffs.
 * @param name - Username of the person to add if the pattern matches the diff.
 * @param fileDiffs - Object of files to diffs.
 * @param namesToFilesObj - Object to add username/files pair to.
 */
const maybeAddIfMatch = (
    pattern: RegExp,
    name: string,
    fileDiffs: {[string]: string, ...},
    nameToFilesObj: NameToFiles,
): void => {
    for (const file of Object.keys(fileDiffs)) {
        const diff = fileDiffs[file];
        if (pattern.test(diff)) {
            if (nameToFilesObj[name]) {
                if (!nameToFilesObj[name].includes(file)) {
                    nameToFilesObj[name].push(file);
                }
            } else {
                nameToFilesObj[name] = [file];
            }
        }
    }
};

/**
 * @desc Turn a RegExp surrounded by double quotes (") into an actual RegExp.
 * @param pattern - Something of the form "<regexp>" including double quotes.
 * @throws if no RegExp can be interpreted from the pattern
 */
const turnPatternIntoRegex = (pattern: string): RegExp => {
    const match = /^"\/(.*?)\/([a-z]*)"$/.exec(pattern);
    if (!match) {
        throw new Error(`The RegExp: ${pattern} isn't valid`);
    }
    const [_, regexPattern, regexFlags] = match;
    return new RegExp(regexPattern, regexFlags);
};

/**
 * @desc Parse a username of the form '@<username>(!|)' and splits it up into
 * @<username>, <username>, and whether or not there is a ! at the end.
 * @param original - Original username string: '@' + <username> + <maybe exclamation>
 * @throws if the string is not of the specified form.
 */
const parseUsername = (
    original: string,
): {original: string, username: string, justName: string, isRequired: boolean} => {
    const justName = original.match(/\w+/);
    if (justName && justName[0]) {
        const isRequired = original.endsWith('!');
        return {
            original: original,
            username: `@${justName[0]}`,
            justName: justName[0],
            isRequired: isRequired,
        };
    }
    throw new Error('String cannot be parsed as a name');
};

/**
 * @desc Helper function that pushes a list of files to the correct bin without duplicates.
 * @param bin - The object to do the things on.
 * @param username - The key that determines where to check for / push files.
 * @param files - The list of files to push.
 */
const pushOrSetToBin = (bin: NameToFiles, username: string, files: string[]): void => {
    if (bin[username]) {
        for (const file of files) {
            if (!bin[username].includes(file)) {
                bin[username].push(file);
            }
        }
    } else {
        bin[username] = files;
    }
};

/**
 * @desc Parse .github/NOTIFIED and return an object where each entry is a
 * unique person to notify and the files that they are being notified for.
 * @param filesChanged - List of changed files.
 * @param filesDiffs - Map of changed files to their diffs.
 * @param __testContent - For testing, mimicks .github/NOTIFIED content.
 */
const getNotified = (
    filesChanged: string[],
    fileDiffs: {[string]: string, ...},
    __testContent: ?string = undefined,
): NameToFiles => {
    const buf = __testContent || fs.readFileSync('.github/NOTIFIED', 'utf-8');
    const matches = buf.match(/^[^\#\n].*/gm); // ignore comments
    const notified: NameToFiles = {};
    if (matches) {
        for (const match of matches) {
            const [untrimmedPattern, ...names] = match.split(/ (?=@)/).filter(Boolean);
            const pattern = untrimmedPattern.trim();

            // handle dealing with regex
            if (pattern.startsWith('"') && pattern.endsWith('"')) {
                const regex = turnPatternIntoRegex(pattern);
                for (const name of names) {
                    maybeAddIfMatch(regex, name, fileDiffs, notified);
                }
            }
            // handle dealing with glob matches
            else {
                const matchedFiles = glob.sync(pattern, globOptions);
                const intersection = matchedFiles.filter(file => filesChanged.includes(file));

                for (const name of names) {
                    pushOrSetToBin(notified, name, intersection);
                }
            }
        }
    }
    return notified;
};

/**
 * @desc Parse .github/REVIEWERS and return an object where each entry is a
 * unique person to notify and the files that they wanted to be reviewers of.
 * @param filesChanged - List of changed files.
 * @param filesDiffs - Map of changed files to their diffs.
 * @param issuer - The person making the pull request should not be a reviewer.
 * @param __testContent - For testing, mimicks .github/REVIEWERS content.
 */
const getReviewers = (
    filesChanged: string[],
    fileDiffs: {[string]: string, ...},
    issuer: string,
    __testContent: ?string = undefined,
): {reviewers: NameToFiles, requiredReviewers: NameToFiles} => {
    const buf = __testContent || fs.readFileSync('.github/REVIEWERS', 'utf-8');
    const matches = buf.match(/^[^\#\n].*/gm); // ignore comments
    const reviewers: {[string]: Array<string>, ...} = {};
    const requiredReviewers: {[string]: Array<string>, ...} = {};
    if (!matches) {
        return {reviewers, requiredReviewers};
    }

    for (const match of matches) {
        const [untrimmedPattern, ...names] = match.split(/ (?=@)/).filter(Boolean);
        const pattern = untrimmedPattern.trim();

        // handle dealing with regex
        if (pattern.startsWith('"') && pattern.endsWith('"')) {
            const regex = turnPatternIntoRegex(pattern);

            for (const name of names) {
                const {original, username, justName, isRequired} = parseUsername(name);
                // don't add yourself as a reviewer
                if (justName === issuer) {
                    continue;
                }

                const correctBin = isRequired ? requiredReviewers : reviewers;
                maybeAddIfMatch(regex, username, fileDiffs, correctBin);
            }
        } else {
            const matchedFiles = glob.sync(pattern, globOptions);
            const intersection = matchedFiles.filter(file => filesChanged.includes(file));
            for (const name of names) {
                // don't add yourself as a reviewer
                const {original, username, justName, isRequired} = parseUsername(name);
                if (justName === issuer) {
                    continue;
                }

                const correctBin = isRequired ? requiredReviewers : reviewers;
                pushOrSetToBin(correctBin, username, intersection);
            }
        }
    }
    return {reviewers, requiredReviewers};
};

/**
 * @desc Filter out from reviewers, requiredRevieweres, and notified any names
 * that show up in removedJustNames. Used to filter out people who have commented
 * #removeme on the pull request.
 * @param reviewers - List of reviewers generated from getReviewers
 * @param requiredReviewers - List of required reviewers generated from getReviewers
 * @param notified - List of people to notify generated from getNotified
 * @param removedJustNames - List of people who have commented #removeme
 */
const getFilteredLists = (
    reviewers: NameToFiles,
    requiredReviewers: NameToFiles,
    notified: NameToFiles,
    removedJustNames: string[],
): string[] => {
    for (const justName of removedJustNames) {
        const username = `@${justName}`;
        if (reviewers[username]) {
            delete reviewers[username];
        }
        if (requiredReviewers[username]) {
            delete requiredReviewers[username];
        }
        if (notified[username]) {
            delete notified[username];
        }
    }

    const actualReviewers: string[] = Object.keys(requiredReviewers)
        .concat(
            Object.keys(reviewers).filter(
                (reviewer: string) => !Object.keys(requiredReviewers).includes(reviewer),
            ),
        )
        .map((username: string) => username.slice(1));

    return actualReviewers;
};

/**
 * @desc Parse existing comments on the pull request to get the comments that
 * denote reviewers, required revieweres, and notifiees. Also find all the
 * #removeme comments to figure out who shouldn't be readded on the pull request.
 * @param existingComments - List of existing Github comments.
 */
const parseExistingComments = <
    T: {|user: {|login: string|}, body: string|} | Octokit$IssuesListCommentsResponseItem,
>(
    existingComments: Octokit$Response<T[]> | {data: T[]},
): {
    notifiedComment: ?T,
    reviewersComment: ?T,
    reqReviewersComment: ?T,
    removedJustNames: string[],
} => {
    const actionBotComments: T[] = [];
    const removedJustNames: string[] = [];
    let reqReviewersComment: ?T;
    let notifiedComment: ?T;
    let reviewersComment: ?T;

    existingComments.data.map(cmnt => {
        // only look at comments made by github-actions[bot] for <required> reviewers / notified comments
        if (cmnt.user.login === 'github-actions[bot]') {
            actionBotComments.push(cmnt);
        } else {
            const removeMeMatch = cmnt.body.match(/\#removeme/i);
            if (removeMeMatch) {
                removedJustNames.push(cmnt.user.login);
            }
        }
    });

    actionBotComments.forEach(comment => {
        const notifiedMatch = comment.body.match(/^Notified:/i);
        if (notifiedMatch) {
            notifiedComment = comment;
        }

        const reviewersMatch = comment.body.match(/^Reviewers:/i);
        if (reviewersMatch) {
            reviewersComment = comment;
        }

        const reqReviewersMatch = comment.body.match(/^Required reviewers:/i);
        if (reqReviewersMatch) {
            reqReviewersComment = comment;
        }
    });

    return {notifiedComment, reviewersComment, reqReviewersComment, removedJustNames};
};

/**
 * @desc Get the diff of each file that has been changed.
 * @param context - @actions/github context from which to find the base of the pull request.
 */
const getFileDiffs = async (
    context: Context | {payload: {pull_request: {base: {ref: string}}}},
): {[string]: string, ...} => {
    // get raw diff and split it by 'diff --git', which appears at the start of every new file.
    const rawDiffs = (
        await execCmd('git', ['diff', 'origin/' + context.payload.pull_request.base.ref])
    ).split(/^diff --git /m);
    const fileToDiff: {[string]: string, ...} = {}; // object of {[file: string]: string}

    for (const diff of rawDiffs) {
        // each diff starts with 'a/<relativeFilePath>', so we can grab the filename from that
        const fileName = diff.match(/(?<=^a\/)\S*/);
        if (fileName) {
            fileToDiff[fileName[0]] = diff;
        }
    }

    return fileToDiff;
};

/**
 * @desc Read the pull request body and update or add the Required Reviewers section.
 */
const getPullRequestBody = (requiredReviewers: NameToFiles, currentBody: string) => {
    const comment = '\n## Required Reviewers:\n\n' + Object.keys(requiredReviewers).join(', ');
    let body: string;
    const bodyUntilHeader = currentBody.match(/^(.|\s(?!## Required Reviewers:))*/gim);
    if (bodyUntilHeader) {
        body = bodyUntilHeader[0] + comment;
    } else {
        body = currentBody + comment;
    }
    return body;
};

const __maybeAddIfMatch = maybeAddIfMatch;
const __turnPatternIntoRegex = turnPatternIntoRegex;
const __parseUsername = parseUsername;
const __pushOrSetToBin = pushOrSetToBin;

module.exports = {
    __maybeAddIfMatch,
    __turnPatternIntoRegex,
    __parseUsername,
    __pushOrSetToBin,
    getNotified,
    getReviewers,
    parseExistingComments,
    getFileDiffs,
    getPullRequestBody,
    getFilteredLists,
};
