// @flow
import prompts from 'prompts';
import chalk from 'chalk';

export const bail = (message: string = 'Aborting') => {
    console.error(chalk.red(message));
    process.exit(1);
};

export const maybeBail = async (message: string) => {
    console.error(message);
    const response = await confirm({message: 'Continue?'});
    if (!response) {
        console.error('Aborting');
        process.exit(1);
    }
};

export const gotIt = async (message: string) => {
    console.log(message);
    await prompts({type: 'text', name: 'ignored', message: 'Got it!'});
};

export function prom<T>(fn: ((err: ?Error, value: T) => void) => mixed): Promise<T> {
    return new Promise((res, rej) => fn((err, value) => (err ? rej(err) : res(value))));
}

export const confirm = async ({message, pre}: {message: string, pre?: string}) => {
    if (pre) {
        console.error(pre);
    }
    const response: {continue: boolean} = await prompts({
        type: 'confirm',
        name: 'continue',
        message,
    });
    return response.continue;
};

/**
 * Returns a string with newlines at column 80
 * @param string
 * @returns {string}
 */
export const wrap80 = (string: string): string => {
    return string.replace(/(.{1,80})( +|$\n?)|(.{1,80})/gm, '$1$3\n');
};
