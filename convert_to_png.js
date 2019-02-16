const fs = require('fs');
const { promisify } = require('util');
const path = require('path');
const sharp = require('sharp');

async function convertFolderToPNG(dir) {
    let files = await promisify(fs.readdir)(dir);
    files = files.filter((file) => /\.(png|jpe?g)$/.test(file));
    files = files.sort((a, b) => parseInt(a.match(/-(\d+)/)[1]) - parseInt(b.match(/-(\d+)/)[1]));

    for (let file of files) {
        const input = path.join(dir, file);
        const output = path.join(dir, file.replace(/\.(png|jpe?g)$/, '.png'));

        if (fs.existsSync(output)) {
            console.log(`Already exists: ${output}`);
            continue;
        }

        console.log(`Converting ${input}`);

        await sharp(path.join(dir, file))
            .toFile(output);

        await promisify(fs.unlink)(input);
    }
}

convertFolderToPNG('data/formatted/train/colour');
// convertFolderToPNG('data/formatted/dev/colour');
// convertFolderToPNG('data/formatted/test/colour');