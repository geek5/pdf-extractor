#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const ejs = require('ejs');
const Promise = require("bluebird");
const PdfExtractor = require('./index').PdfExtractor;
const resolve = require('path').resolve
const mkdirp = require('mkdirp');
const [, , ...args] = process.argv;



global.Promise = Promise;
Promise.longStackTraces();


// console.log(resolve(args[1]));
// process.exit(1);

// Relative path of the PDF file.
let pdfPath = resolve(args[0]) || './pdfs/eyrolles.pdf',
    fileBuffer = fs.readFileSync(pdfPath),
    fileHash = crypto.createHash('md5').update(fileBuffer).digest('hex'),
    outputDir = resolve(args[1] || '.'),
    numPagesLimit = parseInt(process.argv[2]) || Infinity;


try {
    // fs.mkdirSync(outputDir);
    mkdirp(outputDir);
    // mkdirp(outputDir, function (err) {
    //     if (err) {
    //         throw e;
    //     }
    // })
} catch (e) {
    if (e.code !== 'EEXIST') {
        throw e;
    }
}
console.log('input : ' + pdfPath, 'output : ' + outputDir);
// process.exit(1);

console.log('Output to: ' + outputDir);

mkdirp(outputDir, function (err) {
    if (err) {
        throw e;
    }
    let pdfExtractor = new PdfExtractor(outputDir, {
        viewportScale: (width, height) => {
            return 1;
            if (width > height) {
                return 1100 / width;
            }
            return 800 / width;
        },
        pageRange: [1, numPagesLimit]
        // pageRange: [8, 8]
    });

    pdfExtractor.parseFromFileBuffer(fileBuffer).then(function (doc) {

        console.log('# End of Document');

        // console.log('Parsing html preview');

        // setTimeout(() => {
        //     let fileInfo = JSON.parse(fs.readFileSync(outputDir + '/info.json', { encoding: 'utf8' }));

        //     ejs.renderFile('./template.ejs', { dir: outputDir, info: fileInfo }, {}, function (err, result) {
        //         fs.writeFile(outputDir + '/preview.html', result, { encoding: 'utf8' }, function (err) {
        //             if (err) {
        //                 return console.log(err);
        //             }

        //             console.log('Done :' + outputDir);
        //         });
        //     })
        // }, 20);



    }).catch(function (err) {
        console.error('Error: ' + err);
    });
})

