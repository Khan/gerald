const {
    __maybeAddIfMatch,
    __turnPatternIntoRegex,
    __parseUsername,
    __pushOrSetToBin,
    getNotified,
    getReviewers,
    parseExistingComments,
    getFileDiffs,
    getFilteredLists,
    getPullRequestBody,
} = require('../utils');

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

jest.mock('../execCmd.js', () => ({
    ...jest.requireActual('../execCmd.js'),
    execCmd: async (cmd, args) => {
        return await new Promise((res, rej) => {
            const string = `diff --git ${mockTestFileDiff}diff --git ${mockOtherFileDiff}`;
            process.nextTick(() => res(string));
        });
    },
}));

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
        } catch (e) {
            expect(e).toEqual(new Error("somehow this isn't valid"));
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
    it('should work', () => {
        const notifiedFile = `# comment
.github/**          @githubUser
*.js                @yipstanley @githubUser
"/test/ig"          @testperson
# *                 @otherperson`;

        const filesChanged = [
            '.github/workflows/pr-notify.js',
            '.github/workflows/pr-notify.yml',
            '.github/NOTIFIED',
        ];
        const fileDiffs = {'yaml.yml': 'this is a function that has added this test line'};

        expect(getNotified(filesChanged, fileDiffs, notifiedFile)).toEqual({
            '@yipstanley': ['.github/workflows/pr-notify.js'],
            '@githubUser': [
                '.github/NOTIFIED',
                '.github/workflows/pr-notify.js',
                '.github/workflows/pr-notify.yml',
            ],
            '@testperson': ['yaml.yml'],
        });
    });
});

describe('get reviewers', () => {
    it('should work', () => {
        const reviewersFile = `# comment
.github/**          @githubUser!
*.js                @yipstanley! @githubUser
"/test/ig"          @testperson
# *                 @otherperson`;
        const filesChanged = [
            '.github/workflows/pr-notify.js',
            '.github/workflows/pr-notify.yml',
            '.github/NOTIFIED',
        ];
        const fileDiffs = {'yaml.yml': 'this is a function that has added this test line'};

        const {requiredReviewers, reviewers} = getReviewers(
            filesChanged,
            fileDiffs,
            'yipstanley',
            reviewersFile,
        );
        expect(reviewers).toEqual({
            '@githubUser': ['.github/workflows/pr-notify.js'],
            '@testperson': ['yaml.yml'],
        });
        expect(requiredReviewers).toEqual({
            '@githubUser': [
                '.github/NOTIFIED',
                '.github/workflows/pr-notify.js',
                '.github/workflows/pr-notify.yml',
            ],
        });
    });
});

describe('get filtered lists', () => {
    it('should work', () => {
        const sampleFile = `# comment
.github/**          @githubUser!
*.js                @yipstanley! @githubUser
"/test/ig"          @testperson
# *                 @otherperson`;
        const filesChanged = [
            '.github/workflows/pr-notify.js',
            '.github/workflows/pr-notify.yml',
            '.github/NOTIFIED',
        ];
        const fileDiffs = {'yaml.yml': 'this is a function that has added this test line'};

        const {requiredReviewers, reviewers} = getReviewers(
            filesChanged,
            fileDiffs,
            'yipstanley',
            sampleFile,
        );
        const notified = getNotified(filesChanged, fileDiffs, sampleFile);
        const actualReviewers = getFilteredLists(reviewers, requiredReviewers, notified, [
            'yipstanley',
            'testperson',
        ]);
        expect(actualReviewers).toEqual(expect.arrayContaining(['githubUser']));
    });
});

describe('parse existing comments', () => {
    it('should work', () => {
        const notify = {user: {login: 'github-actions[bot]'}, body: 'notified:'};
        const reviewers = {user: {login: 'github-actions[bot]'}, body: 'Reviewers:\n\n:'};
        const reqReviewers = {
            user: {login: 'github-actions[bot]'},
            body: 'Required Reviewers:\n\n:',
        };
        const existingComments = {
            data: [
                notify,
                {user: {login: 'github-actions[bot]'}, body: 'irrelevant comment'},
                {user: {login: 'github-actions[bot]'}, body: 'another irrelevant comment'},
                reviewers,
                {
                    user: {login: 'yipstanley'},
                    body: '#removeme',
                },
                reqReviewers,
            ],
        };

        const {
            notifiedComment,
            reviewersComment,
            reqReviewersComment,
            removedJustNames,
        } = parseExistingComments(existingComments);

        expect(notifiedComment).toEqual(notify);
        expect(reviewersComment).toEqual(reviewers);
        expect(reqReviewersComment).toEqual(reqReviewers);
        expect(removedJustNames).toEqual(['yipstanley']);
    });
});

describe('test get file diffs', () => {
    it('should work', async () => {
        const result = await getFileDiffs({payload: {pull_request: {base: {ref: ''}}}});

        expect(result['testFile']).toEqual(mockTestFileDiff);

        expect(result['otherFile.js']).toEqual(mockOtherFileDiff);
    });
});

describe('test get pull request body', () => {
    it('should work', () => {
        const testBody = `A title

## Summary:
A summary paragraph that includes some things.

Issue: MOB-1234

## Test Plan:
Lorem tests
`;
        const requiredReviewers = {
            '@yipstanley': ['file1.js', 'file2'],
            '@testPerson': ['file1.js', 'file3.md'],
            '@testTeam': ['file2'],
        };

        expect(getPullRequestBody(requiredReviewers, testBody)).toMatchInlineSnapshot(`
            "A title

            ## Summary:
            A summary paragraph that includes some things.

            Issue: MOB-1234

            ## Test Plan:
            Lorem tests

            ## Required Reviewers:

            @yipstanley, @testPerson, @testTeam"
        `);
    });

    it('should work', () => {
        const testBody = `A title

## Summary:
A summary paragraph that includes some things.

Issue: MOB-1234

## Test Plan:
Lorem tests

## Required Reviewers:
`;
        const requiredReviewers = {
            '@yipstanley': ['file1.js', 'file2'],
            '@testPerson': ['file1.js', 'file3.md'],
            '@testTeam': ['file2'],
        };

        expect(getPullRequestBody(requiredReviewers, testBody)).toMatchInlineSnapshot(`
            "A title

            ## Summary:
            A summary paragraph that includes some things.

            Issue: MOB-1234

            ## Test Plan:
            Lorem tests

            ## Required Reviewers:

            @yipstanley, @testPerson, @testTeam"
        `);
    });

    it('should work', () => {
        const testBody = `A title

## Summary:
A summary paragraph that includes some things.

Issue: MOB-1234

## Test Plan:
Lorem tests

## Required Reviewers:

@yipstanley, @testTeam
`;
        const requiredReviewers = {
            '@yipstanley': ['file1.js', 'file2'],
            '@testPerson': ['file1.js', 'file3.md'],
            '@testTeam': ['file2'],
        };

        expect(getPullRequestBody(requiredReviewers, testBody)).toMatchInlineSnapshot(`
            "A title

            ## Summary:
            A summary paragraph that includes some things.

            Issue: MOB-1234

            ## Test Plan:
            Lorem tests

            ## Required Reviewers:

            @yipstanley, @testPerson, @testTeam"
        `);
    });
});
