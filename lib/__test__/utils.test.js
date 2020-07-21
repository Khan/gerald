// @flow

import glob from 'glob';

import {
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
} from '../utils';

const globOptions = {matchBase: true, dot: true};

const mockTestFileDiff = `a/testFile b/testFile
new file mode 123456
index 0000000..1234567
--- /dev/null
+++ b/testFile
@@ -0,0 +1,220 @@
+this is a new line that was added
-this is an old line that was removed
`;

const mockOtherFileDiff = `a/otherFile.js b/otherFile.js
new file mode 123456
index 0000000..1234567
--- /dev/null
+++ b/otherFile.js
@@ -0,0 +1,220 @@
export const testFn = () => {
-   console.log('hi');
+   console.log('hello world');
}
`;

/* flow-uncovered-block */
jest.mock('../execCmd.js', () => ({
    ...jest.requireActual('../execCmd.js'),
    execCmd: async (cmd: string, args: string[]) => {
        return await new Promise((res, rej) => {
            const string = `diff --git ${mockTestFileDiff}diff --git ${mockOtherFileDiff}`;
            process.nextTick(() => res(string));
        });
    },
}));
/* end flow-uncovered-block */

describe('maybe add', () => {
    it('should work', () => {
        let pattern = /test/;
        let diffs = {testFile: 'a diff with the word test'};
        const name = 'testName';
        const bin = {testName: []};

        __maybeAddIfMatch(pattern, name, diffs, bin);

        expect(bin).toEqual({testName: ['testFile']});

        // it shouldn't re-add 'testFile' or another testName key
        __maybeAddIfMatch(pattern, name, diffs, bin);

        expect(bin).toEqual({testName: ['testFile']});

        pattern = /nonexistent/;

        __maybeAddIfMatch(pattern, name, diffs, bin);

        expect(bin).toEqual({testName: ['testFile']});

        pattern = /existent/;
        diffs = {otherFile: 'the word existent exists in this diff'};

        __maybeAddIfMatch(pattern, name, diffs, bin);

        expect(bin).toEqual({testName: ['testFile', 'otherFile']});
    });
});

describe('turn into regex', () => {
    it('should work', () => {
        const pattern = '"/test/ig"';
        const result = __turnPatternIntoRegex(pattern);

        expect(result.flags.split('')).toEqual(expect.arrayContaining(['i', 'g']));
        expect(result.source).toEqual('test');
    });

    it('should work', () => {
        const pattern = '"/look for "quotes"/img"';
        const result = __turnPatternIntoRegex(pattern);

        expect(result.flags.split('')).toEqual(expect.arrayContaining(['i', 'g', 'm']));
    });

    it('should error', () => {
        const pattern = '/this is invalid/';

        try {
            __turnPatternIntoRegex(pattern);
            /* flow-uncovered-block */
        } catch (e) {
            expect(e).toEqual(new Error(`The RegExp: ${pattern} isn't valid`));
            /* end flow-uncovered-block */
        }
    });
});

describe('parse usernames', () => {
    it('should work', () => {
        const original = '@yipstanley!';

        const result = __parseUsername(original);

        expect(result).toEqual({
            original: original,
            username: '@yipstanley',
            justName: 'yipstanley',
            isRequired: true,
        });
    });

    it('should work', () => {
        const original = '@yipstanley';

        const result = __parseUsername(original);

        expect(result).toEqual({
            original: original,
            username: '@yipstanley',
            justName: 'yipstanley',
            isRequired: false,
        });
    });
});

describe('push or set to bin', () => {
    it('should work', () => {
        const bin = {};
        const username = 'testName';
        let files = ['file1', 'file2'];
        __pushOrSetToBin(bin, username, files);
        expect(bin).toEqual({testName: files});

        files = ['file2', 'file3', 'file4'];
        __pushOrSetToBin(bin, username, files);
        expect(bin).toEqual({testName: ['file1', 'file2', 'file3', 'file4']});
    });
});

describe('get notified', () => {
    it('should work', async () => {
        const notifiedFile = `# comment
*                   @userName

[ON PULL REQUEST] (DO NOT DELETE THIS LINE)

.github/**          @githubUser
*.js                @yipstanley @githubUser
"/test/ig"          @testperson
# *                 @otherperson

[ON PUSH WITHOUT PULL REQUEST] (DO NOT DELETE THIS LINE)

*.js                @owner`;

        const filesChanged = ['.github/workflows/build.yml', 'lib/execCmd.js', 'lib/main.js'];
        const fileDiffs = {'yaml.yml': 'this is a function that has added this test line'};

        expect(await getNotified(filesChanged, fileDiffs, 'pull_request', notifiedFile)).toEqual({
            '@yipstanley': ['lib/execCmd.js', 'lib/main.js'],
            '@githubUser': ['.github/workflows/build.yml', 'lib/execCmd.js', 'lib/main.js'],
            '@testperson': ['yaml.yml'],
        });

        expect(await getNotified(filesChanged, fileDiffs, 'push', notifiedFile)).toEqual({
            '@owner': ['lib/execCmd.js', 'lib/main.js'],
        });
    });
});

