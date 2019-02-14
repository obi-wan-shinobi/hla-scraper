const fs = require('fs');
const request = require('request');
const { promisify } = require('util');
const mkdirp = promisify(require('mkdirp'));
const PromisePool = require('es6-promise-pool');
const puppeteer = require('puppeteer');

const INDEX_URL = 'http://hubblesite.org/images/gallery/page/';
const OBJECT_DIR = 'data/hubblesite';
const MAX_PAGE = 92;

const IMAGE_DOWNLOAD_CONCURRENCY = 5;
const PAGE_CONCURRENCY = 3;

async function getHubblesiteImages(debugPrefix='', browserPromise) {

    mkdirp(OBJECT_DIR);

    let createdBrowser = !browserPromise;
    if (createdBrowser) {
        browserPromise = puppeteer.launch();
    }

    const browser = await browserPromise;

    try {
        const links = await findLinks(browser, debugPrefix);
        await downloadLinks(browser, links, debugPrefix);
    } catch (e) {
        throw e;
    } finally {
        if (createdBrowser) {
            await browser.close();
        }
    }
}

async function findLinks(browser, debugPrefix) {
    const indexFile = OBJECT_DIR + '/index.json';
    if (fs.existsSync(indexFile)) {
        console.log(`${debugPrefix}Already downloaded got links`);
        return JSON.parse(await promisify(fs.readFile)(indexFile));
    }

    let links = [];
    let i = -1;
    const pool = new PromisePool(() => {
        i++;

        if (i >= MAX_PAGE) {
            return null;
        }

        return fetchImagesFrom(i, browser, debugPrefix + '\t').catch((error) => {
            console.error(`Download failed: ${links[i]}`)
        }).then((linkBatch) => {
            links = [...links, ...linkBatch];
        });
    }, PAGE_CONCURRENCY);

    await pool.start();

    await promisify(fs.writeFile)(indexFile, JSON.stringify(links, null, 4));

    return links;
}

async function downloadLinks(browser, links, debugPrefix) {
    console.log(`${debugPrefix} Downloading ${links.length} images`);

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

async function fetchImagesFrom(pageNumber, browser, debugPrefix) {
    const page = await browser.newPage();
    await page.goto(INDEX_URL + (pageNumber + 1), { waitUntil: 'networkidle2' });

    const links = await page.evaluate(() => {
        return [...document.querySelectorAll('.images_row a')]
            .filter(a => /\/image\//.test(a.href))
            .map(a => a.href);
    });

    console.log(`${debugPrefix}Page ${pageNumber+1}/${MAX_PAGE}, has ${links.length} images on it`);

    await page.close();

    return links;
}

async function downloadHighRes(browser, link, i, debugPrefix) {
    console.log(`${debugPrefix}Finding image URL from ${link}`);

    const page = await browser.newPage();
    await page.goto(link, { waitUntil: 'networkidle2' });

    let imageURL;

    try {
        imageURL = await page.evaluate(() => {
            const versions = [...document.querySelectorAll('.display_image_sidebar_title_2 a')]
                .filter(a => /jpe?g|png/i.test(a.innerText));
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

getHubblesiteImages();