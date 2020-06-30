const fs = require('fs');
const glob = require('glob');

const {execCmd} = require('./execCmd');
const globOptions = {
    matchBase: true,
    dot: true,
    ignore: ['node_modules/**', 'coverage/**', '.git/**'],
};

const maybeAddIfMatch = (pattern, name, fileDiffs, nameToFilesObj) => {
    for (const [file, diff] of Object.entries(fileDiffs)) {
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

const turnPatternIntoRegex = pattern => {
    const match = /^"\/(.*?)\/([a-z]*)"$/.exec(pattern);
    if (!match) {
        throw new Error("somehow this isn't valid");
    }
    const [_, regexPattern, regexFlags] = match;
    return new RegExp(regexPattern, regexFlags);
};

const parseUsername = original => {
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

const pushOrSetToBin = (bin, username, files) => {
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

const getNotified = (filesChanged, fileDiffs, __testContent = undefined) => {
    const buf = __testContent || fs.readFileSync('.github/NOTIFIED', 'utf-8');
    const matches = buf.match(/^[^\#\n].*/gm); // ignore comments
    const notified = {}; // object of type {[name: string]: string[]}
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

const getReviewers = (filesChanged, fileDiffs, issuer, __testContent = undefined) => {
    const buf = __testContent || fs.readFileSync('.github/REVIEWERS', 'utf-8');
    const matches = buf.match(/^[^\#\n].*/gm); // ignore comments
    const reviewers = {};
    const requiredReviewers = {};
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
                const {_, username, justName, isRequired} = parseUsername(name);
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
                const {_, username, justName, isRequired} = parseUsername(name);
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

const getFilteredLists = (reviewers, requiredReviewers, notified, removedJustNames) => {
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

    const actualReviewers = Object.keys(requiredReviewers)
        .concat(
            Object.keys(reviewers).filter(
                reviewer => !Object.keys(requiredReviewers).includes(reviewer),
            ),
        )
        .map(username => username.slice(1));

    return actualReviewers;
};

const parseExistingComments = existingComments => {
    const actionBotComments = [];
    let removedJustNames = [];
    let reqReviewersComment;
    let notifiedComment;
    let reviewersComment;

    existingComments.data.map(cmnt => {
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

const getFileDiffs = async context => {
    const rawDiffs = (
        await execCmd('git', ['diff', 'origin/' + context.payload.pull_request.base.ref])
    ).split(/^diff --git /m);
    const fileToDiff = {}; // object of {[file: string]: string}

    for (const diff of rawDiffs) {
        // each diff starts with 'a/<relativeFilePath', so we can grab the filename from that
        const fileName = diff.match(/(?<=^a\/)\S*/);
        if (fileName) {
            fileToDiff[fileName[0]] = diff;
        }
    }

    return fileToDiff;
};

const getPullRequestBody = (requiredReviewers, currentBody) => {
    const comment = '\n## Required Reviewers:\n\n' + Object.keys(requiredReviewers).join(', ');
    let body;
    if (currentBody.match(/^## Required Reviewers:$/im)) {
        body = currentBody.match(/^(.|\s(?!## Required Reviewers:))*/gi) + comment;
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
