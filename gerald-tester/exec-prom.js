// @flow
/**
 * A simple promisified version of child_process.exec, so we can `await` it
 */
import {exec} from 'child_process';

const bufferToString = (input: Buffer | string): string => {
    if (typeof input === 'string') {
        return input;
    } else {
        return input.toString('utf8');
    }
};

const execProm = (
    command: string,
    {rejectOnError, ...options}: {rejectOnError: boolean, ...} = {},
): Promise<{err: ?Error, stdout: string, stderr: string}> =>
    new Promise((res, rej) =>
        exec(
            command,
            // $FlowFixMe
            options,
            (err, stdout, stderr) =>
                err
                    ? rejectOnError
                        ? rej(err)
                        : res({
                              err,
                              stdout: bufferToString(stdout),
                              stderr: bufferToString(stderr),
                          })
                    : res({
                          err: null,
                          stdout: bufferToString(stdout),
                          stderr: bufferToString(stderr),
                      }),
        ),
    );

export default execProm;
