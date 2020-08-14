// @flow

import {
    type Octokit,
    type Octokit$IssuesListCommentsResponseItem,
    type Octokit$Response,
} from '@octokit/rest';
import fs from 'fs';
import fg from 'fast-glob'; // flow-uncovered-line

import {readFileSync} from './fs';
import {execCmd} from './execCmd';
import {
    GERALD_IGNORE_FILE,
    GIT_IGNORE_FILE,
    PULL_REQUEST,
    NOTIFIED,
    NOTIFIED_FILE,
    REVIEWERS_FILE,
    REVIEWERS,
    COMMENT_SYMBOL,
    MATCH_REGEX_REGEX,
    MATCH_PATTERN_REGEX,
    MATCH_PULL_REQUEST_SECTION_HEADER_REGEX,
    MATCH_PUSH_SECTION_HEADER_REGEX,
    MATCH_PULL_REQUEST_TO_PUSH_SECTION_REGEX,
    MATCH_JUST_PULL_REQUEST_SECTION_REGEX,
    MATCH_JUST_PUSH_SECTION_REGEX,
    MATCH_USERNAME_OR_TEAM_REGEX,
    MATCH_NON_COMMENT_LINES_REGEX,
    MATCH_REMOVEME_TAG_REGEX,
    MATCH_GERALD_COMMENT_HEADER_REGEX,
    MATCH_GIT_DIFF_FILE_NAME,
    MATCH_GIT_DIFF_FILE_SEPERATOR,
} from './constants';

type Section = 'pull_request' | 'push';
type GeraldFile = 'NOTIFIED' | 'REVIEWERS';
type NameToFiles = {[name: string]: string[], ...};
type CommentHeaders = 'Reviewers:\n' | 'Required reviewers:\n' | 'Notified:\n';

