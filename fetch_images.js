const puppeteer = require('puppeteer');

const url = "https://hla.stsci.edu/hlaview.html#Images|filterText%3D%24filterTypes%3D|query_string=M101&posfilename=&poslocalname=&posfilecount=&listdelimiter=whitespace&listformat=degrees&RA=210.802429&Dec=54.348750&Radius=0.200000&inst-control=all&inst=ACS&inst=ACSGrism&inst=WFC3&inst=WFPC2&inst=NICMOS&inst=NICGRISM&inst=COS&inst=WFPC2-PC&inst=STIS&inst=FOS&inst=GHRS&imagetype=color&prop_id=&spectral_elt=&proprietary=both&preview=1&output_size=256&cutout_size=12.8|ra=&dec=&sr=&level=&image=&inst=ACS%2CACSGrism%2CWFC3%2CWFPC2%2CNICMOS%2CNICGRISM%2CCOS%2CWFPC2-PC%2CSTIS%2CFOS%2CGHRS&ds=";

const IMAGES_PER_PAGE = 20;

async function getImageIndex(url) {
    const browser = await puppeteer.launch({ headless: true });

    const page = await browser.newPage();
    await page.goto(url, {waitUntil: 'networkidle2'});

    try {
        await fetchAllPages(page);
    } catch (e) {
        throw e;
    } finally {
        await page.close();
        await browser.close();
    }
}

async function fetchAllPages(page, debugPrefix='') {
    let allResults = [];
    while (true) {
        await waitForPage(page, allResults.length + 1, debugPrefix + '\t');
        const results = await scrapeImageIndex(page, debugPrefix + '\t');
        allResults = [...allResults, ...results];

        console.log(`${results.length} new images indexed (${allResults.length} total)`);

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

    console.log(`${debugPrefix}All iframes done`)
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

getImageIndex(url).then(console.log);