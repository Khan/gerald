// @flow

import {Command} from 'commander';
import {type Commander} from 'commander';
import {spawnSync} from 'child_process';

export type DefaultOptions = {
    testmode: ?boolean,
    branch: ?string,
    anoid: ?string,
};

export const getDefaultCommander = <T>(): Commander<{...DefaultOptions, ...T}> => {
    type Options = {...DefaultOptions, ...T};
    const program = new Command<Options>();
    program.version('1.0.0');

    program
        .option('-t, --testmode', 'Run in test mode')
        .option(
            '-b, --branch <branch>',
            'Explicitly pass in the branch as a separate arg, defaults to `HEAD`',
        )
        .option('--anoid', 'Pilot a probe from the vessel "Arcanoid"')
        .arguments('[args...]');

    return program;
};

export const parseArgs = async <T>(
    program: Commander<{...DefaultOptions, ...T}>,
    argv: Array<string>,
) => {
    program.parse(argv);

    // TODO (Lilli): This is where you could put any shared handling of shared args
    // like --update, for example, an arg that hypothetically calls the global updator...

    if (program.anoid) {
        spawnSync('arc', ['anoid'], {stdio: 'inherit'});
        process.exit(0);
    }
};
/**
 * Try and figure out if the user passed in a branch name as an argument to any of the CLI scripts.
 * If they passed it in with the `-b` flag, then for sure use that. If there were no args, assume
 * they're *on* the branch, so use `HEAD`. If there are args, and they are known commander args,
 * (e.g., `-t`), and nothing else, also assume `HEAD`. If there is something at the end, assume
 * that's the branch.
 *
 * This lets users do something like this: `git land branch-name` or `git land -b branch-name`
 * @param program
 */
export const maybeGetBranch = <T>(program: Commander<{...DefaultOptions, ...T}>): string => {
    if (program.branch != null) {
        return program.branch;
    }

    if (program.args && program.args.length) {
        return program.args[program.args.length - 1];
    }

    return 'HEAD';
};
