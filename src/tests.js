const fs = require("fs");
const path = require("path");

/**
 * A the library we're going to use to pull the lighthouse report result JSON out of the HTML report the 
 * cli tool generates
 * 
 * @var {function} jsdom
 * @see https://www.npmjs.com/package/jsdom
 */
const { JSDOM } = require("jsdom");

/**
 * The library we're using to execute the "lighthouse" and "observatory" cli commands from node
 * 
 * @var {function} shellExec
 * @see https://www.npmjs.com/package/shell-exec
 */
const shellExec = require("shell-exec");

/**
 * The library we're using for colorful console.logs (e.g. changing text color, text bg color)
 * 
 * @var {object} chalk
 * @see https://www.npmjs.com/package/chalk
 */
const chalk = require("chalk");

/**
 * Colorful CLI Spinners 
 * 
 * @var {function} ora
 * @see https://github.com/sindresorhus/ora
 */
const ora = require("ora");

/**
 * Colorful CLI Spinners 
 * 
 * @var {object} easyTable
 * @see https://www.npmjs.com/package/easy-table
 */
const easyTable = require("easy-table");

/**
 * Used to easily get the current unix timestamp 
 * 
 * @var {function} unix
 * @see https://www.npmjs.com/package/to-unix-timestamp
 */
const unix = require("to-unix-timestamp");

const urlLib = require("./url");
const pdf = require("./pdf");

