const fs = require('fs');
const request = require('request');
const { promisify } = require('util');
const mkdirp = promisify(require('mkdirp'));
const PromisePool = require('es6-promise-pool');
const puppeteer = require('puppeteer');

const INDEX_URL = 'http://heritage.stsci.edu/gallery/galindex.html';
const OBJECT_DIR = 'data/heritage';

const IMAGE_DOWNLOAD_CONCURRENCY = 5;

async function getHeritageImages(debugPrefix='', browserPromise) {

    mkdirp(OBJECT_DIR);

    let createdBrowser = !browserPromise;
    if (createdBrowser) {
        browserPromise = puppeteer.launch();
    }

    const browser = await browserPromise;

    const page = await browser.newPage();
    await page.goto(INDEX_URL, { waitUntil: 'networkidle2', timeout: 0 });

    let results = [];

    try {
        results = await fetchAllImages(page, browser, debugPrefix);
    } catch (e) {
        throw e;
    } finally {
        await page.close();

        if (createdBrowser) {
            await browser.close();
        }
    }

    return results;
}

async function fetchAllImages(page, browser, debugPrefix) {
    const links = await page.evaluate(() => {
        return [...document.querySelectorAll('em a')]
            .filter(a => a.innerText === 'High-Resolution Images')
            .map(a => a.href);
    });

    console.log(`${debugPrefix}${links.length} images total`);

    let i = -1;
    const pool = new PromisePool(() => {
        i++;

        if (i >= links.length) {
            return null;
        }

        return downloadHighRes(browser, links[i], i, debugPrefix + `\t[${i + 1}/${links.length}] `).catch((error) => {
            console.error(`Download failed: ${links[i]}`)
        });
    }, IMAGE_DOWNLOAD_CONCURRENCY);

    await pool.start();
}

async function downloadHighRes(browser, link, i, debugPrefix) {
    console.log(`${debugPrefix}Finding image URL from ${link}`);

    const page = await browser.newPage();
    await page.goto(link, { waitUntil: 'networkidle2', timeout: 0 });

    let imageURL;

    try {
        imageURL = await page.evaluate(() => {
            const versions = [...document.querySelectorAll('.display_image_sidebar_title_2 a')]
                .filter(a => /jpe?g/i.test(a.innerText));
            return versions[versions.length - 1].href;
        });
    } catch (e) {
        throw e;
    } finally {
        await page.close();
    }

    console.log(`${debugPrefix}Downloading image from ${imageURL}`);
    await downloadImage(imageURL, OBJECT_DIR, i);
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

getHeritageImages();