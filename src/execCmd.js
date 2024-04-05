// @flow

const exec = require('@actions/exec'); //flow-uncovered-line

/**
 * @desc Asynchronously calls @actions/exec to execute a command.
 * @param cmd - The command that we are calling.
 * @param args - List of arguments to call with the command.
 * @throws if the command errors.
 */
export const execCmd = async (cmd: string, args: string[]): Promise<string> => {
    let output = '';
    let error = '';
    const options = {};
    /* flow-uncovered-block */
    options.listeners = {
        stdout: data => {
            output += data.toString();
        },
        stderr: data => {
            error += data.toString();
        },
        // This can be quite large in some cases, so we don't want to print it out.
        silent: true,
    };
    await exec.exec(cmd, args, options);
    if (error) {
        throw error;
    }
    /* end flow-uncovered-block */
    return output;
};