describe('get reviewers', () => {
    it('should work', async () => {
        const reviewersFile = `# comment
*                   @userName

[ON PULL REQUEST] (DO NOT DELETE THIS LINE)

.github/**          @githubUser!
*.js                @yipstanley! @githubUser
"/test/ig"          @testperson
# *                 @otherperson`;
        const filesChanged = ['.github/workflows/build.yml', 'lib/execCmd.js', 'lib/main.js'];
        const fileDiffs = {'yaml.yml': 'this is a function that has added this test line'};

        const {requiredReviewers, reviewers} = await getReviewers(
            filesChanged,
            fileDiffs,
            'yipstanley',
            reviewersFile,
        );
        expect(reviewers).toEqual({
            '@githubUser': ['lib/execCmd.js', 'lib/main.js'],
            '@testperson': ['yaml.yml'],
        });
        expect(requiredReviewers).toEqual({
            '@githubUser': ['.github/workflows/build.yml'],
        });
    });
});

describe('get correct section', () => {
    it('should work', () => {
        const rawFile = `this should not show up

[ON PULL REQUEST] (DO NOT DELETE THIS LINE)

this should show up!

[ON PUSH WITHOUT PULL REQUEST] (DO NOT DELETE THIS LINE)

this should show up 2!`;

        let result = getCorrectSection(rawFile, 'NOTIFIED', 'pull_request');
        if (!result) {
            expect(true).toBe(false);
            return;
        }

        expect(result[0]).toBe('\n\nthis should show up!\n\n');

        result = getCorrectSection(rawFile, 'NOTIFIED', 'push');
        if (!result) {
            expect(true).toBe(false);
            return;
        }
        expect(result[0]).toBe('\n\nthis should show up 2!');

        try {
            getCorrectSection(rawFile, 'REVIEWERS', 'push');
            /* flow-uncovered-block */
        } catch (e) {
            expect(e).toEqual(new Error(`The REVIEWERS file does not have a 'push' section.`));
            /* end flow-uncovered-block */
        }
    });
});

describe('get filtered lists', () => {
    it('should work', async () => {
        const sampleFile = `# comment
[ON PULL REQUEST] (DO NOT DELETE THIS LINE)

.github/**          @githubUser!
*.js                @yipstanley! @githubUser @Org/Slug-name
"/test/ig"          @testperson
# *                 @otherperson

[ON PUSH WITHOUT PULL REQUEST] (DO NOT DELETE THIS LINE)`;
        const filesChanged = [
            '.github/workflows/pr-notify.js',
            '.github/workflows/pr-notify.yml',
            '.github/NOTIFIED',
        ];
        const fileDiffs = {'yaml.yml': 'this is a function that has added this test line'};

        const {requiredReviewers, reviewers} = await getReviewers(
            filesChanged,
            fileDiffs,
            'yipstanley',
            sampleFile,
        );
        const notified = getNotified(filesChanged, fileDiffs, 'pull_request', sampleFile);
        const {actualReviewers, teamReviewers} = getFilteredLists(
            reviewers,
            requiredReviewers,
            notified,
            ['yipstanley', 'testperson'],
        );
        expect(actualReviewers).toEqual(expect.arrayContaining(['githubUser']));
        expect(teamReviewers).toEqual(expect.arrayContaining(['Slug-name']));
    });
});

describe('parse existing comments', () => {
    it('should work', () => {
        const gerald = {
            user: {login: 'github-actions[bot]'},
            body: `# Gerald:

            ## Notified:

            ## Reviewers:

            ## Required reviewers:`,
        };
        const existingComments = {
            data: [
                gerald,
                {user: {login: 'github-actions[bot]'}, body: 'irrelevant comment'},
                {user: {login: 'github-actions[bot]'}, body: 'another irrelevant comment'},
                {
                    user: {login: 'yipstanley'},
                    body: '#removeme',
                },
                {
                    user: {login: 'github-actions[bot]'},
                    body: 'Required Reviewers:\n\n:',
                },
                {user: {login: 'github-actions[bot]'}, body: 'Reviewers:\n\n:'},
            ],
        };

        const {megaComment, removedJustNames} = parseExistingComments(existingComments);

        expect(megaComment).toEqual(megaComment);
        expect(removedJustNames).toEqual(['yipstanley']);
    });
});

describe('test get file diffs', () => {
    it('should work', async () => {
        const result = await getFileDiffs('');

        expect(result['testFile']).toEqual(mockTestFileDiff);

        expect(result['otherFile.js']).toEqual(mockOtherFileDiff);
    });
});

describe('test caching glob calls', () => {
    beforeAll(() => {
        // this test takes about 15 seconds.
        jest.setTimeout(30000);
    });

    it('should work', async () => {
        // run and track the time it takes to run a synchronous, uncached glob search
        const globPatterns = ['**', '*.js', 'main', 'utils', '**src/**'];
        const syncResults: Array<string> = [];
        const syncStartTime = new Date().getTime();

        for (const pattern of globPatterns) {
            syncResults.push(...glob.sync(pattern, globOptions));
        }

        const syncEndTime = new Date().getTime();

        // do the same for an asynchronous, cached glob search
        const asyncResults: Array<string> = [];
        const asyncStartTime = new Date().getTime();
        let cache: {[path: string]: boolean | 'DIR' | 'FILE' | $ReadOnlyArray<string>, ...} = {};

        for (const pattern of globPatterns) {
            const {matchedFiles, newCache} = await __globAsync(pattern, {
                cache: cache,
                ...globOptions,
            });
            asyncResults.push(...matchedFiles);
            cache = {...cache, ...newCache};
        }

        const asyncEndTime = new Date().getTime();

        // on average the uncached glob search takes about 1.2X the speed of the cached glob search
        expect(asyncEndTime - asyncStartTime < syncEndTime - syncStartTime);
        expect(syncResults).toEqual(asyncResults);
    });
});
