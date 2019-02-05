const fs = require('fs');
const { promisify } = require('util');
const path = require('path');
const sharp = require('sharp');

function outputFile(inputFile) {
    return inputFile.replace(/image-\d+/, (originalName) => {
        return originalName + '-bw';
    });
}

function decolourizeImage(imageFile) {
    return sharp(imageFile)
        .greyscale()
        .toFile(outputFile(imageFile))
        .catch((error) => {
            console.log('Error in', imageFile);
            throw error;
        });
}

async function decolourizeDirectory(dir) {
    const startTime = Date.now();

    const files = await promisify(fs.readdir)(dir);

    const coloured = new Set();
    const bw = new Set();

    for (const file of files) {
        if (/image-\d+-bw\.jpeg/.test(file)) {
            bw.add(file);
        } else if (/image-\d+\.jpeg/.test(file)) {
            coloured.add(file);
        }
    }

    let count = 0;
    for (const file of coloured) {
        if (bw.has(outputFile(file))) {
            continue;
        }

        await decolourizeImage(path.join(dir, file));
        count++;
    }

    const elapsed = Date.now() - startTime;

    console.log(`\t${count} decolourized in ${elapsed.toFixed()}ms (${dir} contains ${coloured.size} in colour)`);

    return coloured.size;
}

async function decolourizeAll() {
    const startTime = Date.now();

    const objectDir = 'data/objects';
    const files = await promisify(fs.readdir)(objectDir);

    let totalCount = 0;

    for (const file of files) {
        const subdir = path.join(objectDir, file);
        if (!(await promisify(fs.stat)(subdir)).isDirectory()) {
            continue;
        }

        totalCount += await decolourizeDirectory(subdir);
    }

    const elapsed = Date.now() - startTime;
    console.log(`Done in ${(elapsed/1000).toFixed(1)}s (${totalCount} black and white images)`);
}

if (process.argv[1].split('/').pop() === 'decolourize_images.js') {
    decolourizeAll();
}

module.exports = decolourizeAll;