export const makeCommentBody = (
    peopleToFiles: {[string]: Array<string>, ...},
    sectionHeader: CommentHeaders,
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
 * @desc Parse the ./.geraldignore and ./.gitignore style of files. Ignore new lines
 * and comments.
 *
 * @param fileContents - A string of files/directories to ignore a la .gitignore.
 * Comments should start with a #.
 */
const filterIgnoreFiles = (fileContents: string): Array<string> => {
    const filteredOutMostCases = fileContents
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .filter(line => !line.startsWith(COMMENT_SYMBOL));

    // at this point, we have everything covered except for the case exhibited by the line below:
    // directory_A # we want to ignore directory_A because of x, y, and z.
    return filteredOutMostCases.map(line => {
        if (line.indexOf(COMMENT_SYMBOL) !== -1) {
            return line.split(COMMENT_SYMBOL)[0].trim();
        }
        return line;
    });
};

/**
 * @desc If any of the usernames in removedJustNames are reviewers, we should also
 * remove them as a reviewer.
 *
 * @param removedJustNames - Just the usernames (not including @) of the people
 * who have requeseted to be removed.
 * @param params - The owner, repo, and pull_number parameters for Octokit requests.
 * They can't be imported, because that would make this file really difficult to test.
 * @param githubClient - The Octokit client that we can make calls on. We also can't import this.
 */
export const maybeRemoveReviewRequests = async (
    removedJustNames: Array<string>,
    params: {owner: string, repo: string, pull_number: number},
    githubClient: Octokit,
) => {
    const {data: reviewRequests} = await githubClient.pulls.listReviewRequests({...params});
    const toRemove = reviewRequests.users
        .filter(user => removedJustNames.includes(user.login))
        .map(user => user.login);
    if (toRemove.length) {
        await githubClient.pulls.deleteReviewRequest({
            ...params,
            reviewers: toRemove,
        });
    }
};

/**
 * @desc Read ./.geraldignore and ./.gitignore if they exist.
 * Split the files by newlines to serve as the list of files/directories to
 * ignore for Gerald. Be sure to ignore empty lines and comments (otherwise fast-glob
 * will throw Type errors).
 */
const getGeraldIgnore = (): Array<string> => {
    const ignore = [];
    if (fs.existsSync(GERALD_IGNORE_FILE)) {
        const geraldIgnore = filterIgnoreFiles(fs.readFileSync(GERALD_IGNORE_FILE, 'utf-8'));
        ignore.push(...geraldIgnore);
    }
    if (fs.existsSync(GIT_IGNORE_FILE)) {
        const gitIgnore = filterIgnoreFiles(fs.readFileSync(GIT_IGNORE_FILE, 'utf-8'));
        for (const line of gitIgnore) {
            if (!ignore.includes(line)) {
                ignore.push(line);
            }
        }
    }

    return ignore;
};

const geraldIgnore = getGeraldIgnore();
const globOptions = {
    dot: true,
    ignore: geraldIgnore,
};

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
    const match = MATCH_REGEX_REGEX.exec(pattern);
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
): {username: string, justName: string, isRequired: boolean} => {
    const justName = original.match(/[^@!]+/);
    if (justName && justName[0]) {
        const isRequired = original.endsWith('!');
        return {
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
export const getCorrectSection = (rawFile: string, file: GeraldFile, section: Section) => {
    if (!rawFile.match(MATCH_PULL_REQUEST_SECTION_HEADER_REGEX)) {
        throw new Error(
            `Invalid ${file} file. Could not find a line with the text: '[ON PULL REQUEST] (DO NOT DELETE THIS LINE)'. Please add this line back. Anything before this line will be ignored by Gerald, and all rules in this section will be employed on pull requests.`,
        );
    }

    if (file === NOTIFIED && !rawFile.match(MATCH_PUSH_SECTION_HEADER_REGEX)) {
        throw new Error(
            `Invalid ${file} file. Could not find a line with the text: '[ON PUSH WITHOUT PULL REQUEST] (DO NOT DELETE THIS LINE)'. Please add this line back. All rules below this line will be employed on changes to master or develop that don't go through a pull request.`,
        );
    }
    let sectionRegexp;
    if (section === PULL_REQUEST) {
        sectionRegexp =
            file === NOTIFIED
                ? MATCH_PULL_REQUEST_TO_PUSH_SECTION_REGEX
                : MATCH_JUST_PULL_REQUEST_SECTION_REGEX;
    }
    // if we're requesting the push section, make sure it's on the NOTIFIED file.
    else if (file === NOTIFIED) {
        sectionRegexp = MATCH_JUST_PUSH_SECTION_REGEX;
    } else {
        throw new Error("The REVIEWERS file does not have a 'push' section.");
    }
    return rawFile.match(sectionRegexp);
};

/**
 * @desc Parse .github/NOTIFIED and return an object where each entry is a
 * unique person to notify and the files that they are being notified for.
 * @param filesChanged - List of changed files.
 * @param filesDiffs - Map of changed files to their diffs.
 * @param on - Which section of the NOTIFIED file are we looking at, the 'pull_request' section or the 'push' section?
 * @param __testContent - For testing, mimicks .github/NOTIFIED content.
 */
export const getNotified = (
    filesChanged: Array<string>,
    fileDiffs: {[string]: string, ...},
    fileContents: {[string]: string, ...},
    on: Section,
    __testContent: ?string = undefined,
): NameToFiles => {
    const buf = readFileSync(NOTIFIED_FILE, 'utf-8');
    const section = getCorrectSection(buf, NOTIFIED, on);
    if (!section) {
        return {};
    }

    const matches = section[0].match(/^[^\#\n].*/gm); // ignore newline comments
    const notified: NameToFiles = {};
    if (matches) {
        for (const match of matches) {
            let rule = match;
            // ignore inline comments
            if (match.includes(COMMENT_SYMBOL)) {
                rule = match.split(COMMENT_SYMBOL)[0].trim();
            }
            const untrimmedPattern = rule.match(MATCH_PATTERN_REGEX);
            const names = rule.match(MATCH_USERNAME_OR_TEAM_REGEX);
            const againstFileContents = rule.match(/--match-contents\s*$/);
            if (!untrimmedPattern || !names) {
                continue;
            }

            const pattern = untrimmedPattern[0].trim();

            // handle dealing with regex
            if (pattern.startsWith('"') && pattern.endsWith('"')) {
                const regex = turnPatternIntoRegex(pattern);
                const objToUse = againstFileContents ? fileContents : fileDiffs;
                for (const name of names) {
                    maybeAddIfMatch(regex, name, objToUse, notified);
                }
            }
            // handle dealing with glob matches
            else {
                const matchedFiles: Array<string> = fg.sync(pattern, globOptions); // flow-uncovered-line
                const intersection = matchedFiles.filter(file => filesChanged.includes(file));

                if (intersection.length) {
                    for (const name of names) {
                        pushOrSetToBin(notified, name, intersection);
                    }
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
export const getReviewers = (
    filesChanged: string[],
    fileDiffs: {[string]: string, ...},
    fileContents: {[string]: string, ...},
    issuer: string,
): {reviewers: NameToFiles, requiredReviewers: NameToFiles} => {
    const buf = readFileSync(REVIEWERS_FILE, 'utf-8');
    const section = getCorrectSection(buf, REVIEWERS, PULL_REQUEST);

    if (!section) {
        return {reviewers: {}, requiredReviewers: {}};
    }

    const matches = section[0].match(MATCH_NON_COMMENT_LINES_REGEX); // ignore newline comments
    const reviewers: {[string]: Array<string>, ...} = {};
    const requiredReviewers: {[string]: Array<string>, ...} = {};
    if (!matches) {
        return {reviewers, requiredReviewers};
    }

    for (const match of matches) {
        let rule = match;
        // ignore inline comments
        if (match.includes(COMMENT_SYMBOL)) {
            rule = match.split(COMMENT_SYMBOL)[0].trim();
        }
        const untrimmedPattern = rule.match(MATCH_PATTERN_REGEX);
        const names = rule.match(MATCH_USERNAME_OR_TEAM_REGEX);
        const againstFileContents = rule.match(/--match-contents\s*$/);
        if (!untrimmedPattern || !names) {
            continue;
        }

        const pattern = untrimmedPattern[0].trim();

        // handle dealing with regex
        if (pattern.startsWith('"') && pattern.endsWith('"')) {
            const regex = turnPatternIntoRegex(pattern);
            const objToUse = againstFileContents ? fileContents : fileDiffs;

            for (const name of names) {
                const {username, justName, isRequired} = parseUsername(name);
                // don't add yourself as a reviewer
                if (justName === issuer) {
                    continue;
                }

                const correctBin = isRequired ? requiredReviewers : reviewers;
                maybeAddIfMatch(regex, username, objToUse, correctBin);
            }
        } else {
            const matchedFiles: Array<string> = fg.sync(pattern, globOptions); //flow-uncovered-line
            const intersection = matchedFiles.filter(file => filesChanged.includes(file));

            if (intersection.length) {
                for (const name of names) {
                    // don't add yourself as a reviewer
                    const {username, justName, isRequired} = parseUsername(name);
                    if (justName === issuer) {
                        continue;
                    }

                    const correctBin = isRequired ? requiredReviewers : reviewers;
                    pushOrSetToBin(correctBin, username, intersection);
                }
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
export const getFilteredLists = (
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
 * denote reviewers, required reviewers, and notifiees. Also find all the
 * #removeme comments to figure out who shouldn't be readded on the pull request.
 * @param existingComments - List of existing Github comments.
 */
export const parseExistingComments = <
    T: {|user: {|login: string|}, body: string|} | Octokit$IssuesListCommentsResponseItem,
>(
    existingComments: Octokit$Response<T[]> | {data: T[]},
): {
    megaComment: ?T,
    removedJustNames: string[],
} => {
    const geraldComments: T[] = [];
    const removedJustNames: string[] = [];
    let megaComment: ?T;

    existingComments.data.map(cmnt => {
        // only look at comments that start with # Gerald: for <required> reviewers / notified comments
        if (cmnt.body.match(MATCH_GERALD_COMMENT_HEADER_REGEX)) {
            geraldComments.push(cmnt);
        } else {
            const removeMeMatch = cmnt.body.match(MATCH_REMOVEME_TAG_REGEX);
            if (removeMeMatch) {
                removedJustNames.push(cmnt.user.login);
            }
        }
    });

    geraldComments.forEach(comment => {
        const megaCommentMatch = comment.body.match(MATCH_GERALD_COMMENT_HEADER_REGEX);
        if (megaCommentMatch) {
            megaComment = comment;
        }
    });

    return {megaComment, removedJustNames};
};

/**
 * @desc Get the diff of each file that has been changed.
 * @param diffString - git diff <diffString>
 */
export const getFileDiffs = async (diffString: string): {[string]: string, ...} => {
    // get raw diff and split it by 'diff --git', which appears at the start of every new file.
    const rawDiffs = (await execCmd('git', ['diff', diffString])).split(
        MATCH_GIT_DIFF_FILE_SEPERATOR,
    );
    const fileToDiff: {[string]: string, ...} = {}; // object of {[file: string]: string}

    for (const diff of rawDiffs) {
        // each diff starts with 'a/<relativeFilePath>', so we can grab the filename from that
        const fileName = diff.match(MATCH_GIT_DIFF_FILE_NAME);
        if (fileName) {
            fileToDiff[fileName[0]] = diff;
        }
    }

    return fileToDiff;
};

/**
 * @desc Gets the full contents of the files changed.
 * @param diffString - git diff < diffString>
 */
export const getFileContents = async (diffString: string) => {
    const filesChanged = (await execCmd('git', ['diff', diffString, '--name-only'])).split('\n');
    const fileToContents: {[string]: string, ...} = {};

    for (const file of filesChanged) {
        if (fs.existsSync(file)) {
            const fileContents = readFileSync(file, 'utf-8');
            fileToContents[file] = fileContents;
        }
    }
    return fileToContents;
};

export const __maybeAddIfMatch = maybeAddIfMatch;
export const __turnPatternIntoRegex = turnPatternIntoRegex;
export const __parseUsername = parseUsername;
export const __pushOrSetToBin = pushOrSetToBin;
export const __filterIgnoreFiles = filterIgnoreFiles;
