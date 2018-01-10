const fs = require("fs");

/**
 * Used to easily get the current unix timestamp 
 * 
 * @var {function} unix
 * @see https://www.npmjs.com/package/to-unix-timestamp
 */
const unix = require("to-unix-timestamp");

/**
 * The library we're using for colorful console.logs (e.g. changing text color, text bg color)
 * 
 * @var {object} chalk
 * @see https://www.npmjs.com/package/chalk
 */
const chalk = require("chalk");

/**
 * Used to turn our HTML report templates to pdfs 
 * 
 * @var {function} htmltopdf
 * @see https://www.npmjs.com/package/html5-to-pdf
 */
const htmltopdf = require("html5-to-pdf");

const unixTimeStamp = unix(new Date());

module.exports = {
    generate(){


        const pdfgen = new htmltopdf({
            inputPath: "./src/templates/lighthouse.html",
            outputPath: `report-${unixTimeStamp}.pdf`
        });

        pdfgen.build(err => {
            if(err) {
                console.log(chalk.bgRed.white.bold(`[ERROR] ${err.replace('Error: ')}`));
            }
        });
    }
}