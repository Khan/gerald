const exec = require('@actions/exec');

const execCmd = async (cmd, args) => {
    let output = '';
    let error = '';
    const options = {};
    options.listeners = {
        stdout: data => {
            output += data.toString();
        },
        stderr: data => {
            error += data.toString();
        },
    };
    await exec.exec(cmd, args, options);
    if (error) {
        throw error;
    }
    return output;
};

module.exports = {execCmd};
