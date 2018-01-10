const fs = require("fs");
const path = require("path");

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
    generate(opts){
        fs.readFile(path.resolve(__dirname, "templates/lighthouse.html"), "utf8", (err, data) => {
            if(err) {
                console.log(chalk.bgRed.white.bold(err.message.replace("Error: ", "")));
            }

            /**
             * Note: The strings we want to replace in the HTML file are basically the keys of the options object but with curly braces around them.
             * 
             * Here we're building a regex to replace all the {{opts.keys}} in the HTML file, based on the keys of the passed in options object. Including
             * the {{scoreClass:opts.key}} replacement strings which control the color of the score
             * 
             * @var {string} regex
             */
            let regex = "";

            for(let key in opts) {
                regex += `({{${key}}})|`;

                if(key != "url") {
                    regex += `({{scoreClass:${key}}})|`;
                }
            }

            /**
             * Here we're just removing the trailing "|" from the generated string
             */
            regex = regex.substring(0, regex.length - 1);
            const regexp = new RegExp(regex, "g");

            /** 
             * Then we use the regex we built from above and use that as the regex for the content we want to replace in HTML file
             * and when a group match is encountered we check to see if that group name matches a key in the options object and if it
             * does we replace that {{key}} with its appropriate passed in value and if it doesn't we check to see if that match is a 
             * {{scoreClass:opts.key}} replacement and if it is give it the appropriate class based on the option key's value
             */
            let replacement = data.replace(regexp, (match) => {
                for(let key in opts) {
                    const value = opts[key];
                    
                    if(match == `{{${key}}}`) {
                        return value;
                    } else if(match.includes("scoreClass") && match.includes(key)){
                        const ratings = {
                            pass: 80,
                            average: 70,
                            fail: 69
                        };

                        const classMap = {
                            pass: "ok",
                            average: "good",
                            fail: "poor"
                        };

                        if(value >= ratings.pass) {
                            return classMap["pass"];
                        } else if(value > ratings.fail && value < ratings.pass) {
                            return classMap["average"];
                        } else if(value <= ratings.fail) {
                            return classMap["fail"];
                        }

                        return "";
                    }
                }
            });

            /**
             * Path to the file generated above with the placeholder content filled in
             * 
             * @var {string} generatedFilePath
             */
            const generatedFilePath = `generated/test-${unixTimeStamp}.html`;

            fs.writeFile(path.resolve(__dirname, generatedFilePath), replacement, "utf8", (err) => {
                if(err) {
                    console.log(chalk.bgRed.white.bold(err.message.replace("Error: ", "")))
                }
            })

            const pdfgen = new htmltopdf({
                inputPath: path.resolve(__dirname, generatedFilePath),
                outputPath: `report-${unixTimeStamp}.pdf`
            });

            pdfgen.build(err => {
                if(err) {
                    console.log(chalk.bgRed.white.bold(`[ERROR] ${err.replace('Error: ')}`));
                }
            });
        });
        
        // delete generated html file used for generating pdf file after the pdf generation is complete
    }
}