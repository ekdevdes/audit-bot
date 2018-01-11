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
 * The library we're using to execute the "lighthouse" and "observatory" cli commands from node
 * 
 * @var {function} shellExec
 * @see https://www.npmjs.com/package/shell-exec
 */
const shellExec = require("shell-exec");

const unixTimeStamp = unix(new Date());

module.exports = {

    /**
     * Generates a PDF file from the HTML templates within the /templates file
     * 
     * @param {object} replacements an object containing keys and values to replace the placeholder strings in the template files with
     * @param {string} test only possible values are "lighthouse", "observatory" or "all" 
     * @param {string} pdfFilePath where the generated PDF should be saved to. Optional, defaults to the directory the "report" command is beign run from. Note: this is a directory. Not to end with .pdf
     */
    generate(replacements, test, pdfFilePath = ""){
        fs.readFile(path.resolve(__dirname, `templates/${test}.html`), "utf8", (err, data) => {
            if(err) {
                console.log(chalk.bgRed.white.bold(err.message.replace("Error: ", "")));
            }

            /**
             * Note: The strings we want to replace in the HTML file are basically the keys of the replacements object but with curly braces around them.
             * 
             * Here we're building a regex to replace all the {{replacements.keys}} in the HTML file, based on the keys of the passed in replacements object. Including
             * the {{scoreClass:replacements.key}} replacement strings which control the color of the score
             * 
             * @var {string} regex
             */
            let regex = "";

            for(let key in replacements) {
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
             * and when a group match is encountered we check to see if that group name matches a key in the replacements object and if it
             * does we replace that {{key}} with its appropriate passed in value and if it doesn't we check to see if that match is a 
             * {{scoreClass:replacements.key}} replacement and if it is give it the appropriate class based on the replacement key's value
             */
            let replacement = data.replace(regexp, (match) => {
                for(let key in replacements) {
                    const value = replacements[key];
                    
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

            // in the second part of the ternary operator we need to check to see if the path doesn't end in a "/" and if it does we need add it to the end before appending our file name
            const generatedPDFPath = (pdfFilePath == "") ? `report-${unixTimeStamp}.pdf` : `${pdfFilePath}/report-${unixTimeStamp}.pdf`;
            const pathToReport = path.resolve(__dirname, generatedFilePath);

            shellExec(`html-pdf ${pathToReport} ${generatedPDFPath}`).then(() => {
                console.log(`PDF Saved to: "${generatedPDFPath}"`);

                /**
                 * Remove the generated html file since we don't need it anymore now that the PDF is generated
                 */
                fs.unlink(path.resolve(__dirname, generatedFilePath), (err) => {
                    if(err) {
                        console.log(chalk.bgRed.white.bold(err.message.replace("Error: ", "")))
                    }
                });
            }).catch(err => {
                console.log(chalk.bgRed.white.bold(err.message.replace("Error: ", "")));
            });
        });
        
        // delete generated html file used for generating pdf file after the pdf generation is complete
    }
}