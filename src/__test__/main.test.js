// @flow

import {__makeCommitComment, runPush, __extraPermGithub} from '../runOnPush';
import {readFileSync} from '../fs';

/* flow-uncovered-block */
// mock fs.js readFileSync so that we can provide different implementations in tests
jest.mock('../fs.js', () => ({
    readFileSync: jest.fn(),
}));

/*
 * Mock the GitHub object's commands so that they act on an internal corpus of commits and comments
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
            'suite4-commit2': {data: {sha: 'suite4-commit2', parents: {length: 1}}},
            'suite4-commit3': {data: {sha: 'suite4-commit3', parents: {length: 1}}},
            'suite5-commit1': {data: {sha: 'suite5-commit1', parents: {length: 1}}},
        };
        const comments: {[sha: string]: string, ...} = {};
        return {
            git: {
                /**
                 * For these tests, we're going to overload the getCommit command
                 * to retreive both commits and comments. The __testGetComment function
                 * imported from ../runOnPush.js will prepend the commit SHAs with the text
                 * 'comment'. This is because there's not really another easy existing function
                 * to hook into that can be called in runOnPush.js without throwing flow errors
                 */
                getCommit: async (params: {commit_sha: string, ...}) => {
                    if (params.commit_sha.startsWith('comment')) {
                        return comments[params.commit_sha.slice('comment'.length)];
                    } else {
                        return commits[params.commit_sha];
                    }
                },
            },
            repos: {
                /**
                 * This one is pretty simple. Every time we're trying to create a commit
                 * comment, just add it to the comments dictionary using the commit SHA
                 * as the key.
                 */
                createCommitComment: async (params: {commit_sha: string, body: string, ...}) => {
                    comments[params.commit_sha] = params.body;
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
            const string = `src/runOnPush.js
src/gerald.js
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
        switch (diffString) {
            case 'suite2-commit1...suite2-commit5':
            case 'suite2-commit3...suite2-commit4':
            case 'suite3-commit1...suite3-commit3':
            case 'suite4-commit1...suite4-commit3':
            case 'suite4-commit2...suite4-commit3':
                return {'src/runOnPush.js': '+ this line was added'};
            default:
                return {};
        }
    },
}));
/* end flow-uncovered-block */

/**
 * Helper function to make test commits.
 *
 * @param id - Fake commit ID.
 * @param message - Commit message
 */
const makeTestCommit = (id: string, message: string, verified: boolean = false) => {
    return {
        author: '__testAuthor',
        comment_count: -1,
        committer: '__testCommitter',
        id: id,
        message: message,
        tree: '__TESTING__',
        url: '__TESTING__',
        verification: {verified: verified},
    };
};

/**
 * Helper function to get around flow errors when mocking readFileSync
 */
const _mock = mockFn => {
    return ((mockFn: JestMockFn<any, any>): JestMockFn<any, any>);
};

const getCommit = async (commitSHA: string) => {
    return await __extraPermGithub.git.getCommit({
        owner: '__TESTING__',
        repo: '__TESTING__',
        commit_sha: commitSHA,
    });
};

const getComment = async (commitSHA: string) => {
    return await __extraPermGithub.git.getCommit({
        owner: '__TESTING__',
        repo: '__TESTING__',
        commit_sha: 'comment' + commitSHA,
    });
};

describe('test that the mock works', () => {
    it('should work', async () => {
        const context = {
            issue: {owner: '__TESTING__', repo: '__TESTING__', number: -1},
            payload: {
                pull_request: {base: {ref: '__TESTING__'}, user: {login: '__testUser'}},
                before: 'suite1-commit1',
                after: 'suite1-commit2',
                commits: [makeTestCommit('suite1-commit2', 'test')],
            },
            actor: '__testActor',
        };
        _mock(readFileSync).mockImplementation(
            () => `# comment
*                   @userName

[ON PULL REQUEST] (DO NOT DELETE THIS LINE)

[ON PUSH WITHOUT PULL REQUEST] (DO NOT DELETE THIS LINE)

**/*                @yipstanley`,
        );

        await runPush(context);

        // check that both commits have been added and can be retrieved correctly.
        expect(await getCommit('suite1-commit1')).toEqual({
            data: {sha: 'suite1-commit1', parents: {length: 1}},
        });
        expect(await getCommit('suite1-commit2')).toEqual({
            data: {sha: 'suite1-commit2', parents: {length: 1}},
        });

        // check that commit1 has no comments because it is not part of the push
        expect(await getComment('suite1-commit1')).toEqual(undefined);

        // check that commit2 has the correct comment
        expect(await getComment('suite1-commit2')).toMatchInlineSnapshot(`
            "Notify of Push Without Pull Request

            @yipstanley for changes to \`src/gerald.js\`, \`src/runOnPush.js\`, \`.github/workflows/build.yml\`
            "
        `);
    });
});

describe('test simple working case', () => {
    it('should work', async () => {
        const context = {
            issue: {owner: '__TESTING__', repo: '__TESTING__', number: -1},
            payload: {
                pull_request: {base: {ref: '__TESTING__'}, user: {login: '__testUser'}},
                before: 'suite2-commit1',
                after: 'suite2-commit5',
                commits: [
                    makeTestCommit('suite2-commit2', 'First commit'),
                    makeTestCommit('suite2-commit3', 'Second commit'),
                    makeTestCommit('suite2-commit4', 'third commit'),
                    makeTestCommit('suite2-commit5', 'lastCommit'),
                ],
            },
            actor: '__testActor',
        };
        _mock(readFileSync).mockImplementation(
            () => `# comment
*                   @userName

[ON PULL REQUEST] (DO NOT DELETE THIS LINE)

[ON PUSH WITHOUT PULL REQUEST] (DO NOT DELETE THIS LINE)

src/**              @yipstanley
"/^\\+/m"           @Khan/frontend-infra`,
        );

        await runPush(context);

        // test that commit suite2-commit4 has the correct comment
        expect(await getComment('suite2-commit4')).toMatchInlineSnapshot(`
            "Notify of Push Without Pull Request

            @yipstanley for changes to \`src/gerald.js\`, \`src/runOnPush.js\`
            @Khan/frontend-infra for changes to \`src/runOnPush.js\`
            "
        `);
        // test that commit suite2-commit5 doesn't have a comment because it is a merge commit
        expect(await getComment('suite2-commit5')).toEqual(undefined);
    });
});

describe("test that changes on a merge commit don't notify people", () => {
    it('should not make comments', async () => {
        const context = {
            issue: {owner: '__TESTING__', repo: '__TESTING__', number: -1},
            payload: {
                pull_request: {base: {ref: '__TESTING__'}, user: {login: '__testUser'}},
                before: 'suite3-commit1',
                after: 'suite3-commit3',
                commits: [
                    makeTestCommit('suite3-commit2', 'First commit'),
                    makeTestCommit('suite3-commit3', 'Second commit'),
                ],
            },
            actor: '__testActor',
        };
        _mock(readFileSync).mockImplementation(
            () => `# comment
*                   @userName

[ON PULL REQUEST] (DO NOT DELETE THIS LINE)

[ON PUSH WITHOUT PULL REQUEST] (DO NOT DELETE THIS LINE)

"/^\\+/m"           @Khan/frontend-infra`,
        );

        await runPush(context);

        // test that commit suite3-commit1 doesn't have a comment because it's not in this push
        expect(await getComment('suite3-commit1')).toEqual(undefined);
        // test that commit suite3-commit2 doesn't have a comment because it is a merge commit
        // even though it has a change that matches the final rule.
        expect(await getComment('suite3-commit2')).toEqual(undefined);
        // test that commite suite3-commit3 doesn't have a comment even though a commit in this
        // push changed something that matches a rule.
        expect(await getComment('suite3-commit3')).toEqual(undefined);
    });
});

describe('test that changes to verified commits dont notify people', () => {
    it('should not make comments', async () => {
        const context = {
            issue: {owner: '__TESTING__', repo: '__TESTING__', number: -1},
            payload: {
                pull_request: {base: {ref: '__TESTING__'}, user: {login: '__testUser'}},
                before: 'suite4-commit1',
                after: 'suite4-commit3',
                commits: [
                    makeTestCommit('suite4-commit2', 'First commit', true),
                    makeTestCommit('suite4-commit3', 'Second commit', true),
                ],
            },
            actor: '__testActor',
        };
        _mock(readFileSync).mockImplementation(
            () => `# comment
*                   @userName

[ON PULL REQUEST] (DO NOT DELETE THIS LINE)

[ON PUSH WITHOUT PULL REQUEST] (DO NOT DELETE THIS LINE)

"/^\\+/m"           @Khan/frontend-infra`,
        );

        await runPush(context);

        // test that commit suite4-commit1 doesn't have a comment because it's not in this push
        expect(await getComment('suite4-commit1')).toEqual(undefined);
        // test that commit suite4-commit2 doesn't have a comment because it is verified
        // even though it has a change that matches the final rule.
        expect(await getComment('suite4-commit2')).toEqual(undefined);
        // test that commite suite4-commit3 doesn't have a comment even though a commit in this
        // push changed something that matches a rule.
        expect(await getComment('suite4-commit3')).toEqual(undefined);
    });
});

describe('test that makeCommitComment makes well formatted strings', () => {
    it('should format the commit comment nicely', async () => {
        const peopleToFiles = {
            '@yipstanley': ['src/runOnPush.js', '.github/workflows/build.yml'],
            '@Khan/frontend-infra': ['src/runOnPush.js', '.geraldignore'],
        };

        await __makeCommitComment(peopleToFiles, 'suite5-commit1');

        expect(await getComment('suite5-commit1')).toMatchInlineSnapshot(`
            "Notify of Push Without Pull Request

            @yipstanley for changes to \`src/runOnPush.js\`, \`.github/workflows/build.yml\`
            @Khan/frontend-infra for changes to \`src/runOnPush.js\`, \`.geraldignore\`
            "
        `);
    });
});
