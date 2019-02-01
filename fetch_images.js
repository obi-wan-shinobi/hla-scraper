const fs = require('fs');
const request = require('request');
const { promisify } = require('util');
const mkdirp = promisify(require('mkdirp'));
const crypto = require('crypto');
const getImageIndex = require('./fetch_image_index');

const url = "https://hla.stsci.edu/hlaview.html#Images|filterText%3D%24filterTypes%3D|query_string=M101&posfilename=&poslocalname=&posfilecount=&listdelimiter=whitespace&listformat=degrees&RA=210.802429&Dec=54.348750&Radius=0.200000&inst-control=all&inst=ACS&inst=ACSGrism&inst=WFC3&inst=WFPC2&inst=NICMOS&inst=NICGRISM&inst=COS&inst=WFPC2-PC&inst=STIS&inst=FOS&inst=GHRS&imagetype=color&prop_id=&spectral_elt=&proprietary=both&preview=1&output_size=256&cutout_size=12.8|ra=&dec=&sr=&level=&image=&inst=ACS%2CACSGrism%2CWFC3%2CWFPC2%2CNICMOS%2CNICGRISM%2CCOS%2CWFPC2-PC%2CSTIS%2CFOS%2CGHRS&ds=";

async function downloadImages(url) {
    const objectDir = `data/objects/${crypto.createHash('md5').update(url).digest('hex')}`;
    await mkdirp(objectDir);

    const index = await getImageIndex(url);
    for (let i = 0; i < index.length; i++) {
        console.log(`Downloading image ${i}`);
        await downloadImage(index[i].src, objectDir, i);
    }
}

function downloadImage(imageURL, objectDir, i) {
    return new Promise((resolve, reject) => {
        request(imageURL)
            .on('error', reject)
            .on('response',  function (res) {
                if (!res.headers['content-type']) {
                    reject('No content type header -- image likely does not exist');
                    return;
                }

                const ending = res.headers['content-type'].split('/')[1];
                const imageFile = `${objectDir}/image-${i}.${ending}`;
                const imagePipe = fs.createWriteStream(imageFile);
                res.pipe(imagePipe);

                imagePipe.on('finish', resolve);
            });
    })
}

downloadImages(url).then(console.log);