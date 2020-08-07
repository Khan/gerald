// @flow

import {__makeNewComment} from '../runOnComment';

/* flow-uncovered-block */
jest.mock('../setup.js', () => ({
    extraPermGithub: {
        issues: {
            updateComment: jest.fn(),
            deleteComment: jest.fn(),
            listComments: async any => {
                return [];
            },
        },
    },
    context: {issue: {number: -1}},
    ownerAndRepo: {owner: '__TESTING__', repo: '__TESTING__'},
}));
/* end flow-uncovered-block */

describe('test that comment is parsed and changed appropriately', () => {
    it('should work', () => {
        const existingCommentBody = `## Gerald:

### Reviewers:
@owner1 for change to \`.github/NOTIFIED\`

@yipstanley for changes to \`.github/NOTIFIED\`, \`dist/index.js\`, \`.github/workflows/test.yml\`

@Khan/frontend-infra for changes to \`.github/NOTIFIED\``;

        const newComment = __makeNewComment(existingCommentBody, ['yipstanley']);

        expect(newComment).toMatchInlineSnapshot(`
            "## Gerald:

            ### Reviewers:
            @owner1 for change to \`.github/NOTIFIED\`

            @Khan/frontend-infra for changes to \`.github/NOTIFIED\`"
        `);
    });

    it('should stay the same', () => {
        const existingCommentBody = `## Gerald:

### Reviewers:
@yipstanley for changes to \`.github/NOTIFIED\`, \`dist/index.js\`, \`.github/workflows/test.yml\`

@Khan/frontend-infra for changes to \`.github/NOTIFIED\``;

        const newComment = __makeNewComment(existingCommentBody, ['owner1']);

        expect(newComment).toMatchInlineSnapshot(`
            "## Gerald:

            ### Reviewers:
            @yipstanley for changes to \`.github/NOTIFIED\`, \`dist/index.js\`, \`.github/workflows/test.yml\`

            @Khan/frontend-infra for changes to \`.github/NOTIFIED\`"
        `);
    });

    it('should be empty', () => {
        const existingCommentBody = `## Gerald:

### Reviewers:
@yipstanley for changes to \`.github/NOTIFIED\`, \`dist/index.js\`, \`.github/workflows/test.yml\`

@owner1 for changes to \`.github/NOTIFIED\`
`;

        const newComment = __makeNewComment(existingCommentBody, ['owner1', 'yipstanley']);

        expect(newComment).toMatchInlineSnapshot(`
            "## Gerald:

            ### Reviewers:"
        `);
    });

    it('should catch all instances', () => {
        const existingCommentBody = `## Gerald:

### Notified:
@yipstanley for changes to \`.github/NOTIFIED\`, \`dist/index.js\`, \`.github/workflows/test.yml\`

@owner1 for changes to \`.github/NOTIFIED\`

@owner2 for changes to \`.github/NOTIFIED\', \'dist/index.js\'

### Reviewers:
@owner2 for changes to \`.github/NOTIFIED\', \'dist/index.js\'

@yipstanley for changes to \`.github/NOTIFIED\`, \`dist/index.js\`, \`.github/workflows/test.yml\`

@owner1 for changes to \`.github/NOTIFIED\`
`;

        const newComment = __makeNewComment(existingCommentBody, ['owner1', 'yipstanley']);

        expect(newComment).toMatchInlineSnapshot(`
            "## Gerald:

            ### Notified:
            @owner2 for changes to \`.github/NOTIFIED', 'dist/index.js'

            ### Reviewers:
            @owner2 for changes to \`.github/NOTIFIED', 'dist/index.js'
            "
        `);
    });
});
