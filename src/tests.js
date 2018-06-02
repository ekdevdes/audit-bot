// Libraries
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");

// Allows colorful console logs
const chalk = require("chalk");

// Colorful cli spinners
const ora = require("ora");

// Easily output tables in the cli
const easyTable = require("easy-table");

// Get the current unix timestamp
const unix = require("to-unix-timestamp");

// Local Libs
// Run simple tests on urls (e.g whether its local or not, get only the domain)
const urlFormatter = require("./helpers/url");

 // Logs warnings and errors to the console using chalk.js for pretty errors
const { 
    logWarning,
    logError,
    formatFileName,
    logMultilineMsg,
    logNewLine,
    formatRuleName
} = require("./helpers/logger");

// Generates a pdf from passed in object data and applies it to html templates to create the pdf
const pdf = require("./helpers/pdf");

// Maps a test's score to its grade (e.g. 80 = fail, 70 = average, 60 = fail)
const ratings = require("./helpers/ratings")();


// A unique unix timestamp
const unixTimeStamp = unix(new Date());


async function lighthouse({ verbose, outputPath }, url) {
    pdf.addData("url", url);

    const spinner = ora({
        text: "Running lighthouse tests...",
        spinner: "weather"
    })

    // If they don't want verbose output then we just start the spinner we created above
    if(!verbose) {
        spinner.start()
    }

    const cmd = spawn('lighthouse', [
        url,
        '--chrome-flags=--headless',
        (verbose) ? '' : '--quiet',
        '--output=html',
        '--output=json',
        `--output-path=./${unixTimeStamp}`
    ])

    cmd.stdout.on('data', (data) => {
        spinner.stop()

        if(verbose) {
            console.log(data.toString())
        }
    })
    
    cmd.stderr.on('data', (data) => {
        spinner.stop()

        logError(data.toString())
    })

    cmd.on('close', (code) => {
        spinner.stop()

        pdf.addData("pathToLighthouseReport", path.resolve(`${unixTimeStamp}.report.html`));

        // Start another spinner while we format the results
        const resultsSpinner = ora({
            text: "Formatting results...",
            spinner: "earth"
        });

        resultsSpinner.start();

        fs.readFile(`${unixTimeStamp}.report.json`, 'utf8', (err, data) => {
            resultsSpinner.stop()
            
            if(err) {
                logError(err.message)

                return;
            }

            // Parse the JSON we got from the JSON file that the lighthouse test outputted
            // into a JSON object (from the string that it currently is)
            const lhdata = JSON.parse(data);

            // if the user passed in the "verbose" option add an extra line of padding between the end of the lighthouse logs and and the beginning of our test results
            if(verbose) {
                logNewLine();
            }

            const colorizer = (num, text = "") => {
                // if no text was passed in lets output the number, otherwise we'll output the text
                const output = (text === "") ? num : text                

                if(num >= ratings.pass) {
                    return chalk.green.bold(output)
                } else if(num > ratings.fail && num <= ratings.pass) {
                    return chalk.yellow.bold(output)
                } else if(num <= ratings.fail) {
                    return chalk.red.bold(output);
                }
            }

            logMultilineMsg([
                `${chalk.cyan.bold("\nGoogle Lighthouse Report")}: ${lhdata.url}\n`,
                `All scores are out of 100. For more details on the contents of each section of this report please check out the full report at ${formatFileName(path.resolve(`./${unixTimeStamp}.report.html`))}.\n`
            ]);

            const table = new easyTable;
            let notes = [`${chalk.cyan.bold("Notes:")}\n`];
            let metrics = [];

            // loop over each category of the lighthouse test and pull out the score and write some notes for each category
            lhdata.reportCategories.map(category => {
                let score = Math.ceil(category.score); // round the category score ot the nearest whole number
                let pdfDataObj = {score, class: ""};
                let metricDataObj = {name: category.name, grade: "", class: "", slug: category.name.toLowerCase().replace(/ /g, "-")};

                if(category.score >= ratings.pass) {
                    score = chalk.green.bold(score);

                    pdfDataObj.class = "good";
                } else if(category.score > ratings.fail && category.score <= ratings.pass) {
                    score = chalk.yellow.bold(score);
                    notes.push(`* Your score for the ${chalk.bgYellow.black.bold(`"${category.name}" metric needs improvement`)}. Please consult the ${formatFileName(`${unixTimeStamp}.report.html`)} file generated for a detailed breakdown on what to improve.`);

                    pdfDataObj.class = "ok";
                    metricDataObj.class = "ok";
                    metricDataObj.grade = "needs improvement";
                } else if(category.score <= ratings.fail) {
                    score = chalk.red.bold(score);
                    notes.push(`* Your score for the ${chalk.bgRed.white.bold(`"${category.name}" metric is poor`)}. Please consult the ${formatFileName(`${unixTimeStamp}.report.html`)} file generated for a detailed breakdown on how to improve it.`);

                    pdfDataObj.class = "poor";
                    metricDataObj.class = "poor";
                    metricDataObj.grade = "is poor";
                }

                if(category.score < ratings.pass) {
                    metrics.push(metricDataObj);
                }

                pdf.addData(category.id.replace(/-/g, ""), pdfDataObj);

                table.cell("Score", score);
                table.cell("Metric", category.name);
                table.newRow();
            });

            pdf.addData("metrics", metrics);

            console.log(table.toString());
            logMultilineMsg(notes);

            // get the vulnerable libraries being used in the passed in URL
            let vulnerabilities = lhdata.reportCategories[3].audits[9].result;

            // if we have any vulnerable libraries used in the passed in url...the test name is "no vulnerable libraries"
            if(!vulnerabilities.score) {

                const vulnTable = new easyTable;

                // add a line of padding between the notes and the vulnerabilities
                logNewLine();

                logMultilineMsg([
                    `${chalk.cyan.bold("Included front-end JavaScript libraries with known security vulnerabilities:")}`,
                    chalk.bgRed.bold.white(vulnerabilities.displayValue)
                ]);

                // add a line of padding between the number of vulnerabilities header and the vulnerabilites table
                logNewLine();

                let vulns = [];

                vulnerabilities.extendedInfo.vulnerabilities.map(vuln => {
                    let lib = `${vuln.name}@${vuln.version}`;
                    let vulnCount = vuln.vulnCount;
                    let url = vuln.pkgLink;
                    let sev = vuln.highestSeverity;
                    
                    let vulnDataObj = {
                        libraryVersion: lib,
                        vulnCount,
                        highestSeverity: sev,
                        url
                    };

                    if(vuln.highestSeverity === "Medium") {
                        lib = chalk.yellow.bold(lib);
                        vulnCount = chalk.yellow.bold(vulnCount);
                        url = chalk.yellow.bold.underline(vuln.pkgLink);
                        sev = chalk.yellow.bold(sev);
                    } else if(vuln.highestSeverity === "High") {
                        lib = chalk.red.bold(lib);
                        vulnCount = chalk.red.bold(vulnCount);
                        url = chalk.red.bold.underline(url);
                        sev = chalk.red.bold(sev);
                    }

                    vulns.push(vulnDataObj);

                    vulnTable.cell("Library Version", lib);
                    vulnTable.cell("Vulnerability Count", vulnCount);
                    vulnTable.cell("Highest Severity", sev);
                    vulnTable.cell("URL", url);
                    vulnTable.newRow();
                });

                pdf.addData("vulns", {
                    total: vulns.length,
                    vulns
                });
                console.log(vulnTable.toString());
            }

            // Add a line of padding so that when the all method calls this function there will be space between this output and the next test output
            logNewLine();

            console.log(chalk.cyan.bold("Performance Summary"));

            // Add a line of padding so that when the all method calls this function there will be space between this output and the next test output
            logNewLine();

            const perfTable = new easyTable;

            // Gather the page performance metrics
            let perfData = [
                lhdata.audits["time-to-first-byte"],
                lhdata.audits["first-meaningful-paint"], 
                lhdata.audits["first-interactive"],
                lhdata.audits["consistently-interactive"],
                lhdata.audits["speed-index-metric"], 
                lhdata.audits["estimated-input-latency"]
            ]

            // Loop over the performance data and extract only what we want
            perfData = perfData.map(item => ({
                name: item.name,
                metric: item.description,
                time: item.displayValue,
                score: item.score,
                scoringMode: item.scoringMode,
                helpText: item.helpText.replace("[Learn more]", "").replace(".", "")
            }))

            perfData.forEach(item => {
                perfTable.cell("Score", (item.scoringMode === "numeric" && item.name !== "time-to-first-byte") ? colorizer(item.score) : "–")
                perfTable.cell("Time", (item.name === "time-to-first-byte") ? item.time : colorizer(item.score, item.time))
                perfTable.cell("Metric", (item.name === "time-to-first-byte") ? item.metric : colorizer(item.score, item.metric))
                perfTable.newRow()
            })

            console.log(perfTable.toString())

            // Add a line of padding so that when the all method calls this function there will be space between this output and the next test output
            logNewLine();

            perfData.forEach(item => {
                logMultilineMsg([
                    chalk.cyan.bold(item.metric),
                    `${item.helpText}\n`
                ]);
            });

            // gather "link-blocking-first-paint" and "script-blocking-first-paint" from lhdata.reportCategories (where name = "performance") and
            // id under .audits = "link-blocking-first-paint" or "script-blocking-first-paint"
            const perfHints = [

            ]

            fs.unlink(`${unixTimeStamp}.report.json`, (err) => {})

            if(typeof outputPath === "string" && outputPath !== "") {
                console.log("Writing PDF of lighthouse report...\n")
                
                pdf.generate("lighthouse", outputPath)
                    .then(data => spinner.stop())
                    .catch(err => {
                        spinner.stop()

                        logError(err)
                    });
            }
        })
    })
}

