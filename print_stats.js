const fs = require('fs');
const { promisify } = require('util');
const path = require('path');
const getSize = promisify(require('get-folder-size'));

async function printStats() {
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

    console.log(`There are ${mergedIndex.length} images downloaded`);

    const size = await getSize(objectDir);
    console.log(`Size: ${(size/1024/1024).toFixed(1)} MB`);
}

printStats();