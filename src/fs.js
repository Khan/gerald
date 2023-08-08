// @flow

import fs from 'fs';

/**
 * @desc Wrapper around fs.readFileSync so that we can mock readFileSync to return
 * different values for different tests.
 */
export const readFileSync = (
    path: string | number | Buffer | URL,
    options:
        | 'utf-8'
        | {
              encoding: string,
              flag?: string,
          }
        | 'ascii'
        | 'utf8'
        | 'utf16le'
        | 'ucs2'
        | 'ucs-2'
        | 'base64'
        | 'latin1'
        | 'binary'
        | 'hex',
) => {
    try {
        return fs.readFileSync(path, options);
    } catch (e) {
        console.error("Error reading file:", path);
        return "";
    }
};
