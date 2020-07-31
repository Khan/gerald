// @flow

import {__makeCommitComment, __testGetCommit, __testGetMessage, runPush} from '../main';
import {
    type Octokit,
    type Octokit$IssuesListCommentsResponseItem,
    type Octokit$GitGetCommitResponse,
    type Octokit$PullsListCommitsResponseItemCommit,
} from '@octokit/rest';

const octokit = require('@actions/github');

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
jest.mock('@actions/github', () => ({
    ...jest.requireActual('@actions/github'),
    GitHub: (auth: string) => {
        const commits: {[sha: string]: {data: {sha: string, parents: {length: number}}}, ...} = {
            '0': {data: {sha: '0', parents: {length: 1}}},
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
                    console.log(params.body);
                },
            },
        };
    },
}));

jest.mock('../execCmd.js', () => ({
    ...jest.requireActual('../execCmd.js'),
    execCmd: async (cmd: string, args: string[]) => {
        return await new Promise((res, rej) => {
            const string = `src/main.js`;
            process.nextTick(() => res(string));
        });
    },
}));
/* end flow-uncovered-block */

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

            @yipstanley for changes to \`src/main.js\`
            "
        `);
    });
});
