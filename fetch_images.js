const fs = require('fs');
const request = require('request');
const { promisify } = require('util');
const mkdirp = promisify(require('mkdirp'));
const crypto = require('crypto');
const PromisePool = require('es6-promise-pool');
const puppeteer = require('puppeteer');
const getImageIndex = require('./fetch_image_index');

const INDEX_DOWNLOAD_CONCURRENCY = 3;
const IMAGE_DOWNLOAD_CONCURRENCY = 10;

const URL_FORMAT = "https://hla.stsci.edu/hlaview.html#Images|filterText%3D%24filterTypes%3D|query_string=M101&posfilename=&poslocalname=&posfilecount=&listdelimiter=whitespace&listformat=degrees&RA={RA}&Dec={DEC}&Radius={RAD}&inst-control=all&inst=ACS&inst=ACSGrism&inst=WFC3&inst=WFPC2&inst=NICMOS&inst=NICGRISM&inst=COS&inst=WFPC2-PC&inst=STIS&inst=FOS&inst=GHRS&imagetype=color&prop_id=&spectral_elt=&proprietary=both&preview=1&output_size=256&cutout_size=12.8|ra=&dec=&sr=&level=&image=&inst=ACS%2CACSGrism%2CWFC3%2CWFPC2%2CNICMOS%2CNICGRISM%2CCOS%2CWFPC2-PC%2CSTIS%2CFOS%2CGHRS&ds=";

function generateUrl(ra, declination, radius) {
    return URL_FORMAT
        .replace('{RA}', ra.toFixed(6))
        .replace('{DEC}', declination.toFixed(6))
        .replace('{RAD}', radius);
}

async function downloadImages(url, debugPrefix='', browserPromise) {
    const startTime = Date.now();

    const hash = crypto.createHash('md5').update(url).digest('hex');
    const objectDir = `data/objects/${hash}`;
    await mkdirp(objectDir);

    console.log(`${debugPrefix}[${new Date().toLocaleString()}] Downloading ${url} with hash ${hash}`);

    const indexFile = objectDir + '/index.json';
    if (fs.existsSync(indexFile)) {
        console.log(`${debugPrefix}Already downloaded ${hash}`);
        return;
    }

    const index = await getImageIndex(url, `${debugPrefix}[${hash}]\t`, browserPromise);

    let i = -1;
    const pool = new PromisePool(() => {
        i++;

        if (i >= index.length) {
            return null;
        }

        console.log(`${debugPrefix}\tDownloading image ${i}`);
        return downloadImage(index[i].src, objectDir, i);
    }, IMAGE_DOWNLOAD_CONCURRENCY);

    await pool.start();

    await promisify(fs.writeFile)(indexFile, JSON.stringify(index, null, 4));
    console.log(`${debugPrefix}[${new Date().toLocaleString()}] Download complete of ${hash}`);

    const elapsedTime = Date.now() - startTime;
    console.log(`${debugPrefix}[${new Date().toLocaleString()}] Finished getting images (${index.length} downloaded, ${elapsedTime}ms) ${hash}`);
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

async function downloadAll() {
    const urls = [];

    for(let dec = -37; dec < 90; dec+=1){
      urls.push(generateUrl(29, dec, 1));
    }

    for (let ra = 30; ra < 360; ra += 1) {
        for (let dec = -90; dec < 90; dec += 1) {
            urls.push(generateUrl(ra, dec, 1));
        }
    }

    const browserPromise = puppeteer.launch();

    let i = -1;
    const pool = new PromisePool(() => {
        i++;

        if (i >= urls.length) {
            return null;
        }

        return downloadImages(urls[i], undefined, browserPromise).catch(error => console.error(error));
    }, INDEX_DOWNLOAD_CONCURRENCY);

    await pool.start();
    const browser = await browserPromise;
    await browser.close();
}

downloadAll();