module.exports = {
    run: {
        /**
         * Runs a lighthouse test on a given url
         * 
         * @param {object} argv Arguments from yargs
         * @param {string} url url to test
         */
        lighthouse(args, url) {
            /**
             * What scores for each metric of each test will result in a pass, fail or average result
             * 
             * @var {object} ratings
             */
            const ratings = {
                pass: 80,
                average: 70,
                fail: 69
            }

            const unixTimeStamp = unix(new Date());
            let lighthouseCommand = `lighthouse ${url} --chrome-flags="--headless" --quiet --output=html --output-path=./report-${unixTimeStamp}.html`;

            /** Show the log from the lighthouse command if --verbose is passed in */
            if(args.verbose) {
                lighthouseCommand = `lighthouse ${url} --chrome-flags="--headless" --output=html --output-path=./report-${unixTimeStamp}.html`;
            }

            const spinner = ora({
                text: "Running through tests...",
                spinner: "weather",
                color: "green"
            }); 

            if(!args.verbose) {
                spinner.start();
            }

            /**
             * Start the lighthouse reporting process, then do stuff after its finished.
             */
            shellExec(lighthouseCommand).then(() => {

                if(!args.verbose){
                    spinner.stop().clear();
                }

                const resultsSpinner = ora({
                    text: "Formatting results...",
                    spinner: "earth",
                    color: "green"
                });
                resultsSpinner.start();

                /**
                 * The result of the test is an html file that we can present the user with so they can read up on they
                 * can improve their site. But we need to know what scores they got in each category without having to
                 * scrape the html of the report or re-run the report with json output this time. Turns out the json results 
                 * are saved in a script tag at the bottom of the <body> of the html of the report so we're just invoking an 
                 * instance of JSDOM to parse that JSON so we can pull out the info we need.
                 */
                fs.readFile(`report-${unixTimeStamp}.html`, "utf8", (err, contents) => {

                    if(err) {
                        console.log(chalk.bgRed.white.bold(err.message.replace("Error: ", "")))
                    }
                
                    const dom = new JSDOM(contents);
                    
                    /**
                     * A string of the JSON data from the bottom of the <body> in the lighthouse report html
                     * 
                     * @var {string} theJSON
                     */
                    let theJSON = dom.window.document.querySelectorAll("script")[1].innerHTML.replace("window.__LIGHTHOUSE_JSON__ = ", "")
                    
                    /**
                     * Remove the ";" at the end of the JSON string so we can parse it into an object
                     */
                    theJSON = theJSON.substring(0, theJSON.length - 1);
                
                    /**
                     * The parsed version of the JSON string from above
                     * 
                     * @var {object} parsedJSON
                     */
                    const parsedJSON = JSON.parse(theJSON);
                
                    /**
                     * If --verbose was passed in add some padding between the last line of the lighthouse
                     * logs and the first line of the test results
                     */
                    if(args.verbose) {
                        console.log("");
                    }
                
                    /**
                     * Logging the results of the lighthouse test
                     */
                    let notes = `${chalk.cyan.bold("Notes:")}\n`;
                    const t = new easyTable;
                    
                    resultsSpinner.stop();
                    console.log(`${chalk.cyan.bold("\nGoogle Lighthouse Report")}: ${parsedJSON.url}\nAll scores are out of 100. For more details on the contents of each section of this report please check out the full report at ${chalk.cyan.bold.underline(path.resolve(`./report-${unixTimeStamp}.html`))}.\n`);
                
                    parsedJSON.reportCategories.forEach(el => {
                
                        /**
                         * The scores for each category include decimal values, we don't really need 
                         * to be that precise, so we're rounding up to the closes whole number
                         */
                        let score = Math.ceil(el.score);
                
                        if(el.score >= ratings.pass) {
                
                            /** Highlight passing scores green and bold */
                            score = chalk.green.bold(score);
                
                        } else if(el.score > ratings.fail && el.score <= ratings.pass) {
                
                            /** Highlight average scores yellow and bold */
                            score = chalk.yellow.bold(score);
                            notes = `${notes}* Your score for the ${chalk.bgYellow.black.bold(`"${el.name}" metric needs improvement`)}. Please consult the ${chalk.cyan.bold.underline(`report-${unixTimeStamp}.html`)} file generated for a detailed breakdown on what to improve.\n`;
                
                        } else if(el.score <= ratings.fail) {
                            
                            /** Highlight failing scores red and bold */
                            score = chalk.red.bold(score);
                            notes = `${notes}* Your score for the ${chalk.bgRed.white.bold(`"${el.name}" metric is poor`)}. Please consult the ${chalk.cyan.bold.underline(`report-${unixTimeStamp}.html`)} file generated for a detailed breakdown on how to improve it.\n`;
                        }
                
                        //console.log(`${score}\t${el.name}`);
                        t.cell("Score", score);
                        t.cell("Metric", el.name);
                        t.newRow();
                    });

                    console.log(t.toString());
                    console.log(notes);
                
                    /**
                     * Get the result of the "no-vulnerable-libraries" audit under the "Best Practices" section
                     */
                    let vulnerabilities = parsedJSON.reportCategories[3].audits[9].result;
                
                    /** If there are in fact vulnerable JS libraries in the passed in site let the user now */
                    if(!vulnerabilities.score) {
                        console.log(`${chalk.cyan.bold("Included front-end JavaScript libraries with known security vulnerabilities:")}`);
                        console.log(chalk.bgRed.bold.white(vulnerabilities.displayValue) + "\n");
                        
                        const vulnTable = new easyTable;
                        
                        vulnerabilities.extendedInfo.vulnerabilities.forEach(el => {
                            let lib = `${el.name}@${el.version}`;
                            let vulnCount = el.vulnCount;
                            let url = el.pkgLink;
                            let sev = el.highestSeverity;

                            if(el.highestSeverity === "Medium") {
                                lib = chalk.yellow.bold(lib);
                                vulnCount = chalk.yellow.bold(vulnCount);
                                url = chalk.yellow.bold.underline(el.pkgLink);
                                sev = chalk.yellow.bold(sev);
                            } else if(el.highestSeverity === "High") {
                                lib = chalk.red.bold(lib);
                                vulnCount = chalk.red.bold(vulnCount);
                                url = chalk.red.bold.underline(url);
                                sev = chalk.red.bold(sev);
                            }

                            vulnTable.cell("Library Version", lib);
                            vulnTable.cell("Vulnerability Count", vulnCount);
                            vulnTable.cell("Highest Severity", sev);
                            vulnTable.cell("URL", url);
                            vulnTable.newRow();
                        });
                        
                        console.log(vulnTable.toString());
                    }
                });
            });

        },
        
        /**
         * Runs a observatory security test on a given url
         * 
         * @param {object} argv Arguments from yargs
         * @param {string} url url to test
         */
        observatory(args, url) {

            const pdfGenData = {
                url,
                score: "",
                grade: "",
                rules: []
            }

            const spinner = ora({
                text: "Running through tests...",
                spinner: "moon",
                color: "green"
            }); 
            const unixTimeStamp = unix(new Date());

            if(urlLib.isLocal(url)){
                console.log(chalk.bgRed.white.bold("[ERROR] Mozilla Observatory does not support testing on localhost URLs"));
                return;
            }

            spinner.start();

            shellExec(`observatory ${url} --format=json &>report-${unixTimeStamp}-observatory.json`).then(() => {
                fs.readFile(`report-${unixTimeStamp}-observatory.json`, "utf8", (err, data) => {
                    if(err) {
                        console.log(chalk.bgRed.white.bold(err.message.replace("Error: ", "")));
                    }

                    if(data.includes("observatory [ERROR]")){
                        spinner.stop().clear();
                        
                        const errMsg = data.replace("observatory [ERROR] ", "").replace("Error: ", "");
                        console.log(chalk.bgRed.white.bold(`[ERROR] ${errMsg}`));
                    } else {
                        shellExec(`observatory ${url} --format=csv &>report-${unixTimeStamp}-observatory.txt`).then(() => {
                            spinner.stop().clear();

                            const resultsSpinner = ora({
                                text: "Formatting results...",
                                spinner: "earth",
                                color: "green"
                            });
                            resultsSpinner.start();
                            
                            /** Start the reading of the json file of the results of the observatory test */
                            fs.readFile(`report-${unixTimeStamp}-observatory.json`, "utf8", (err, data) => {
                                if(err) {
                                    console.log(chalk.bgRed.white.bold(err.message.replace("Error: ", "")))
                                }

                               const lines = data.split("\n"),
                                     filteredLines = lines.filter(line => !line.includes("observatory [WARN]")),
                                     cleanData = filteredLines.join("\n"),
                                     parsedData = JSON.parse(cleanData),
                                     obsTable = new easyTable,
                                     detailTable = new easyTable;

                                resultsSpinner.stop().clear();
                                console.log(`${chalk.cyan.bold("\nMozilla Observatory Security Report: ")} ${url}\n`);

                                for(let prop in parsedData) {
                                    const test = parsedData[prop];

                                    obsTable.cell("Score", test.score_modifier);
                                    obsTable.cell("Rule", chalk.red.bold(test.name))
                                    obsTable.cell("Description", test.score_description);
                                    obsTable.cell("Pass?", (test.pass ? chalk.green.bold("\u2714") : chalk.red.bold("\u2718")));
                                    obsTable.newRow();

                                    detailTable.cell("Rule", chalk.red.bold(test.name));
                                    detailTable.cell("Result", test.result);
                                    detailTable.newRow();

                                    pdfGenData.rules.push({
                                        score: test.score_modifier,
                                        slug: test.name,
                                        desc: test.score_description,
                                        isPassed: test.pass,
                                        class: (test.pass) ? "green" : "red"
                                    });
                                }

                                console.log(chalk.cyan.bold("Overview"));
                                console.log(obsTable.toString());
                                console.log(chalk.cyan.bold("More Details"));
                                console.log(detailTable.toString());

                                fs.readFile(`report-${unixTimeStamp}-observatory.txt`, "utf8", (err, data) => {
                                    if(err) {
                                        console.log(chalk.bgRed.white.bold(err.message.replace("Error: ", "")))
                                    }

                                    var lines = data.split("\n"),
                                        filteredLines = lines.filter(line => (line.includes("Score: ") || line.includes("Grade: "))),
                                        cleanData = filteredLines.map(line => {
                                            if(line.includes("Score: ")){
                                                return line.replace("Score: ", "");
                                            } else {
                                                return line.replace("Grade: ", "");
                                            }
                                        });

                                    pdfGenData.score = cleanData[0];
                                    pdfGenData.grade = cleanData[1];

                                    const observatoryURL = `https://observatory.mozilla.org/analyze.html?host=${url}`;

                                    console.log(`${chalk.cyan.bold("Score: ")} ${cleanData[0]}\n${chalk.cyan.bold("Grade: ")} ${cleanData[1]}\n`);
                                    console.log(`For more details on the contents of each section of this report please check out the full report at ${chalk.cyan.bold.underline(observatoryURL)}.`);
                                    console.log(`Additionally please consult this page for answered to commonly asked questions about Mozilla's Observatory Security Report ${chalk.cyan.bold.underline("https://observatory.mozilla.org/faq.html")}.\n`);
                                    
                                    pdf.generate("observatory", pdfGenData, args.f);

                                    /**
                                     * Remove the generated files since we don't need them anymore
                                     */
                                    shellExec(`rm -rf report-${unixTimeStamp}-observatory.json report-${unixTimeStamp}-observatory.txt`);
                                });
                            });
                        }); 
                    }
                });
            });
        },
       
        /**
         * Runs both an observatory lighthouse test and an observatory security test on a given url
         * 
         * @param {object} argv Arguments from yargs
         * @param {string} url url to test
         */
        all(args, url){
            const spinner = ora({
                text: "Running lighthouse tests...",
                spinner: "weather",
                color: "green"
            }); 
            let isLocalURL = urlLib.isLocal(url);

            /**
             * What scores for each metric of each test will result in a pass, fail or average result
             * 
             * @var {object} ratings
             */
            const ratings = {
                pass: 80,
                average: 70,
                fail: 69
            }

            const unixTimeStamp = unix(new Date());

            let lighthouseCommand = `lighthouse ${url} --chrome-flags="--headless" --quiet --output=html --output-path=./report-${unixTimeStamp}.html`;

            /** Show the log from the lighthouse command if --verbose is passed in */
            if(args.verbose) {
                lighthouseCommand = `lighthouse ${url} --chrome-flags="--headless" --output=html --output-path=./report-${unixTimeStamp}.html`;
            }
            
            /** If the url passed in a localhost URL let the user know that Mozilla's observatory doesn't support localhost URLs */
            if(isLocalURL){
                console.log(chalk.bgYellow.black.bold("[WARN] Mozilla Observatory doesn't support localhost URLs. Only running Google Lighthouse tests."));
            }

            /** Start the spinner if we don't want to use verbose output for lighthouse */
            if(!args.verbose) {
                spinner.start();
            }

            shellExec(lighthouseCommand).then(() => {
                let obsSpinner;

                /** Skip the observatory tests and go straight to formatting the lighthouse results */
                if(isLocalURL){
                   spinner.stop().clear();
                   
                    const resultsSpinner = ora({
                        text: "Formatting results...",
                        spinner: "earth",
                        color: "green"
                    });

                    resultsSpinner.start();

                    /** Begin formatting lighthouse results */
                    fs.readFile(`report-${unixTimeStamp}.html`, "utf8", (err, contents) => {
                        if(err) {
                            console.log(chalk.bgRed.white.bold(err.message.replace("Error: ", "")))
                        }
                    
                        const dom = new JSDOM(contents);
                        
                        /**
                         * A string of the JSON data from the bottom of the <body> in the lighthouse report html
                         * 
                         * @var {string} theJSON
                         */
                        let theJSON = dom.window.document.querySelectorAll("script")[1].innerHTML.replace("window.__LIGHTHOUSE_JSON__ = ", "")
                        
                        /**
                         * Remove the ";" at the end of the JSON string so we can parse it into an object
                         */
                        theJSON = theJSON.substring(0, theJSON.length - 1);
                    
                        /**
                         * The parsed version of the JSON string from above
                         * 
                         * @var {object} parsedJSON
                         */
                        const parsedJSON = JSON.parse(theJSON);
                    
                        /**
                         * If --verbose was passed in add some padding between the last line of the lighthouse
                         * logs and the first line of the test results
                         */
                        if(args.verbose) {
                            console.log("");
                        }

                        /**
                         * Logging the results of the lighthouse test
                         */
                        let notes = `${chalk.cyan.bold("Notes:")}\n`;
                        const t = new easyTable;
                        
                        resultsSpinner.stop().clear();
                        console.log(`${chalk.cyan.bold("\nGoogle Lighthouse Report")}: ${parsedJSON.url}\nAll scores are out of 100. For more details on the contents of each section of this report please check out the full report at ${chalk.cyan.bold.underline(path.resolve(`./report-${unixTimeStamp}.html`))}.\n`);
                    
                        parsedJSON.reportCategories.forEach(el => {
                    
                            /**
                             * The scores for each category include decimal values, we don't really need 
                             * to be that precise, so we're rounding up to the closes whole number
                             */
                            let score = Math.ceil(el.score);
                    
                            if(el.score >= ratings.pass) {
                    
                                /** Highlight passing scores green and bold */
                                score = chalk.green.bold(score);
                    
                            } else if(el.score > ratings.fail && el.score <= ratings.pass) {
                    
                                /** Highlight average scores yellow and bold */
                                score = chalk.yellow.bold(score);
                                notes = `${notes}* Your score for the ${chalk.bgYellow.black.bold(`"${el.name}" metric needs improvement`)}. Please consult the ${chalk.cyan.bold.underline(`report-${unixTimeStamp}.html`)} file generated for a detailed breakdown on what to improve.\n`;
                    
                            } else if(el.score <= ratings.fail) {
                                
                                /** Highlight failing scores red and bold */
                                score = chalk.red.bold(score);
                                notes = `${notes}* Your score for the ${chalk.bgRed.white.bold(`"${el.name}" metric is poor`)}. Please consult the ${chalk.cyan.bold.underline(`report-${unixTimeStamp}.html`)} file generated for a detailed breakdown on how to improve it.\n`;
                            }
                    
                            t.cell("Score", score);
                            t.cell("Metric", el.name);
                            t.newRow();
                        });

                        console.log(t.toString());
                        console.log(notes);

                        /**
                         * Get the result of the "no-vulnerable-libraries" audit under the "Best Practices" section
                         */
                        let vulnerabilities = parsedJSON.reportCategories[3].audits[9].result;
                    
                        /** If there are in fact vulnerable JS libraries in the passed in site let the user now */
                        if(!vulnerabilities.score) {
                            console.log(`${chalk.cyan.bold("Included front-end JavaScript libraries with known security vulnerabilities:")}`);
                            console.log(chalk.bgRed.bold.white(vulnerabilities.displayValue) + "\n");
                            
                            const vulnTable = new easyTable;
                            
                            vulnerabilities.extendedInfo.vulnerabilities.forEach(el => {
                                let lib = `${el.name}@${el.version}`;
                                let vulnCount = el.vulnCount;
                                let url = el.pkgLink;
                                let sev = el.highestSeverity;

                                if(el.highestSeverity === "Medium") {
                                    lib = chalk.yellow.bold(lib);
                                    vulnCount = chalk.yellow.bold(vulnCount);
                                    url = chalk.yellow.bold.underline(el.pkgLink);
                                    sev = chalk.yellow.bold(sev);
                                } else if(el.highestSeverity === "High") {
                                    lib = chalk.red.bold(lib);
                                    vulnCount = chalk.red.bold(vulnCount);
                                    url = chalk.red.bold.underline(url);
                                    sev = chalk.red.bold(sev);
                                }

                                vulnTable.cell("Library Version", lib);
                                vulnTable.cell("Vulnerability Count", vulnCount);
                                vulnTable.cell("Highest Severity", sev);
                                vulnTable.cell("URL", url);
                                vulnTable.newRow();
                            });
                            
                            console.log(vulnTable.toString());
                        }

                    });
                    
                } else {
                    /** 
                     * If the URL passed in was not a localhost URL then proceed to run an
                     * observatory test before formatting the results
                     */

                    /**
                     * Change the spinner to reflect that we are now going to 
                     * get the observatory data
                     */
                    if(!args.verbose) {
                        spinner.stop().clear();

                        obsSpinner = ora({
                            text: "Running observatory tests...",
                            spinner: "moon",
                            color: "green"
                        });
        
                        obsSpinner.start();
                    }

                    /** Format URL to pass to observatory */
                    const domainOnlyURL = urlLib.domainOnlyURL(url);

                    /** Run the the observatory tests */
                    shellExec(`observatory ${domainOnlyURL} --format=json &>report-${unixTimeStamp}-observatory.json`).then(() => {
                        fs.readFile(`report-${unixTimeStamp}-observatory.json`, "utf8", (err, data) => {
                            if(err) {
                                console.log(chalk.bgRed.white.bold(err.message.replace("Error: ", "")))
                            }

                            if(data.includes("observatory [ERROR]")){
                                obsSpinner.stop().clear();
                            
                                const errMsg = data.replace("observatory [ERROR] ", "").replace("Error: ", "");
                                console.log(chalk.bgRed.white.bold(`[ERROR] ${errMsg}`));
                            } else {
                                shellExec(`observatory ${domainOnlyURL} --format=csv &>report-${unixTimeStamp}-observatory.txt`).then(() => {
                                    obsSpinner.stop().clear();

                                    const resultsSpinner = ora({
                                        text: "Formatting results...",
                                        spinner: "earth",
                                        color: "green"
                                    });

                                    resultsSpinner.start();

                                    /**
                                     * The result of the test is an html file that we can present the user with so they can read up on they
                                     * can improve their site. But we need to know what scores they got in each category without having to
                                     * scrape the html of the report or re-run the report with json output this time. Turns out the json results 
                                     * are saved in a script tag at the bottom of the <body> of the html of the report so we're just invoking an 
                                     * instance of JSDOM to parse that JSON so we can pull out the info we need.
                                     */
                                    fs.readFile(`report-${unixTimeStamp}.html`, "utf8", (err, contents) => {

                                        if(err) {
                                            console.log(chalk.bgRed.white.bold(err.message.replace("Error: ", "")))
                                        }
                                    
                                        const dom = new JSDOM(contents);
                                        
                                        /**
                                         * A string of the JSON data from the bottom of the <body> in the lighthouse report html
                                         * 
                                         * @var {string} theJSON
                                         */
                                        let theJSON = dom.window.document.querySelectorAll("script")[1].innerHTML.replace("window.__LIGHTHOUSE_JSON__ = ", "")
                                        
                                        /**
                                         * Remove the ";" at the end of the JSON string so we can parse it into an object
                                         */
                                        theJSON = theJSON.substring(0, theJSON.length - 1);
                                    
                                        /**
                                         * The parsed version of the JSON string from above
                                         * 
                                         * @var {object} parsedJSON
                                         */
                                        const parsedJSON = JSON.parse(theJSON);
                                    
                                        /**
                                         * If --verbose was passed in add some padding between the last line of the lighthouse
                                         * logs and the first line of the test results
                                         */
                                        if(args.verbose) {
                                            console.log("");
                                        }
                                    
                                        /**
                                         * Logging the results of the lighthouse test
                                         */
                                        let notes = `${chalk.cyan.bold("Notes:")}\n`;
                                        const t = new easyTable;
                                        
                                        resultsSpinner.stop().clear();
                                        console.log(`${chalk.cyan.bold("\nGoogle Lighthouse Report")}: ${parsedJSON.url}\nAll scores are out of 100. For more details on the contents of each section of this report please check out the full report at ${chalk.cyan.bold.underline(path.resolve(`./report-${unixTimeStamp}.html`))}.\n`);
                                    
                                        parsedJSON.reportCategories.forEach(el => {
                                    
                                            /**
                                             * The scores for each category include decimal values, we don't really need 
                                             * to be that precise, so we're rounding up to the closes whole number
                                             */
                                            let score = Math.ceil(el.score);
                                    
                                            if(el.score >= ratings.pass) {
                                    
                                                /** Highlight passing scores green and bold */
                                                score = chalk.green.bold(score);
                                    
                                            } else if(el.score > ratings.fail && el.score <= ratings.pass) {
                                    
                                                /** Highlight average scores yellow and bold */
                                                score = chalk.yellow.bold(score);
                                                notes = `${notes}* Your score for the ${chalk.bgYellow.black.bold(`"${el.name}" metric needs improvement`)}. Please consult the ${chalk.cyan.bold.underline(`report-${unixTimeStamp}.html`)} file generated for a detailed breakdown on what to improve.\n`;
                                    
                                            } else if(el.score <= ratings.fail) {
                                                
                                                /** Highlight failing scores red and bold */
                                                score = chalk.red.bold(score);
                                                notes = `${notes}* Your score for the ${chalk.bgRed.white.bold(`"${el.name}" metric is poor`)}. Please consult the ${chalk.cyan.bold.underline(`report-${unixTimeStamp}.html`)} file generated for a detailed breakdown on how to improve it.\n`;
                                            }
                                    
                                            t.cell("Score", score);
                                            t.cell("Metric", el.name);
                                            t.newRow();
                                        });

                                        console.log(t.toString());
                                        console.log(notes);
                                    
                                        /**
                                         * Get the result of the "no-vulnerable-libraries" audit under the "Best Practices" section
                                         */
                                        let vulnerabilities = parsedJSON.reportCategories[3].audits[9].result;
                                    
                                        /** If there are in fact vulnerable JS libraries in the passed in site let the user now */
                                        if(!vulnerabilities.score) {
                                            console.log(`${chalk.cyan.bold("Included front-end JavaScript libraries with known security vulnerabilities:")}`);
                                            console.log(chalk.bgRed.bold.white(vulnerabilities.displayValue) + "\n");
                                            
                                            const vulnTable = new easyTable;
                                            
                                            vulnerabilities.extendedInfo.vulnerabilities.forEach(el => {
                                                let lib = `${el.name}@${el.version}`;
                                                let vulnCount = el.vulnCount;
                                                let url = el.pkgLink;
                                                let sev = el.highestSeverity;

                                                if(el.highestSeverity === "Medium") {
                                                    lib = chalk.yellow.bold(lib);
                                                    vulnCount = chalk.yellow.bold(vulnCount);
                                                    url = chalk.yellow.bold.underline(el.pkgLink);
                                                    sev = chalk.yellow.bold(sev);
                                                } else if(el.highestSeverity === "High") {
                                                    lib = chalk.red.bold(lib);
                                                    vulnCount = chalk.red.bold(vulnCount);
                                                    url = chalk.red.bold.underline(url);
                                                    sev = chalk.red.bold(sev);
                                                }

                                                vulnTable.cell("Library Version", lib);
                                                vulnTable.cell("Vulnerability Count", vulnCount);
                                                vulnTable.cell("Highest Severity", sev);
                                                vulnTable.cell("URL", url);
                                                vulnTable.newRow();
                                            });
                                            
                                            console.log(vulnTable.toString());
                                        }
                                        
                                        /** Start the reading of the json file of the results of the observatory test */
                                        fs.readFile(`report-${unixTimeStamp}-observatory.json`, "utf8", (err, data) => {
                                            if(err) {
                                                console.log(chalk.bgRed.white.bold(err.message.replace("Error: ", "")))
                                            }

                                        const lines = data.split("\n"),
                                                filteredLines = lines.filter(line => !line.includes("observatory [WARN]")),
                                                cleanData = filteredLines.join("\n"),
                                                parsedData = JSON.parse(cleanData),
                                                obsTable = new easyTable,
                                                detailTable = new easyTable;

                                            console.log(`${chalk.cyan.bold("\nMozilla Observatory Security Report: ")} ${domainOnlyURL}\n`);

                                            for(let prop in parsedData) {
                                                const test = parsedData[prop];

                                                obsTable.cell("Score", test.score_modifier);
                                                obsTable.cell("Rule", chalk.red.bold(test.name))
                                                obsTable.cell("Description", test.score_description);
                                                obsTable.cell("Pass?", (test.pass ? chalk.green.bold("\u2714") : chalk.red.bold("\u2718")));
                                                obsTable.newRow();

                                                detailTable.cell("Rule", chalk.red.bold(test.name));
                                                detailTable.cell("Result", test.result);
                                                detailTable.newRow();
                                            }
                                            
                                            console.log(chalk.cyan.bold("Overview"));
                                            console.log(obsTable.toString());
                                            console.log(chalk.cyan.bold("More Details"));
                                            console.log(detailTable.toString());

                                            fs.readFile(`report-${unixTimeStamp}-observatory.txt`, "utf8", (err, data) => {
                                                if(err) {
                                                    console.log(chalk.bgRed.white.bold(err.message.replace("Error: ", "")))
                                                }

                                                var lines = data.split("\n"),
                                                    filteredLines = lines.filter(line => (line.includes("Score: ") || line.includes("Grade: "))),
                                                    cleanData = filteredLines.map(line => {
                                                        if(line.includes("Score: ")){
                                                            return line.replace("Score: ", "");
                                                        } else {
                                                            return line.replace("Grade: ", "");
                                                        }
                                                    });

                                                const observatoryURL = `https://observatory.mozilla.org/analyze.html?host=${domainOnlyURL}`;

                                                console.log(`${chalk.cyan.bold("Score: ")} ${cleanData[0]}\n${chalk.cyan.bold("Grade: ")} ${cleanData[1]}\n`);
                                                console.log(`For more details on the contents of each section of this report please check out the full report at ${chalk.cyan.bold.underline(observatoryURL)}.`);
                                                console.log(`Additionally please consult this page for answered to commonly asked questions about Mozilla's Observatory Security Report ${chalk.cyan.bold.underline("https://observatory.mozilla.org/faq.html")}.\n`);
                                                
                                                /**
                                                 * Remove the generated files since we don't need them anymore
                                                 */
                                                shellExec(`rm -rf report-${unixTimeStamp}-observatory.json report-${unixTimeStamp}-observatory.txt`);
                                            });
                                        });
                                    });
                                });
                            }
                        });
                    });
                }
            });
        }
    }
}