// @flow

const glob = require('glob');
const globOptions = {matchBase: true, dot: true};

// for some reason it wont let me import globAsync from ../utils ???
const globAsync = async (
    pattern: string,
    options: any,
): Promise<{res: Array<string>, cache: any}> => {
    const prom = new Promise<{res: Array<string>, cache: any}>((res, rej) => {
        const g = new glob.Glob(pattern, options, (err: ?Error, matches: Array<string>) => {
            if (err) {
                rej(err);
            } else {
                res({res: matches, cache: g.cache});
            }
        });
    });
    return prom;
};

describe('test caching glob calls', () => {
    it('should work', () => {
        const globPatterns = ['**', '*.js', 'main', 'utils', '**src/**'];
        const results: Array<string> = [];
        const start = new Date().getTime();

        for (const pattern of globPatterns) {
            results.push(...glob.sync(pattern, globOptions));
        }

        const end = new Date().getTime();
    });

    it('should work', async () => {
        const globPatterns = ['**', '*.js', 'main', 'utils', '**src/**'];
        const results2: Array<string> = [];
        const start2 = new Date().getTime();
        let cache = {};

        for (const pattern of globPatterns) {
            const retObj = await globAsync(pattern, {cache: cache, ...globOptions});
            results2.push(...retObj.res);
            cache = {...cache, ...retObj.cache};
        }

        const end2 = new Date().getTime();
    });
});
