    getCorrectSection,
*                   @userName

[ON PULL REQUEST] (DO NOT DELETE THIS LINE)

[ON PUSH WITHOUT PULL REQUEST] (DO NOT DELETE THIS LINE)
*                   @userName

[ON PULL REQUEST] (DO NOT DELETE THIS LINE)

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

[ON PULL REQUEST] (DO NOT DELETE THIS LINE)

*.js                @yipstanley! @githubUser @Org/Slug-name
[ON PUSH WITHOUT PULL REQUEST] (DO NOT DELETE THIS LINE)`;
        const {actualReviewers, teamReviewers} = getFilteredLists(
            reviewers,
            requiredReviewers,
            notified,
            ['yipstanley', 'testperson'],
        );
        expect(teamReviewers).toEqual(expect.arrayContaining(['Slug-name']));
        const gerald = {
            body: `# Gerald:

            ## Notified:

            ## Reviewers:

            ## Required reviewers:`,
                gerald,
                {
                    user: {login: 'github-actions[bot]'},
                    body: 'Required Reviewers:\n\n:',
                },
                {user: {login: 'github-actions[bot]'}, body: 'Reviewers:\n\n:'},
        const {megaComment, removedJustNames} = parseExistingComments(existingComments);
        expect(megaComment).toEqual(megaComment);