    __filterIgnoreFiles,

describe('test that ignore files are parsed correctly', () => {
    it('should work', () => {
        const testIgnoreFile = `src
.bashrc
.github`;

        const ignoredFiles = __filterIgnoreFiles(testIgnoreFile);

        expect(ignoredFiles.length).toEqual(3);
        expect(ignoredFiles).toEqual(['src', '.bashrc', '.github']);
    });

    it('should ignore new lines', () => {
        const testIgnoreFile = `src

.bashrc

.github`;

        const ignoredFiles = __filterIgnoreFiles(testIgnoreFile);

        expect(ignoredFiles.length).toEqual(3);
        expect(ignoredFiles).toEqual(['src', '.bashrc', '.github']);
    });

    it('should ignore comments', () => {
        const testIgnoreFile = `src
.bashrc
.github
# don't read this line!`;

        const ignoredFiles = __filterIgnoreFiles(testIgnoreFile);

        expect(ignoredFiles.length).toEqual(3);
        expect(ignoredFiles).toEqual(['src', '.bashrc', '.github']);
    });

    it('should ignore the comment part of a line, but not before the comment', () => {
        const testIgnoreFile = `src
.bashrc
.github # read .github, but not this part of it!
# don't read this line!`;

        const ignoredFiles = __filterIgnoreFiles(testIgnoreFile);

        expect(ignoredFiles.length).toEqual(3);
        expect(ignoredFiles).toEqual(['src', '.bashrc', '.github']);
    });

    it('should ignore weird spacing problems', () => {
        const testIgnoreFile = `src
    .bashrc
.github    `;

        const ignoredFiles = __filterIgnoreFiles(testIgnoreFile);

        expect(ignoredFiles.length).toEqual(3);
        expect(ignoredFiles).toEqual(['src', '.bashrc', '.github']);
    });
});