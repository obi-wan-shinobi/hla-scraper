const sharp = require('sharp');

const WIDTH = 2040;
const HEIGHT = 1356;

async function resizeImage(imagePath, outputPath) {
    const image = sharp(imagePath);

    // get image size
    const [width, height] = await getImageSize(image);
    console.log(width, height);

    if (width < WIDTH || height < HEIGHT) {
        return;
    }

    let i = 0;
    for (let x = 0; x < width; x += WIDTH) {
        console.log('x: ' + x);
        x = Math.min(x, width - WIDTH);

        for (let y = 0; y < height; y += HEIGHT) {
            console.log('y: ' + y);
            y = Math.min(y, height - HEIGHT);

            await image.extract({
                left: x,
                top: y,
                width: WIDTH,
                height: HEIGHT
            }).toFile(`${outputPath}-${i++}.jpg`);
        }
    }

    return outputPath;
}

function getImageSize(image) {
    return image.metadata()
        .then(info => {
            return [info.width, info.height];
        });
}

resizeImage('data/heritage/image-0.jpeg', 'data/test').then(console.log);