// opts: the command line options passed in
// url: url to run test on
async function observatory({ verbose, outputPath }, url) {
    const table = new easyTable;

    pdf.addData("url", url);
    pdf.addData("host", urlFormatter.domainOnlyURL(url));

    // lets show a little emoji spinner while we run the test
    const spinner = ora({
        text: "Running observatory tests...",
        spinner: "moon"
    }); 

    // if the user passed in a localhost URL we'll simply tell them that observatory doesn't support localhost URLs and then stop execution of the function
    if(urlFormatter.isLocal(url)) {
        logError("[TEST ABORTED] Mozilla Observatory does not support localhost URLs.");

        return;
    }

    const cmd = spawn('observatory', [
        urlFormatter.domainOnlyURL(url),
        '--format=json'
    ])

    cmd.stdout.on('data', (data) => {
        // Parse the output as a string (its currently a Buffer)
        data = data.toString()
        let dataWithOverallScore = "";

        // Account for errors thrown by the command and innerrantly saved in JSON file
        if(data.includes("observatory [ERROR]")) {
            spinner.stop()

            logError(data.replace("observatory [ERROR] ", ""));

            return;
        }
        
        const obsDataWithoutOverallScore = JSON.parse(data)
        const overallScoreCMD = spawn('observatory', [
            urlFormatter.domainOnlyURL(url),
            '--format=csv'
        ])

        overallScoreCMD.stdout.on('data', (data) => (dataWithOverallScore += data.toString()))

        overallScoreCMD.stdout.on('close', () => {
            data = JSON.parse(data)

            spinner.stop()

            console.log(`${chalk.cyan.bold("\nMozilla Observatory Security Report: ")} ${urlFormatter.domainOnlyURL(url)}\n`);

            let rules = []

            for(let testName in data) {
                const testData = data[testName]

                table.cell("Score", testData.score_modifier);
                table.cell("Rule", chalk.red.bold(formatRuleName(testData.name)));
                table.cell("Description", testData.score_description);
                table.cell("Pass?", (testData.pass ? chalk.green.bold("\u2714") : chalk.red.bold("\u2718")));
                table.newRow();

                rules.push({
                    score: testData.score_modifier,
                    slug: testData.name,
                    desc: testData.score_description,
                    isPassed: testData.pass,
                    class: (testData.pass ? "green" : "red")
                });
            }

            pdf.addData("rules", rules);
            console.log(table.toString());

            const [score, grade] = dataWithOverallScore.split("\n")
                .filter(line => (line.includes("Score: ") || line.includes("Grade: ")))
                .map(line => {
                    if(line.includes("Score: ")){
                        return line.replace("Score: ", "");
                    } else {
                        return line.replace("Grade: ", "");
                    }
                })
            
            pdf.addData("score", score);
            pdf.addData("grade", grade);

            logMultilineMsg([
                `${chalk.cyan.bold("Score: ")} ${score}`,
                `${chalk.cyan.bold("Grade: ")} ${grade}`
            ]);
        
            // add a line of padding betwen the score and the more details messages
            logNewLine();
        
            console.log(`For more details on the contents of each section of this report please check out the full report at ${formatFileName(`https://observatory.mozilla.org/analyze.html?host=${urlFormatter.domainOnlyURL(url)}`)}.`);
            console.log(`Additionally please consult this page for answered to commonly asked questions about Mozilla's Observatory Security Report ${formatFileName("https://observatory.mozilla.org/faq.html")}.`);
        
            // add a line of padding between the end of the test output and the begging of the next line in the cli
            logNewLine();

            if(typeof outputPath === "string" && outputPath !== "") {
                console.log("Writing PDF of observatory report...\n")

                pdf.generate("observatory", outputPath)
                    .then(data => spinner.stop())
                    .catch(err => {
                        spinner.stop()

                        logError(err)
                    });
            }
        })

        overallScoreCMD.stderr.on('data', (data) => {
            spinner.stop()

            logError(data.toString())

            return;
        })
    })

    cmd.stderr.on('data', (data) => {
        spinner.stop()
        
        logError(data.toString())
    })
}

// opts: the command line options passed in
// url: url to run test on
async function pagespeed(opts, url) {

}

// opts: the command line options passed in
// url: url to run test on
async function all(opts, url) {

    await lighthouse(opts, url);
    await observatory(opts, url);

}

module.exports = {
    lighthouse,
    observatory,
    all
}