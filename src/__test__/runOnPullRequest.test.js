// @flow

import {__makeSummarySection, __writeJobSummary} from '../runOnPullRequest';

/* flow-uncovered-block */
const mockWrite = jest.fn().mockResolvedValue(undefined);
const mockAddRaw = jest.fn().mockReturnValue({write: mockWrite});
const mockAddHeading = jest.fn().mockReturnValue({addRaw: mockAddRaw, write: mockWrite});

jest.mock('@actions/core', () => ({
    summary: {
        addHeading: (...args) => mockAddHeading(...args),
        addRaw: (...args) => mockAddRaw(...args),
        write: () => mockWrite(),
    },
}));

jest.mock('../setup', () => ({
    ownerAndRepo: {owner: '__TESTING__', repo: '__TESTING__'},
    context: {
        issue: {owner: '__TESTING__', repo: '__TESTING__', number: -1},
        payload: {
            pull_request: {base: {ref: '__TESTING__'}, user: {login: '__testUser'}},
        },
    },
    extraPermGithub: {},
}));
/* end flow-uncovered-block */

describe('makeSummarySection', () => {
    it('should return empty string for empty input', () => {
        const result = __makeSummarySection({}, 'Reviewers');
        expect(result).toBe('');
    });

    it('should format a single reviewer correctly', () => {
        const peopleToLabelToFiles = {
            '@yipstanley': {
                '': ['src/runOnPush.js', '.github/workflows/build.yml'],
            },
        };

        const result = __makeSummarySection(peopleToLabelToFiles, 'Reviewers');

        expect(result).toMatchInlineSnapshot(`
            "### Reviewers

            * \`@yipstanley\` for changes to \`src/runOnPush.js\`, \`.github/workflows/build.yml\`

            "
        `);
    });

    it('should format multiple reviewers with labels correctly', () => {
        const peopleToLabelToFiles = {
            '@yipstanley': {
                '': ['src/runOnPush.js', '.github/workflows/build.yml'],
                typechanges: ['flow-typed/npm/@octokit/rest_vx.x.x.js'],
            },
            '@Khan/frontend-infra': {
                '': ['src/runOnPush.js', '.geraldignore'],
            },
        };

        const result = __makeSummarySection(peopleToLabelToFiles, 'Reviewers');

        expect(result).toMatchInlineSnapshot(`
            "### Reviewers

            * \`@yipstanley\` for changes to \`src/runOnPush.js\`, \`.github/workflows/build.yml\`
            * \`@yipstanley\` for changes to \`flow-typed/npm/@octokit/rest_vx.x.x.js\` (typechanges)
            * \`@Khan/frontend-infra\` for changes to \`src/runOnPush.js\`, \`.geraldignore\`

            "
        `);
    });

    it('should work with different headers', () => {
        const peopleToLabelToFiles = {
            '@testuser': {'': ['file.js']},
        };

        const notifiedResult = __makeSummarySection(peopleToLabelToFiles, 'Notified');
        expect(notifiedResult).toContain('### Notified');

        const requiredResult = __makeSummarySection(peopleToLabelToFiles, 'Required Reviewers');
        expect(requiredResult).toContain('### Required Reviewers');
    });
});

describe('writeJobSummary', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should write empty message when no reviewers or notifyees', async () => {
        await __writeJobSummary({}, {}, {});

        expect(mockAddHeading).toHaveBeenCalledWith('Gerald', 1);
        expect(mockAddRaw).toHaveBeenCalledWith(
            'No reviewers or notifyees matched for this pull request.',
        );
        expect(mockWrite).toHaveBeenCalled();
    });

    it('should write summary with notifyees only', async () => {
        const notifyees = {
            '@testuser': {'': ['file.js']},
        };

        await __writeJobSummary(notifyees, {}, {});

        expect(mockAddHeading).toHaveBeenCalledWith('Gerald', 1);
        expect(mockAddRaw).toHaveBeenCalledWith(expect.stringContaining('### Notified'));
        expect(mockAddRaw).toHaveBeenCalledWith(expect.stringContaining('@testuser'));
        expect(mockWrite).toHaveBeenCalled();
    });

    it('should write summary with reviewers only', async () => {
        const reviewers = {
            '@reviewer': {'': ['src/file.js']},
        };

        await __writeJobSummary({}, reviewers, {});

        expect(mockAddHeading).toHaveBeenCalledWith('Gerald', 1);
        expect(mockAddRaw).toHaveBeenCalledWith(expect.stringContaining('### Reviewers'));
        expect(mockAddRaw).toHaveBeenCalledWith(expect.stringContaining('@reviewer'));
        expect(mockWrite).toHaveBeenCalled();
    });

    it('should write summary with required reviewers only', async () => {
        const requiredReviewers = {
            '@requiredreviewer': {'': ['critical/file.js']},
        };

        await __writeJobSummary({}, {}, requiredReviewers);

        expect(mockAddHeading).toHaveBeenCalledWith('Gerald', 1);
        expect(mockAddRaw).toHaveBeenCalledWith(expect.stringContaining('### Required Reviewers'));
        expect(mockAddRaw).toHaveBeenCalledWith(expect.stringContaining('@requiredreviewer'));
        expect(mockWrite).toHaveBeenCalled();
    });

    it('should write summary with all sections', async () => {
        const notifyees = {'@notified': {'': ['docs/readme.md']}};
        const reviewers = {'@reviewer': {'': ['src/file.js']}};
        const requiredReviewers = {'@required': {'': ['critical/file.js']}};

        await __writeJobSummary(notifyees, reviewers, requiredReviewers);

        expect(mockAddHeading).toHaveBeenCalledWith('Gerald', 1);
        const summaryContent = mockAddRaw.mock.calls[0][0];
        expect(summaryContent).toContain('### Notified');
        expect(summaryContent).toContain('### Reviewers');
        expect(summaryContent).toContain('### Required Reviewers');
        expect(summaryContent).toContain('@notified');
        expect(summaryContent).toContain('@reviewer');
        expect(summaryContent).toContain('@required');
        expect(mockWrite).toHaveBeenCalled();
    });
});
