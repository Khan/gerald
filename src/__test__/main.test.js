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
            'suite1-commit1': {data: {sha: 'suite1-commit1', parents: {length: 1}}},
            'suite1-commit2': {data: {sha: 'suite1-commit2', parents: {length: 1}}},
            'suite2-commit1': {data: {sha: 'suite2-commit1', parents: {length: 1}}},
            'suite2-commit2': {data: {sha: 'suite2-commit2', parents: {length: 1}}},
            'suite2-commit3': {data: {sha: 'suite2-commit3', parents: {length: 1}}},
            'suite2-commit4': {data: {sha: 'suite2-commit4', parents: {length: 1}}},
            'suite2-commit5': {data: {sha: 'suite2-commit5', parents: {length: 2}}},
            'suite3-commit1': {data: {sha: 'suite3-commit1', parents: {length: 1}}},
            'suite3-commit2': {data: {sha: 'suite3-commit2', parents: {length: 2}}},
            'suite3-commit3': {data: {sha: 'suite3-commit3', parents: {length: 1}}},
            'suite4-commit1': {data: {sha: 'suite4-commit1', parents: {length: 1}}},
        };
        const messages: {[sha: string]: string, ...} = {};
        return {
            git: {
                /**
                 * For these tests, we're going to overload the getCommit command
                 * to retreive both commits and messages. The __testGetMessage function
                 * imported from ../main.js will prepend the commit SHAs with the text
                 * 'message'. This is because there's not really another easy existing function
                 * to hook into that can be called in main.js without throwing flow errors
                 */
                getCommit: async (params: {commit_sha: string, ...}) => {
                    if (params.commit_sha.startsWith('message')) {
                        return messages[params.commit_sha.slice('message'.length)];
                    } else {
                        return commits[params.commit_sha];
                    }
                },
            },
            repos: {
                /**
                 * This one is pretty simple. Every time we're trying to create a commit
                 * comment, just add it to the messages dictionary using the commit SHA
                 * as the key.
                 */
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
        // we're going to fake these diffs to force these commits to match a rule
        if (diffString === 'suite2-commit3...suite2-commit4') {
            return {'src/main.js': '+ this line was added'};
        } else if (diffString === 'suite3-commit1...suite3-commit2') {
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
                    before: 'suite1-commit1',
                    after: 'suite1-commit2',
                    commits: [makeTestCommit('suite1-commit2', 'test')],
                },
                actor: 'yipstanley',
            },
            testNotified: `# comment
*                   @userName

[ON PULL REQUEST] (DO NOT DELETE THIS LINE)


[ON PUSH WITHOUT PULL REQUEST] (DO NOT DELETE THIS LINE)

**/*                @yipstanley`,
        };

        await runPush(testObject);

        // check that both commits have been added and can be retrieved correctly.
        expect(await __testGetCommit('suite1-commit1')).toEqual({
            data: {sha: 'suite1-commit1', parents: {length: 1}},
        });
        expect(await __testGetCommit('suite1-commit2')).toEqual({
            data: {sha: 'suite1-commit2', parents: {length: 1}},
        });

        // check that commit1 has no message because it is not part of the push
        expect(await __testGetMessage('suite1-commit1')).toEqual(undefined);

        // check that commit2 has the correct message
        expect(await __testGetMessage('suite1-commit2')).toMatchInlineSnapshot(`
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
                    before: 'suite2-commit1',
                    after: 'suite2-commit5',
                    commits: [
                        makeTestCommit('suite2-commit2', 'First commit'),
                        makeTestCommit('suite2-commit3', 'Second commit'),
                        makeTestCommit('suite2-commit4', 'third commit'),
                        makeTestCommit('suite2-commit5', 'lastCommit'),
                    ],
                },
                actor: 'yipstanley',
            },
            testNotified: `# comment
*                   @userName

[ON PULL REQUEST] (DO NOT DELETE THIS LINE)


[ON PUSH WITHOUT PULL REQUEST] (DO NOT DELETE THIS LINE)

src/**              @yipstanley
"/^\\+/m"           @Khan/frontend-infra`,
        };

        await runPush(testObject);

        // test that commit suite2-commit4 has the correct message
        expect(await __testGetMessage('suite2-commit4')).toMatchInlineSnapshot(`
            "Notify of Push Without Pull Request

            @yipstanley for changes to \`src/main.js\`, \`src/pr-notify.js\`
            @Khan/frontend-infra for changes to \`src/main.js\`
            "
        `);
        // test that commit suite2-commit5 doesn't have a message because it is a merge commit
        expect(await __testGetMessage('suite2-commit5')).toEqual(undefined);
    });
});

describe("test that changes on a merge commit don't notify people", () => {
    it('should not make comments', async () => {
        const testObject = {
            context: {
                issue: {owner: 'Khan', repo: 'Gerald', number: 0},
                payload: {
                    pull_request: {},
                    before: 'suite3-commit1',
                    after: 'suite3-commit3',
                    commits: [
                        makeTestCommit('suite3-commit2', 'First commit'),
                        makeTestCommit('suite3-commit3', 'Second commit'),
                    ],
                },
                actor: 'yipstanley',
            },
            testNotified: `# comment
*                   @userName

[ON PULL REQUEST] (DO NOT DELETE THIS LINE)


[ON PUSH WITHOUT PULL REQUEST] (DO NOT DELETE THIS LINE)

"/^\\+/m"           @Khan/frontend-infra`,
        };

        await runPush(testObject);

        // test that commit suite3-commit1 doesn't have a message because it's not in this push
        expect(await __testGetMessage('suite3-commit1')).toEqual(undefined);
        // test that commit suite3-commit2 doesn't have a message because it is a merge commit
        // even though it has a change that matches the final rule.
        expect(await __testGetMessage('suite3-commit2')).toEqual(undefined);
        // test that commite suite3-commit3 doesn't have a message even though a commit in this
        // push changed something that matches a rule.
        expect(await __testGetMessage('suite3-commit3')).toEqual(undefined);
    });
});

describe('test that make functions make well formatted messages', () => {
    it('should format the commit message nicely', async () => {
        const peopleToFiles = {
            '@yipstanley': ['src/main.js', '.github/workflows/build.yml'],
            '@Khan/frontend-infra': ['src/main.js', '.geraldignore'],
        };

        await __makeCommitComment(peopleToFiles, 'suite4-commit1');

        expect(await __testGetMessage('suite4-commit1')).toMatchInlineSnapshot(`
            "Notify of Push Without Pull Request

            @yipstanley for changes to \`src/main.js\`, \`.github/workflows/build.yml\`
            @Khan/frontend-infra for changes to \`src/main.js\`, \`.geraldignore\`
            "
        `);
    });

    it('should format the Gerald comment body correctly', async () => {
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
