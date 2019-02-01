const fs = require('fs');
const { promisify } = require('util');
const path = require('path');
const getSize = promisify(require('get-folder-size'));
const process = require('process');

async function printStats(lastCount, lastCountChange) {
    const objectDir = 'data/objects';
    const files = await promisify(fs.readdir)(objectDir);

    let mergedIndex = [];

    for (const file of files) {
        const subdir = path.join(objectDir, file);
        if (!(await promisify(fs.stat)(subdir)).isDirectory()) {
            continue;
        }

        const indexFile = path.join(subdir, 'index.json');

        if (!fs.existsSync(indexFile)) {
            continue;
        }

        const contents = await promisify(fs.readFile)(indexFile);

        mergedIndex = [...mergedIndex, ...JSON.parse(contents)];
    }

    const size = await getSize(objectDir);

    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    let message = `${mergedIndex.length} images downloaded (${(size/1024/1024).toFixed(1)} MB`;
    if (lastCountChange) {
        if (mergedIndex.length !== lastCount) {
            lastCountChange = Date.now();
        }

        message += `, last new images ${((Date.now() - lastCountChange)/1000).toFixed()}s ago`;
    }
    message += ')';
    process.stdout.write(message);

    return mergedIndex.length;
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