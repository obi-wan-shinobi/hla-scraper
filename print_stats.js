const fs = require('fs');
const { promisify } = require('util');
const path = require('path');
const getSize = promisify(require('get-folder-size'));
const process = require('process');

const MAX_TIME = 20*60*1000; // after too many minutes of no new images, beep angrily

const countCache = new Map();
const sizeCache = new Map();

async function printStats(lastCount, lastCountChange) {
    const startTime = Date.now();
    const objectDir = 'data/objects';
    const files = await promisify(fs.readdir)(objectDir);

    let count = 0;
    let size = 0;

    for (const file of files) {
        const subdir = path.join(objectDir, file);
        if (!(await promisify(fs.stat)(subdir)).isDirectory()) {
            continue;
        }

        const indexFile = path.join(subdir, 'index.json');
        const indexExists = fs.existsSync(indexFile);

        (async () => {
            if (countCache.has(indexFile)) {
                count += countCache.get(indexFile);
                return;
            }

            if (!indexExists) {
                return;
            }

            const contents = await promisify(fs.readFile)(indexFile);
            const index = JSON.parse(contents);

            countCache.set(indexFile, index.length);

            count += index.length;
        })();

        (async () => {
            if (!indexExists) { // ignore incomplete ones
                return;
            }

            if (sizeCache.has(subdir)) {
                size += sizeCache.get(subdir);
                return;
            }

            const partialSize = await getSize(subdir);

            sizeCache.set(subdir, partialSize);
            size += partialSize;
        })();
    }

    const elapsed = Date.now() - startTime;

    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    let message = `${count} images downloaded (${(size/1024/1024).toFixed(1)} MB`;
    if (lastCountChange) {
        if (count !== lastCount) {
            lastCountChange = Date.now();
        }

        const since = Date.now() - lastCountChange;
        if (since > MAX_TIME) {
            process.stdout.write('\007');
        }

        message += `, last new images ${(since/1000).toFixed()}s ago`;
    }
    message += `; ${elapsed.toFixed()}ms query)`;
    process.stdout.write(message);

    return count;
}

if (process.argv.length >= 3 && process.argv[2] === '-t') {
    let lastCount = null;
    let lastCountChange = null;

    setInterval(async () => {
        const count = await printStats(lastCount, lastCountChange);

        if (count !== lastCount) {
            lastCount = count;
            lastCountChange = new Date();
        }
    }, 1000);
} else {
    printStats();
}