// @flow
import fg from 'fast-glob'; // flow-uncovered-line
import {prompts} from 'prompts';
import chalk from 'chalk';
import fs from 'fs';

import execProm from './exec-prom';
import {confirm, maybeBail, bail} from './utils';
import {getDefaultCommander, parseArgs} from './arg-helper';

/**
 * @desc Read ./.geraldignore and ./.gitignore if they exist.
 * Split the files by newlines to serve as the list of files/directories to
 * ignore for Gerald. Be sure to ignore empty lines and comments (otherwise fast-glob
 * will throw Type errors).
 */
const getGeraldIgnore = (): Array<string> => {
    const ignore = [];
    if (fs.existsSync('.geraldignore')) {
        ignore.push(
            ...fs
                .readFileSync('.geraldignore', 'utf-8')
                .split('\n')
                .filter(Boolean)
                .filter(line => !line.startsWith('#')),
        );
    }
    if (fs.existsSync('.gitignore')) {
        ignore.push(
            ...fs
                .readFileSync('.gitignore', 'utf-8')
                .split('\n')
                .filter(Boolean)
                .filter(line => !line.startsWith('#'))
                .filter(line => !ignore.includes(line)),
        );
    }

    return ignore;
};

const geraldIgnore = getGeraldIgnore();

const globOptions = {
    ignore: geraldIgnore,
    dot: true,
};

/**
 * @desc Asks for a regex pattern from the command line. If the input cannot be
 * interpreted as a regex pattern, it will ask again.
 */
const askForRegex = async () => {
    const input = await prompts.text({
        message: 'Enter in a Regular Expression:',
        style: 'default',
    });
    const regexFromInput = /^\/(.*?)\/([a-z]*)$/.exec(input);
    if (!regexFromInput) {
        await maybeBail('Invalid Regular Expression');
        return await askForRegex();
    } else {
        const [_, regexPattern, regexFlags] = regexFromInput;
        return new RegExp(regexPattern, regexFlags);
    }
};

const askForFile = async () => {
    const input = await prompts.text({
        message: 'Enter in a file path',
        style: 'default',
    });
    const fileExists = fs.existsSync(input);
    if (fileExists) {
        return {fileContents: fs.readFileSync(input, 'utf-8'), fileName: input};
    } else {
        await maybeBail(`${input} does not lead to a file`);
        return await askForFile();
    }
};

const confirmCwd = async () => {
    const {stdout: gitDir} = await execProm('git rev-parse --show-toplevel');
    console.log(
        `${chalk.bold('Here is your current git root directory:')}\n\n${chalk.underline(gitDir)}`,
    );
    await confirm({
        message: chalk.bold('Continue with this directory as your root for the glob search?'),
    });
};

const highlightAndMaybePrint = async (string: string, regexPattern: RegExp, fileName: string) => {
    const match = string.match(regexPattern);
    if (match) {
        // highlight all of the matches in yellow
        const highlightedDiff = string.replace(regexPattern, (subStr: string) =>
            chalk.black.bgYellow(subStr),
        );
        const seeDiff = await confirm({
            message: chalk.bold(
                `${chalk.black.bgYellow(regexPattern.toString())} matches in ${chalk.red(
                    fileName.toString(),
                )}. Would you like to see the matches?`,
            ),
        });
        if (seeDiff) {
            console.log(highlightedDiff);
        }
    }
};

const testAgainstRegex = async () => {
    const useGitStateObject = {
        type: 'toggle',
        name: 'toggleQuestion',
        message:
            'Do you want to test your pattern against the current Git state or against the contents of a file?\n',
        initial: false,
        active: 'Current Git State',
        inactive: 'Contents of a File',
    };
    const useGitState = await prompts.toggle(useGitStateObject);

    const regexPattern = await askForRegex();
    if (!regexPattern) {
        // pattern is never null... it's only for us to get around type errors
        return;
    }

    if (useGitState) {
        const {stdout: rawDiff} = await execProm('git diff');
        // git diff will return a single string with the text "diff --git" splitting each files' diff
        const diffByFiles = rawDiff.split(/^diff --git /m);

        for (const fileDiff of diffByFiles) {
            // the next thing after "diff --git" is "a/<fileName> b/<fileName>"
            const fileName = fileDiff.match(/(?<=^a\/)\S*/);
            if (!fileName) {
                continue;
            }

            await highlightAndMaybePrint(fileDiff, regexPattern, fileName[0]);
        }
    } else {
        const res = await askForFile();
        if (!res) {
            throw new Error('This should be impossible to get to!');
        }

        await highlightAndMaybePrint(res.fileContents, regexPattern, res.fileName);
    }
    await maybeBail(chalk.bold('No more matches to show. Test another Regular Expression?'));
    await testAgainstRegex();
};

const testAgainstGlob = async () => {
    const useGitStateObject = {
        type: 'toggle',
        name: 'toggleQuestion',
        message:
            'Do you want to test your pattern against the current Git state or the current working directory?\n',
        initial: false,
        active: 'Current Git State',
        inactive: 'Current Git Root Directory',
    };
    const useGitState = await prompts.toggle(useGitStateObject);

    // Confirm that they want to use the current working directory as the root of the glob search.
    if (!useGitState) {
        await confirmCwd();
    }

    const globPattern = await prompts.text({
        message: 'Enter in a Glob pattern:',
        style: 'default',
    });
    const filesMatched: Array<string> = await fg(globPattern, globOptions); // flow-uncovered-line
    let filesToPrint: Array<string> = filesMatched;

    // If we're using the git state, filter out any files that aren't in the git state.
    if (useGitState) {
        const {stdout: rawDiff} = await execProm('git diff --name-only');
        const filesChanged = rawDiff.split('\n').filter(Boolean);
        filesToPrint = filesChanged.filter(file => filesMatched.includes(file));
    }

    console.log(
        chalk.bold(
            `Here are all the files in the current ${
                useGitState ? 'Git state' : 'working directory'
            } that match ${chalk.underline(globPattern)}:`,
        ),
    );
    console.log(filesToPrint.join('\n'));
    await maybeBail(chalk.bold('No more matches to show. Test another Glob pattern?'));
    await testAgainstGlob();
};

const run = async () => {
    type Options = {
        regex: ?boolean,
        glob: ?boolean,
    };

    const program = getDefaultCommander<Options>();
    program.option('--regex', 'Use this flag to test the current git state against a RegExp.');
    program.option('--glob', 'Use this flag to test the current git state against a glob pattern.');
    await parseArgs(program, process.argv);

    if (program.regex && program.glob) {
        bail('Only pass in one pattern flag at a time.');
    }

    if (program.regex) {
        await testAgainstRegex();
    } else if (program.glob) {
        await testAgainstGlob();
    } else {
        bail(
            'Please provide a pattern flag. Use --glob or --regex to test against a glob or regex pattern, respectively.',
        );
    }
};

/* flow-uncovered-block */
run().catch(err => {
    console.error(err);
    process.exit(1);
});
/* end flow-uncovered-block */
