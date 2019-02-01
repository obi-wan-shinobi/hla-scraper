const puppeteer = require('puppeteer');

const url = "https://hla.stsci.edu/hlaview.html#Images|filterText%3D%24filterTypes%3D|query_string=M101&posfilename=&poslocalname=&posfilecount=&listdelimiter=whitespace&listformat=degrees&RA=210.802429&Dec=54.348750&Radius=0.200000&inst-control=all&inst=ACS&inst=ACSGrism&inst=WFC3&inst=WFPC2&inst=NICMOS&inst=NICGRISM&inst=COS&inst=WFPC2-PC&inst=STIS&inst=FOS&inst=GHRS&imagetype=color&prop_id=&spectral_elt=&proprietary=both&preview=1&output_size=256&cutout_size=12.8|ra=&dec=&sr=&level=&image=&inst=ACS%2CACSGrism%2CWFC3%2CWFPC2%2CNICMOS%2CNICGRISM%2CCOS%2CWFPC2-PC%2CSTIS%2CFOS%2CGHRS&ds=";

async function getImageIndex(url) {
    const browser = await puppeteer.launch({ headless: true });

    const page = await browser.newPage();
    await page.goto(url, {waitUntil: 'networkidle2'});

    await waitForPage(page, '\t');

    const results = await scrapeImageIndex(page, '\t');
    console.log(`${results.length} images indexed`);

    await page.close();
    await browser.close();
}

async function waitForPage(page, debugPrefix='') {
    console.log(`${debugPrefix}Waiting for search to complete`);
    await page.waitFor('#pageendresultscount');

    const lastImage = await page.evaluate(() => {
        return document.querySelector('#pageendresultscount').innerText;
    });

    const firstImage = parseInt(lastImage) - 20 + 1;

    console.log(`${debugPrefix}Results received. Waiting for frames ${firstImage}-${lastImage}`);

    const waitingFrames = [];
    for (let i = firstImage; i <= lastImage; i++) {
        waitingFrames.push(page.waitFor(`iframe[name=image${i}]`));
    }
    await Promise.all(waitingFrames);

    console.log(`${debugPrefix}All iframes created`);

    const waitingImages = [];
    for (let i = firstImage; i <= lastImage; i++) {
        const frame = page.frames()[i + 3];
        const index = '' + i;
        waitingImages.push(frame.waitForSelector('img').then(() => console.log(`\t${debugPrefix}Frame loaded: ${index}`)));
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