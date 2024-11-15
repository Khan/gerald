// @flow

import {type Octokit} from '@octokit/rest';
import fs, {existsSync} from 'fs';
import fg from 'fast-glob'; // flow-uncovered-line

type Octokit$IssuesListCommentsResponseItem = $FlowFixMe;
type Octokit$Response<T> = $FlowFixMe<T>;

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
    MATCH_USE_FILE_CONTENTS_REGEX,
} from './constants';

type Section = 'pull_request' | 'push';
type GeraldFile = 'NOTIFIED' | 'REVIEWERS';
type CommentHeaders = 'Reviewers' | 'Required Reviewers' | 'Notified';

export type NameToLabelToFiles = {[name: string]: {[label: string]: string[], ...}, ...};

/**
 * @desc Make the comment body for each of the Gerald sections.
 *
 * @param peopleToLabelToFiles - List of people being notified / requested for review and
 * the files they are being notified for / reviewing.
 * @param sectionHeader - What part of the Gerald comment are we making a section for?
 */
export const makeCommentBody = ({
    peopleToLabelToFiles,
    header,
    tagPerson,
}: {
    peopleToLabelToFiles: NameToLabelToFiles,
    header: CommentHeaders,
    tagPerson: boolean,
}) => {
    const names: string[] = Object.keys(peopleToLabelToFiles);
    if (!names.length) {
        return '';
    }

    let body = `<details>\n<summary><b>${header}</b></summary>\n\n`;
    names.forEach((person: string) => {
        const labels: string[] = Object.keys(peopleToLabelToFiles[person]);
        labels.forEach((label: string) => {
            const files = peopleToLabelToFiles[person][label];
            const filesText = files.join('`, `');
            // escape @ symbols in our files
            const escapedFilesText = filesText.replace(/@/g, '%40@');
            // If we're tagging the person then we don't turn it into an
            // escaped code string.
            const personText = tagPerson ? person : `\`${person}\``;
            const labelText = label ? ` (${label})` : '';
            body += `* ${personText} for changes to \`${escapedFilesText}\`${labelText}\n`;
        });
    });
    body += `</details>\n\n`;
    return body;
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
    const {data: reviewRequests} = await githubClient.pulls.listRequestedReviewers({...params});
    const toRemove = reviewRequests.users
        .filter(user => removedJustNames.includes(user.login))
        .map(user => user.login);
    if (toRemove.length) {
        await githubClient.pulls.removeRequestedReviewers({
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
        const geraldIgnore = filterIgnoreFiles(readFileSync(GERALD_IGNORE_FILE, 'utf-8'));
        ignore.push(...geraldIgnore);
    }
    if (fs.existsSync(GIT_IGNORE_FILE)) {
        const gitIgnore = filterIgnoreFiles(readFileSync(GIT_IGNORE_FILE, 'utf-8'));
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
    label: string,
    fileDiffs: {[string]: string, ...},
    nameToLabelToFilesObj: NameToLabelToFiles,
    filesChanged: Array<string> = [],
): void => {
    for (const file of Object.keys(fileDiffs)) {
        const diff = fileDiffs[file];
        // Only test the file if it's in the list of files that have changed.
        if (filesChanged.includes(file) && pattern.test(diff)) {
            if (!nameToLabelToFilesObj[name]) {
                nameToLabelToFilesObj[name] = {};
            }
            if (!nameToLabelToFilesObj[name][label]) {
                nameToLabelToFilesObj[name][label] = [file];
            } else if (!nameToLabelToFilesObj[name][label].includes(file)) {
                nameToLabelToFilesObj[name][label].push(file);
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
const pushOrSetToBin = (
    bin: NameToLabelToFiles,
    username: string,
    label: string,
    files: Array<string>,
): void => {
    if (!bin[username]) {
        bin[username] = {};
    }
    if (!bin[username][label]) {
        bin[username][label] = files;
    } else {
        for (const file of files) {
            if (!bin[username][label].includes(file)) {
                bin[username][label].push(file);
            }
        }
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
 * @param fileDiffs - Map of changed files to their diffs.
 * @param fileContents - Map of changed files to their full contents.
 * @param author - The author of the commits/pull-request
 * @param on - Which section of the NOTIFIED file are we looking at, the 'pull_request' section or the 'push' section?
 * @param __testContent - For testing, mimicks .github/NOTIFIED content.
 */
export const getNotified = (
    filesChanged: Array<string>,
    fileDiffs: {[string]: string, ...},
    fileContents: {[string]: string, ...},
    author: string,
    on: Section,
    __testContent: ?string = undefined,
): NameToLabelToFiles => {
    if (!existsSync(NOTIFIED_FILE)) {
        return {};
    }
    const buf = readFileSync(NOTIFIED_FILE, 'utf-8');
    const section = getCorrectSection(buf, NOTIFIED, on);
    if (!section) {
        return {};
    }

    const matches = section[0].match(/^[^#\n]+/gm);
    if (!matches) {
        return {};
    }

    const notified: NameToLabelToFiles = {};
    for (const match of matches) {
        if (!match || !match.trim()) {
            continue;
        }
        const rule = match.trim();
        const untrimmedPattern = rule.match(MATCH_PATTERN_REGEX);
        const names = rule.match(MATCH_USERNAME_OR_TEAM_REGEX);
        const againstFileContents = rule.match(MATCH_USE_FILE_CONTENTS_REGEX);
        if (!untrimmedPattern || !names) {
            continue;
        }

        // TODO(csilvers): also keep track of the line-number the
        // label is on, and make label an href to that line in github.
        const label = untrimmedPattern[1] || '';
        const pattern = untrimmedPattern[2].trim();

        // handle dealing with regex
        if (pattern.startsWith('"') && pattern.endsWith('"')) {
            const regex = turnPatternIntoRegex(pattern);
            const objToUse = againstFileContents ? fileContents : fileDiffs;
            for (const name of names) {
                if (parseUsername(name).justName !== author) {
                    maybeAddIfMatch(regex, name, label, objToUse, notified, filesChanged);
                }
            }
        }
        // handle dealing with glob matches
        else {
            const matchedFiles: Array<string> = fg.sync(pattern, globOptions); // flow-uncovered-line
            const intersection = matchedFiles.filter(file => filesChanged.includes(file));

            if (intersection.length) {
                for (const name of names) {
                    if (parseUsername(name).justName !== author) {
                        pushOrSetToBin(notified, name, label, intersection);
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
 * @param fileDiffs - Map of changed files to their diffs.
 * @param fileContents - Map of changed files to their full contents.
 * @param issuer - The person making the pull request should not be a reviewer.
 * @param __testContent - For testing, mimicks .github/REVIEWERS content.
 */
export const getReviewers = (
    filesChanged: string[],
    fileDiffs: {[string]: string, ...},
    fileContents: {[string]: string, ...},
    issuer: string,
): {reviewers: NameToLabelToFiles, requiredReviewers: NameToLabelToFiles} => {
    const buf = readFileSync(REVIEWERS_FILE, 'utf-8');
    const section = getCorrectSection(buf, REVIEWERS, PULL_REQUEST);

    if (!section) {
        return {reviewers: {}, requiredReviewers: {}};
    }

    const matches = section[0].match(MATCH_NON_COMMENT_LINES_REGEX); // ignore newline comments
    const reviewers: NameToLabelToFiles = {};
    const requiredReviewers: NameToLabelToFiles = {};
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
        const againstFileContents = rule.match(MATCH_USE_FILE_CONTENTS_REGEX);
        if (!untrimmedPattern || !names) {
            continue;
        }

        // TODO(csilvers): also keep track of the line-number the
        // label is on, and make label an href to that line in github.
        const label = untrimmedPattern[1] || '';
        const pattern = untrimmedPattern[2].trim();

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
                maybeAddIfMatch(regex, username, label, objToUse, correctBin, filesChanged);
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
                    pushOrSetToBin(correctBin, username, label, intersection);
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
    reviewers: NameToLabelToFiles,
    requiredReviewers: NameToLabelToFiles,
    notified: NameToLabelToFiles,
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
        // only look at comments that start with # Gerald for <required> reviewers / notified comments
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

// exported for testing
export const __maybeAddIfMatch = maybeAddIfMatch;
export const __turnPatternIntoRegex = turnPatternIntoRegex;
export const __parseUsername = parseUsername;
export const __pushOrSetToBin = pushOrSetToBin;
export const __filterIgnoreFiles = filterIgnoreFiles;
