// @flow

const fs = require('fs');
const glob = require('glob');

const {execCmd} = require('./execCmd');
const globOptions: Options = {
    matchBase: true,
    dot: true,
    ignore: ['node_modules/**', 'coverage/**', '.git/**', 'flow-typed/**'],
    silent: true,
};

import {
    type Octokit$PullsListResponseItem,
    type Octokit$IssuesListCommentsResponseItem,
    type Octokit$Response,
} from '@octokit/rest';
import {type Options} from 'glob';
import G from 'glob';

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
    const justName = original.match(/[^@!]+/);
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
const pushOrSetToBin = (bin: NameToFiles, username: string, files: Array<string>): void => {
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
 * @desc Helper function that parses the raw string of either the NOTIFIED or
 * REVIEWERS file and returns the correct section to be looking at.
 * @param rawFile - The unparsed string of the NOTIFIED or REVIEWERS file.
 * @param file - Which file are we actually looking at?
 * @param section - What section of the file do you want? Only the NOTIFIED file has a 'push' section.
 * @throws if the file is missing a section header or if there was a request to look at the 'push' section of the REVIEWERS file.
 */
const getCorrectSection = (
    rawFile: string,
    file: 'NOTIFIED' | 'REVIEWERS',
    section: 'pull_request' | 'push',
) => {
    if (!rawFile.match(/\[ON PULL REQUEST\] \(DO NOT DELETE THIS LINE\)/gm)) {
        throw new Error(
            `Invalid ${file} file. Could not find a line with the text: '[ON PULL REQUEST] (DO NOT DELETE THIS LINE)'. Please add this line back. Anything before this line will be ignored by Gerald, and all rules in this section will be employed on pull requests.`,
        );
    }

    if (
        file === 'NOTIFIED' &&
        !rawFile.match(/\[ON PUSH WITHOUT PULL REQUEST\] \(DO NOT DELETE THIS LINE\)/gm)
    ) {
        throw new Error(
            `Invalid ${file} file. Could not find a line with the text: '[ON PUSH WITHOUT PULL REQUEST] (DO NOT DELETE THIS LINE)'. Please add this line back. All rules below this line will be employed on changes to master or develop that don't go through a pull request.`,
        );
    }
    let sectionRegexp;
    if (section === 'pull_request') {
        sectionRegexp =
            file === 'NOTIFIED'
                ? /(?<=\[ON PULL REQUEST\] \(DO NOT DELETE THIS LINE\))(.|\n)*(?=\[ON PUSH WITHOUT PULL REQUEST\] \(DO NOT DELETE THIS LINE\))/gm
                : /(?<=\[ON PULL REQUEST\] \(DO NOT DELETE THIS LINE\))(.|\n)*/gm;
    }
    // if we're requesting the push section, make sure it's on the NOTIFIED file.
    else if (file === 'NOTIFIED') {
        sectionRegexp = /(?<=\[ON PUSH WITHOUT PULL REQUEST\] \(DO NOT DELETE THIS LINE\))(.|\n)*/gm;
    } else {
        throw new Error("The REVIEWERS file does not have a 'push' section.");
    }
    return sectionRegexp.exec(rawFile);
};

/**
 * @desc Runs glob.Glob asynchronously, and returns the matches and the cache
 * object so that it can be passed into the next Glob call. We don't use glob.sync
 * (which is a synchronous version of glob.Glob) because it doesn't allow us
 * to get the cache object and pass it into the next call.
 * @param pattern - Glob pattern to match files for
 * @param options - GlobOptions to pass into the glob call
 */
const globAsync = async (
    pattern: string,
    options: Options,
): Promise<{
    matchedFiles: Array<string>,
    newCache: {[path: string]: boolean | 'DIR' | 'FILE' | $ReadOnlyArray<string>, ...},
}> => {
    return new Promise<{
        matchedFiles: Array<string>,
        newCache: {[path: string]: boolean | 'DIR' | 'FILE' | $ReadOnlyArray<string>, ...},
    }>((res, rej) => {
        const g = new glob.Glob(pattern, options, (err: ?Error, matches: Array<string>) => {
            if (err) {
                rej(err);
            } else {
                res({matchedFiles: matches, newCache: g.cache});
            }
        });
    });
};

/**
 * @desc Parse .github/NOTIFIED and return an object where each entry is a
 * unique person to notify and the files that they are being notified for.
 * @param filesChanged - List of changed files.
 * @param filesDiffs - Map of changed files to their diffs.
 * @param on - Which section of the NOTIFIED file are we looking at, the 'pull_request' section or the 'push' section?
 * @param __testContent - For testing, mimicks .github/NOTIFIED content.
 */
const getNotified = async (
    filesChanged: Array<string>,
    fileDiffs: {[string]: string, ...},
    on: 'pull_request' | 'push',
    __testContent: ?string = undefined,
): Promise<NameToFiles> => {
    const buf = __testContent || fs.readFileSync('.github/NOTIFIED', 'utf-8');
    const section = getCorrectSection(buf, 'NOTIFIED', on);
    if (!section) {
        return {};
    }

    const matches = section[0].match(/^[^\#\n].*/gm); // ignore comments
    const notified: NameToFiles = {};
    let cache: {[path: string]: boolean | 'DIR' | 'FILE' | $ReadOnlyArray<string>, ...} = {};
    if (matches) {
        for (const match of matches) {
            const untrimmedPattern = match.match(/(.(?!  @))*/);
            const names = match.match(/@([A-Za-z]*\/)?\S*/g);
            if (!untrimmedPattern || !names) {
                continue;
            }

            const pattern = untrimmedPattern[0].trim();

            // handle dealing with regex
            if (pattern.startsWith('"') && pattern.endsWith('"')) {
                const regex = turnPatternIntoRegex(pattern);
                for (const name of names) {
                    maybeAddIfMatch(regex, name, fileDiffs, notified);
                }
            }
            // handle dealing with glob matches
            else {
                const {matchedFiles, newCache} = await globAsync(pattern, {
                    cache: cache,
                    ...globOptions,
                });
                cache = {...newCache, ...cache};
                // const matchedFiles: string[] = glob.sync(pattern, globOptions); //flow-uncovered-line
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
const getReviewers = async (
    filesChanged: string[],
    fileDiffs: {[string]: string, ...},
    issuer: string,
    __testContent: ?string = undefined,
): Promise<{reviewers: NameToFiles, requiredReviewers: NameToFiles}> => {
    const buf = __testContent || fs.readFileSync('.github/REVIEWERS', 'utf-8');
    const section = getCorrectSection(buf, 'REVIEWERS', 'pull_request');

    if (!section) {
        return {reviewers: {}, requiredReviewers: {}};
    }

    const matches = section[0].match(/^[^\#\n].*/gm); // ignore comments
    const reviewers: {[string]: Array<string>, ...} = {};
    const requiredReviewers: {[string]: Array<string>, ...} = {};
    if (!matches) {
        return {reviewers, requiredReviewers};
    }

    let cache: {[path: string]: boolean | 'DIR' | 'FILE' | $ReadOnlyArray<string>, ...} = {};
    for (const match of matches) {
        const untrimmedPattern = match.match(/(.(?!  @))*/);
        const names = match.match(/@([A-Za-z]*\/)?\S*/g);
        if (!untrimmedPattern || !names) {
            continue;
        }

        const pattern = untrimmedPattern[0].trim();

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
            const {matchedFiles, newCache} = await globAsync(pattern, {
                cache: cache,
                ...globOptions,
            });
            cache = {...cache, ...newCache};
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
    removedJustNames: Array<string>,
): {actualReviewers: Array<string>, teamReviewers: Array<string>} => {
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

    const allReviewers: string[] = Object.keys(requiredReviewers)
        .concat(
            Object.keys(reviewers).filter(
                (reviewer: string) => !Object.keys(requiredReviewers).includes(reviewer),
            ),
        )
        .map((username: string) => username.slice(1));
    const actualReviewers = allReviewers.filter(
        (justName: string) => !justName.match(/[A-Z]\/\S*/i),
    );
    const teamReviewers = allReviewers
        .filter((justName: string) => justName.match(/[A-Z]\/\S*/i))
        .map((slugWithOrg: string) => slugWithOrg.split('/')[1]);
    return {actualReviewers, teamReviewers};
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
    megaComment: ?T,
    removedJustNames: string[],
} => {
    const actionBotComments: T[] = [];
    const removedJustNames: string[] = [];
    let megaComment: ?T;

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
        const megaCommentMatch = comment.body.match(/^# Gerald/i);
        if (megaCommentMatch) {
            megaComment = comment;
        }
    });

    return {megaComment, removedJustNames};
};

/**
 * @desc Get the diff of each file that has been changed.
 * @param context - @actions/github context from which to find the base of the pull request.
 */
const getFileDiffs = async (diffString: string): {[string]: string, ...} => {
    // get raw diff and split it by 'diff --git', which appears at the start of every new file.
    const rawDiffs = (await execCmd('git', ['diff', diffString])).split(/^diff --git /m);
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

const __maybeAddIfMatch = maybeAddIfMatch;
const __turnPatternIntoRegex = turnPatternIntoRegex;
const __parseUsername = parseUsername;
const __pushOrSetToBin = pushOrSetToBin;
const __globAsync = globAsync;

module.exports = {
    __maybeAddIfMatch,
    __turnPatternIntoRegex,
    __parseUsername,
    __pushOrSetToBin,
    __globAsync,
    getNotified,
    getReviewers,
    parseExistingComments,
    getFileDiffs,
    getFilteredLists,
    getCorrectSection,
};
