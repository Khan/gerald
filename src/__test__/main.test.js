// @flow

import {
    __makeCommitComment,
    __testGetCommit,
    __testGetMessage,
    runPush,
    __makeCommentBody,
} from '../main';

/* flow-uncovered-block */
/* Mock the GitHub object's commands so that they act on an internal corpus of commits and messages
 * as opposed to authenticating the object and using actual GitHub.
 */
jest.mock('@actions/github', () => ({
    ...jest.requireActual('@actions/github'),
    GitHub: (auth: string) => {
        const commits: {[sha: string]: {data: {sha: string, parents: {length: number}}}, ...} = {
            '0': {data: {sha: '0', parents: {length: 1}}},
            '1': {data: {sha: '1', parents: {length: 1}}},
            '10': {data: {sha: '10', parents: {length: 1}}},
            '11': {data: {sha: '11', parents: {length: 1}}},
            '12': {data: {sha: '12', parents: {length: 1}}},
            '13': {data: {sha: '13', parents: {length: 1}}},
            '14': {data: {sha: '14', parents: {length: 2}}},
            '20': {data: {sha: '20', parents: {length: 1}}},
        };
        const messages: {[sha: string]: string, ...} = {};
        return {
            git: {
                getCommit: async (params: {commit_sha: string, ...}) => {
                    if (params.commit_sha.startsWith('m')) {
                        return messages[params.commit_sha.slice(1)];
                    } else {
                        return commits[params.commit_sha];
                    }
                },
            },
            repos: {
                createCommitComment: async (params: {commit_sha: string, body: string, ...}) => {
                    messages[params.commit_sha] = params.body;
                },
            },
        };
    },
}));

/**
 * Mock execCmd to always return these files. This won't affect the execCmd used
 * in getFileDiffs because we're also going to be mocking getFileDiffs.
 */
jest.mock('../execCmd.js', () => ({
    ...jest.requireActual('../execCmd.js'),
    execCmd: async (cmd: string, args: string[]) => {
        return await new Promise((res, rej) => {
            const string = `src/main.js
src/pr-notify.js
.github/workflows/build.yml`;
            process.nextTick(() => res(string));
        });
    },
}));

/**
 * Mock getFileDifss to return a diff for commit 13 just to test that RegEx still works.
 */
jest.mock('../utils.js', () => ({
    ...jest.requireActual('../utils.js'),
    getFileDiffs: async (diffString: string) => {
        if (diffString === '12...13') {
            return {'src/main.js': '+ this line was added'};
        }
        return {};
    },
}));
/* end flow-uncovered-block */

/**
 * Helper function to make test commits.
 *
 * @param id - Fake commit ID.
 * @param message - Commit message
 */
const makeTestCommit = (id: string, message: string) => {
    return {
        comment_count: 0,
        message: message,
        id: id,
        url: 'test.url',
        author: 'yipstanley',
        committer: 'yipstanley',
        tree: {},
        verification: {},
    };
};

describe('test that the mock works', () => {
    it('should work', async () => {
        const testObject = {
            context: {
                issue: {owner: 'Khan', repo: 'Gerald', number: 0},
                payload: {
                    pull_request: {},
                    before: '0',
                    after: '1',
                    commits: [makeTestCommit('0', 'test')],
                },
                actor: 'yipstanley',
            },
            testNotified: `# comment
*                   @userName

[ON PULL REQUEST] (DO NOT DELETE THIS LINE)

.github/**          @githubUser
**/*                @yipstanley @githubUser
"/test/ig"          @testperson
# *                 @otherperson

[ON PUSH WITHOUT PULL REQUEST] (DO NOT DELETE THIS LINE)

**/*                @yipstanley`,
        };

        await runPush(testObject);

        expect(await __testGetCommit('0')).toEqual({data: {sha: '0', parents: {length: 1}}});
        expect(await __testGetMessage('0')).toMatchInlineSnapshot(`
            "Notify of Push Without Pull Request

            @yipstanley for changes to \`src/main.js\`, \`src/pr-notify.js\`, \`.github/workflows/build.yml\`
            "
        `);
    });
});

describe('test simple working case', () => {
    it('should work', async () => {
        const testObject = {
            context: {
                issue: {owner: 'Khan', repo: 'Gerald', number: 0},
                payload: {
                    pull_request: {},
                    before: '10',
                    after: '14',
                    commits: [
                        makeTestCommit('11', 'First commit'),
                        makeTestCommit('12', 'Second commit'),
                        makeTestCommit('13', 'third commit'),
                        makeTestCommit('14', 'lastCommit'),
                    ],
                },
                actor: 'yipstanley',
            },
            testNotified: `# comment
*                   @userName

[ON PULL REQUEST] (DO NOT DELETE THIS LINE)

.github/**          @githubUser
**/*                @yipstanley @githubUser
"/test/ig"          @testperson
# *                 @otherperson

[ON PUSH WITHOUT PULL REQUEST] (DO NOT DELETE THIS LINE)

src/**              @yipstanley
"/^\\+/m"           @Khan/frontend-infra`,
        };

        await runPush(testObject);

        // test that commit 13 has the correct message
        expect(await __testGetMessage('13')).toMatchInlineSnapshot(`
            "Notify of Push Without Pull Request

            @yipstanley for changes to \`src/main.js\`, \`src/pr-notify.js\`
            @Khan/frontend-infra for changes to \`src/main.js\`
            "
        `);
        // test that commit 14 doesn't have a message because it is a merge commit
        expect(await __testGetMessage('14')).toEqual(undefined);
    });
});

describe('test that make functions make well formatted messages', () => {
    it('should work', async () => {
        const peopleToFiles = {
            '@yipstanley': ['src/main.js', '.github/workflows/build.yml'],
            '@Khan/frontend-infra': ['src/main.js', '.geraldignore'],
        };

        await __makeCommitComment(peopleToFiles, '20');

        expect(await __testGetMessage('20')).toMatchInlineSnapshot(`
            "Notify of Push Without Pull Request

            @yipstanley for changes to \`src/main.js\`, \`.github/workflows/build.yml\`
            @Khan/frontend-infra for changes to \`src/main.js\`, \`.geraldignore\`
            "
        `);
    });

    it('should work', async () => {
        const peopleToFiles = {
            '@yipstanley': ['src/main.js', '.github/workflows/build.yml'],
            '@Khan/frontend-infra': ['src/main.js', '.geraldignore'],
        };

        const result = await __makeCommentBody(peopleToFiles, 'Reviewers:\n');

        expect(result).toMatchInlineSnapshot(`
            "### Reviewers:
            @yipstanley for changes to \`src/main.js\`, \`.github/workflows/build.yml\`

            @Khan/frontend-infra for changes to \`src/main.js\`, \`.geraldignore\`

            "
        `);
    });
});
