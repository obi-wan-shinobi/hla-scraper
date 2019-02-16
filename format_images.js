const fs = require('fs');
const { promisify } = require('util');
const path = require('path');
const mkdirp = promisify(require('mkdirp'));
const { decolourizeImage } = require('./decolourize_images');

const INPUT_FOLDERS = [
    'data/cropped-heritage',
    'data/cropped-hubblesite',
];

const OUTPUT_FOLDER = 'data/formatted';

const DEV_PORTION = 0.1;
const TEST_PORTION = 0.1;

async function formatImages() {
    const imagePaths = await getImagePaths();
    console.log(`${imagePaths.length} images total`);
    await splitImages(imagePaths);
}

async function getImagePaths() {
    let files = [];

    for (let folder of INPUT_FOLDERS) {
        const newFiles = (await promisify(fs.readdir)(folder))
            .map((file) => path.join(folder, file));

        files = [...files, ...newFiles];
    }

    return files.filter((file) => /\.(png|jpe?g)$/.test(file));
}

async function splitImages(imagePaths) {
    await mkdirp(OUTPUT_FOLDER);

    shuffle(imagePaths);

    const splitIndexDev = Math.floor(imagePaths.length * DEV_PORTION);
    const splitIndexTest = splitIndexDev + Math.floor(imagePaths.length * TEST_PORTION);

    const dev = imagePaths.slice(0, splitIndexDev);
    const test = imagePaths.slice(splitIndexDev, splitIndexTest);
    const train = imagePaths.slice(splitIndexTest);

    console.log(`${train.length}/${dev.length}/${test.length} split`);

    await copyImages(train, path.join(OUTPUT_FOLDER, 'train'));
    await copyImages(dev, path.join(OUTPUT_FOLDER, 'dev'));
    await copyImages(test, path.join(OUTPUT_FOLDER, 'test'));

    return [path.join(OUTPUT_FOLDER, 'train'), path.join(OUTPUT_FOLDER, 'dev'), path.join(OUTPUT_FOLDER, 'test')]
}

async function copyImages(imagePaths, outputDir) {
    const bwDir = path.join(outputDir, 'bw');
    const colourDir = path.join(outputDir, 'colour');
    await mkdirp(bwDir);
    await mkdirp(colourDir);

    for (let i = outputDir === 'data/formatted/train' ? 5885 : 0; i < imagePaths.length; i++) {
        const ending = imagePaths[i].split('.').pop();
        const name = `image-${i}.${ending}`;

        console.log(`\tCopying ${i+1}/${imagePaths.length} in ${outputDir}`);

        try {
            await decolourizeImage(imagePaths[i], () => path.join(bwDir, name));
            await promisify(fs.copyFile)(imagePaths[i], path.join(colourDir, name));
        } catch (e) {
            console.error(e);
        }
    }
}

// From https://stackoverflow.com/questions/6274339/how-can-i-shuffle-an-array
function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

formatImages().then(console.log);