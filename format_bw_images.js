const fs = require('fs');
const { promisify } = require('util');
const path = require('path');
const mkdirp = promisify(require('mkdirp'));
const { decolourizeAll } = require('./decolourize_images');

async function copyDirectory(dir, colourDir, bwDir) {
    const files = await promisify(fs.readdir)(dir);

    let count = 0;

    for (const file of files) {
        let outputDir;

        if (/image-\d+-bw\.jpeg/.test(file)) {
            outputDir = bwDir;
        } else if (/image-\d+\.jpeg/.test(file)) {
            outputDir = colourDir;
        }

        if (!outputDir) {
            continue;
        }

        const outputPath = path.join(outputDir, `${dir.split('/').pop()}-${file.match(/\d+/)[0]}.jpeg`);

        await promisify(fs.copyFile)(path.join(dir, file), outputPath);
        count ++;
    }

    return count;
}

async function formatImages() {
    const startTime = Date.now();

    await decolourizeAll();

    const objectDir = 'data/objects';
    const colourDir = 'data/formatted/colour';
    const bwDir = 'data/formatted/bw';

    await mkdirp(colourDir);
    await mkdirp(bwDir);

    const files = await promisify(fs.readdir)(objectDir);

    let totalCount = 0;

    for (const file of files) {
        const subdir = path.join(objectDir, file);
        if (!(await promisify(fs.stat)(subdir)).isDirectory()) {
            continue;
        }

        totalCount += await copyDirectory(subdir, colourDir, bwDir);
        const speed = 1000*totalCount/(Date.now() - startTime);
        console.log(`${totalCount} complete (just processed ${subdir}; speed ${speed.toFixed(1)}/s)`);
    }

    const elapsed = Date.now() - startTime;
    console.log(`Finished ${totalCount} in ${(elapsed/1000).toFixed(1)}s`)
}

formatImages();