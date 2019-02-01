const puppeteer = require('puppeteer');

const IMAGES_PER_PAGE = 20;

async function getImageIndex(url, debugPrefix='', browserPromise) {

    let createdBrowser = !browserPromise;
    if (createdBrowser) {
        browserPromise = puppeteer.launch();
    }

    const browser = await browserPromise;

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 0 });

    let results = [];

    try {
        results = await fetchAllPages(page, debugPrefix);
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

async function fetchAllPages(page, debugPrefix='') {
    let allResults = [];
    while (true) {
        const firstImage = await waitForPage(page, allResults.length + 1, debugPrefix + '\t');
        if (firstImage === 0) { // none found
            console.log(`${debugPrefix} No results after filtering`);
            return allResults;
        }

        const results = await scrapeImageIndex(page, debugPrefix + '\t');
        allResults = [...allResults, ...results];

        console.log(`${debugPrefix}${results.length} new images indexed (${allResults.length} total)`);

        const wasLast = (results.length % IMAGES_PER_PAGE !== 0) ||
            await page.evaluate(() => !!document.querySelector('.fwd.inactive'));

        if (wasLast) {
            break;
        }

        await goToNextPage(page, debugPrefix + '\t');
    }

    return allResults;
}

async function goToNextPage(page, debugPrefix='') {
    await page.click('.fwd');
}

async function waitForPage(page, expectedStartImage, debugPrefix='') {
    console.log(`${debugPrefix}Waiting for search to complete`);
    await page.waitFor('#pageendresultscount');

    let firstImage = null;
    let lastImage = null;

    while (firstImage !== expectedStartImage) {
        lastImage = parseInt(await page.evaluate(() => {
            return document.querySelector('#pageendresultscount').innerText;
        }));

        if (lastImage === 0) { // no results, return
            return 0;
        }

        firstImage = lastImage % IMAGES_PER_PAGE === 0 ?
            lastImage - IMAGES_PER_PAGE + 1 :
            lastImage - (lastImage % IMAGES_PER_PAGE) + 1;

        // delay 50ms to avoid a busy wait (and no harm because lower stuff has to load anyway)
        await new Promise((resolve) => setTimeout(resolve, 50));
    }

    console.log(`${debugPrefix}Results received. Waiting for frames ${firstImage}-${lastImage}`);

    const waitingFrames = [];
    for (let i = firstImage; i <= lastImage; i++) {
        waitingFrames.push(page.waitFor(`iframe[name=image${i}]`));
    }
    await Promise.all(waitingFrames);

    console.log(`${debugPrefix}All iframes created`);

    const waitingImages = [];
    for (let imageNumber = firstImage; imageNumber <= lastImage; imageNumber++) {
        const i = (imageNumber - 1) % IMAGES_PER_PAGE + 1;
        const frame = page.frames()[i + 3];

        const imageNumberName = imageNumber.toString();
        waitingImages.push(frame.waitForSelector('img').then(() => console.log(`\t${debugPrefix}Frame loaded: ${imageNumberName}`)));
    }

    await Promise.all(waitingImages);

    console.log(`${debugPrefix}All iframes done`);
}

async function scrapeImageIndex(page) {
    return await page.evaluate(() => {
        return [...document.querySelectorAll('iframe')]
            .filter((iframe) => (/^image/).test(iframe.name))
            .map((iframe) => {
                return {
                    name: iframe.contentWindow.document.body.querySelector('.color').innerText.split("\n")[1],
                    src: iframe.contentWindow.document.body.querySelector('img').src
                }
            });
    });
}

module.exports = getImageIndex;
