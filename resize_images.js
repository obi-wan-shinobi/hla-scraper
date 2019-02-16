const fs = require('fs');
const { promisify } = require('util');
const path = require('path');
const sharp = require('sharp');
const mkdirp = promisify(require('mkdirp'));

const WIDTH = 2040;
const HEIGHT = 1356;

async function resizeImage(imagePath, outputPath, i) {
    const image = sharp(imagePath);

    // get image size
    const [width, height] = await getImageSize(image);

    if (width < WIDTH || height < HEIGHT) {
        return i;
    }

    i = i || 0;
    for (let x = 0; x < width; x += WIDTH) {
        x = Math.min(x, width - WIDTH);

        for (let y = 0; y < height; y += HEIGHT) {
            y = Math.min(y, height - HEIGHT);
            if (fs.existsSync(`${outputPath}-${i}.jpg`)) {
                i++;
                continue;
            }

            await image.extract({
                left: x,
                top: y,
                width: WIDTH,
                height: HEIGHT
            }).toFile(`${outputPath}-${i++}.jpg`);
        }
    }

    return i;
}

function getImageSize(image) {
    return image.metadata()
        .then(info => {
            return [info.width, info.height];
        });
}

async function cropFolder(dir, outputDir) {
    console.log(`Cropping ${dir}`);
    await mkdirp(outputDir);

    let files = await promisify(fs.readdir)(dir);
    files = files.filter((file) => /\.(png|jpe?g)$/.test(file));
    files = files.sort((a, b) => parseInt(a.match(/-(\d+)/)[1]) - parseInt(b.match(/-(\d+)/)[1]));

    let i = 0;
    for (const file of files) {
        console.log(`\tCropping ${file}`);
        const prevI = i;
        i = await resizeImage(path.join(dir, file), `${outputDir}/image`, i)
        console.log(`\t\t${i - prevI} cropped from ${file} (${i} done total)`);
    }

    return i;
}

// cropFolder('data/heritage', 'data/cropped-heritage').then(console.log);
cropFolder('data/hubblesite', 'data/cropped-hubblesite').then(console.log);
