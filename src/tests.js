// Libraries
const path = require("path");
const exec = require("shell-exec"); // used to exec cli commands like lighthouse and observatory
const chalk = require("chalk"); // allows colorful console logs
const ora = require("ora"); // colorful cli spinners
const easyTable = require("easy-table"); // easily output tables in the cli
const unix = require("to-unix-timestamp"); // get the current unix timestamp
const bluebird = require("bluebird"); // library for "promisifying" all functions of a module
const fs = bluebird.promisifyAll(require("fs")); // Promisify thge "fs" module (http://bit.ly/2H77JXE)
const on = require("await-handler") // easily destructure a async/await err and response

// Local Libs
const urlFormatter = require("./helpers/url"); // run simple tests on urls (e.g whether its local or not, get only the domain)
const { 
    logWarning,
    logError,
    formatFileName,
    logMultilineMsg,
    logNewLine,
    formatRuleName
} = require("./helpers/logger"); // logs warnings and errors to the console using chalk.js for pretty errors
const pdf = require("./helpers/pdf"); // generates a pdf from passed in object data and applies it to html templates to create the pdf
const ratings = require("./helpers/ratings")(); // maps a test's score to its grade (e.g. 80 = fail, 70 = average, 60 = fail)

const unixTimeStamp = unix(new Date()); // a unique unix timestamp

// opts: the command line options passed in
// url: url to run test on
async function lighthouse(opts, url) {

    pdf.addData("url", url);

    let cmd = `lighthouse ${url} --chrome-flags="--headless" --quiet --output=html --output-path=./report-${unixTimeStamp}.html`;
    const spinner = ora({
        text: "Running lighthouse tests...",
        spinner: "weather"
    }); 

    // if the user specified the verbose option turn off the "quiet" option in lighthouse
    if(opts.verbose) {
        cmd = `lighthouse ${url} --chrome-flags="--headless" --output=html --output-path=./report-${unixTimeStamp}.html`;
    } else {
        // if the user didn't specify the "verbose" option then we'll show a litle emoji spinner instead while we crunch the numbers
        
        spinner.start();
    }

    const [err, resp] = await on(exec(cmd));

    if(err) {
        spinner.stop().clear();

        logError(err.message);
    }

    spinner.stop().clear();

    // start another spinner while we format the results
    const resultsSpinner = ora({
        text: "Formatting results...",
        spinner: "earth"
    });

    resultsSpinner.start();


    let [fileErr, contents] = await on(fs.readFileAsync(`report-${unixTimeStamp}.html`));
    
    if (fileErr) {
        resultsSpinner.stop().clear();

        logError(err.message.replace("Error: ", ""));
    }

    resultsSpinner.stop().clear();
    
    // convert the buffer obtained as a result to a string
    contents = contents.toString("utf8");

    const scriptRegex = /<script>(.+)<\/script>/g;
    const scriptMatches = scriptRegex.exec(contents);

    // the JSON result of the lighthouse test saved as the second script tag inside the generated lighthouse html file
    const testResult = JSON.parse(scriptMatches[1].substring(0, scriptMatches[1].length - 1).replace("window.__LIGHTHOUSE_JSON__ = ", ""));

    // if the user passed in the "verbose" option add an extra line of padding between the end of the lighthouse logs and and the beginning of our test results
    if(opts.verbose) {
        logNewLine();
    }

    logMultilineMsg([
        `${chalk.cyan.bold("\nGoogle Lighthouse Report")}: ${testResult.url}`,
        `All scores are out of 100. For more details on the contents of each section of this report please check out the full report at ${formatFileName(path.resolve(`./report-${unixTimeStamp}.html`))}.\n`
    ]);

    const table = new easyTable;
    let notes = [`${chalk.cyan.bold("Notes:")}\n`];

    // loop over each category of the lighthouse test and pull out the score and write some notes for each category
    testResult.reportCategories.map(category => {
        let score = Math.ceil(category.score); // round the category score ot the nearest whole number
        let pdfDataObj = {score, class: ""};

        if(category.score >= ratings.pass) {
            score = chalk.green.bold(score);

            pdfDataObj.class = "good";
        } else if(category.score > ratings.fail && category.score <= ratings.pass) {
            score = chalk.yellow.bold(score);
            notes.push(`* Your score for the ${chalk.bgYellow.black.bold(`"${category.name}" metric needs improvement`)}. Please consult the ${formatFileName(`report-${unixTimeStamp}.html`)} file generated for a detailed breakdown on what to improve.`);

            pdfDataObj.class = "ok";
        } else if(category.score <= ratings.fail) {
            score = chalk.red.bold(score);
            notes.push(`* Your score for the ${chalk.bgRed.white.bold(`"${category.name}" metric is poor`)}. Please consult the ${formatFileName(`report-${unixTimeStamp}.html`)} file generated for a detailed breakdown on how to improve it`);

            pdfDataObj.class = "poor";
        }

        pdf.addData(category, pdfDataObj);

        table.cell("Score", score);
        table.cell("Metric", category.name);
        table.newRow();
    });

    console.log(table.toString());
    logMultilineMsg(notes);

    // get the vulnerable libraries being used in the passed in URL
    let vulnerabilities = testResult.reportCategories[3].audits[9].result;

    // if we have any vulnerable libraries used in the passed in url...the test name is "no vulnerable libraries"
    if(!vulnerabilities.score) {

        let vulns = [];
        const vulnTable = new easyTable;

        // add a line of padding between the notes and the vulnerabilities
        logNewLine();

        logMultilineMsg([
            `${chalk.cyan.bold("Included front-end JavaScript libraries with known security vulnerabilities:")}`,
            chalk.bgRed.bold.white(vulnerabilities.displayValue)
        ]);

        // add a line of padding between the number of vulnerabilities header and the vulnerabilites table
        logNewLine();

        vulnerabilities.extendedInfo.vulnerabilities.map(vuln => {
            let lib = `${vuln.name}@${vuln.version}`;
            let vulnCount = vuln.vulnCount;
            let url = vuln.pkgLink;
            let sev = vuln.highestSeverity;

            vulns.push({
                libraryVersion: lib,
                vulnCount,
                highestSeverity: sev,
                url
            });

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

            vulnTable.cell("Library Version", lib);
            vulnTable.cell("Vulnerability Count", vulnCount);
            vulnTable.cell("Highest Severity", sev);
            vulnTable.cell("URL", url);
            vulnTable.newRow();
        });

        console.log(vulnTable.toString());
    }

    // Add a line of padding so that when the all method calls this function there will be space between this output and the next test output
    logNewLine();
}

// opts: the command line options passed in
// url: url to run test on
async function observatory(opts, url) {

    // lets show a little emoji spinner while we run the test
    const spinner = ora({
        text: "Running observatory tests...",
        spinner: "moon"
    }); 

    // if the user passed in a localhost URL we'll simply tell them that observatory doesn't support localhost URLs and then stop execution of the function
    if(urlFormatter.isLocal(url)) {
        logWarning("Localhost URL detected, Mozilla Observatory does not support localhost URLs, aborting test...");

        return;
    }

    spinner.start();

    const [err, resp] = await on(exec(`observatory ${urlFormatter.domainOnlyURL(url)} --format=json &>report-${unixTimeStamp}-observatory.json`));

    if(err) {
        spinner.stop().clear();

        logError(err.message);
    }
    
    // get the data on the various security rules not being followed from the generated JSON file
    let [fileErr, contents] = await on(fs.readFileAsync(`report-${unixTimeStamp}-observatory.json`));

    if(fileErr) {
        spinner.stop().clear();

        logError(err.message);
    }

    contents = contents.toString("utf8");

    // account for errors thrown by the command and innerrantly saved in JSON file
    if(contents.includes("observatory [ERROR]")) {
        spinner.stop().clear();

        logError(contents.replace("observatory [ERROR] ", ""));
    }

    // unfortunately the JSON output we got earlier doesn't include the test's overall score or grade...but this txt file will...
    let [txtErr, txtContents] = await on(exec(`observatory ${urlFormatter.domainOnlyURL(url)} --format=csv &>report-${unixTimeStamp}-observatory.txt`));

    if(txtErr) {
        spinner.stop().clear();

        logError(txtErr.message);
    }

    spinner.stop().clear();

    // create another little emoji spinner to display to the user while we parse all these test results
    const resultsSpinner = ora({
        text: "Formatting results...",
        spinner: "earth"
    });
    resultsSpinner.start();

    let [jsonErr, jsonContents] = await on(fs.readFileAsync(`report-${unixTimeStamp}-observatory.json`));

    if(jsonErr) {
        resultsSpinner.stop().clear();

        logError(err.message);
    }

    jsonContents = jsonContents.toString("utf8");

    resultsSpinner.stop().clear();
    const lines = jsonContents.split("\n"),
        filteredLines = lines.filter(line => !line.includes("observatory [WARN]")),
        cleanData = filteredLines.join("\n"),
        parsedData = JSON.parse(cleanData),
        obsTable = new easyTable;

    console.log(`${chalk.cyan.bold("\nMozilla Observatory Security Report: ")} ${url}`);

    // add a line of padding between the test header and the results table
    logNewLine();
    
    // loop through each rule that the passed in URL didn't comply too
    for(let prop in parsedData) {
        const test = parsedData[prop];

        obsTable.cell("Score", test.score_modifier);
        obsTable.cell("Rule", chalk.red.bold(formatRuleName(test.name)));
        obsTable.cell("Description", test.score_description);
        obsTable.cell("Pass?", (test.pass ? chalk.green.bold("\u2714") : chalk.red.bold("\u2718")));
        obsTable.newRow();
    }

    console.log(obsTable.toString());

    let [txtReadErr, txtReadContents] = await on(fs.readFileAsync(`report-${unixTimeStamp}-observatory.txt`));

    if(txtReadErr) {
        logError(err.message);
    }

    txtReadContents = txtReadContents.toString("utf8");

    var txtLines = txtReadContents.split("\n"),
        txtfilteredLines = txtLines.filter(line => (line.includes("Score: ") || line.includes("Grade: "))),
        txtCleanData = txtfilteredLines.map(line => {
            if(line.includes("Score: ")){
                return line.replace("Score: ", "");
            } else {
                return line.replace("Grade: ", "");
            }
        });

    logMultilineMsg([
        `${chalk.cyan.bold("Score: ")} ${txtCleanData[0]}`,
        `${chalk.cyan.bold("Grade: ")} ${txtCleanData[1]}`
    ]);

    // add a line of padding betwen the score and the more details messages
    logNewLine();

    console.log(`For more details on the contents of each section of this report please check out the full report at ${formatFileName(`https://observatory.mozilla.org/analyze.html?host=${urlFormatter.domainOnlyURL(url)}`)}.`);
    console.log(`Additionally please consult this page for answered to commonly asked questions about Mozilla's Observatory Security Report ${formatFileName("https://observatory.mozilla.org/faq.html")}.`);

    // add a line of padding between the end of the test output and the begging of the next line in the cli
    logNewLine();
    
    // delete the files we pulled all this data in so as not to bloat the users system with unecessary files
    exec(`rm -rf report-${unixTimeStamp}-observatory.json report-${unixTimeStamp}-observatory.txt`);
}

// opts: the command line options passed in
// url: url to run test on
async function pagespeed(opts, url) {
    console.log(opts, url, "pagespeed");
}

// opts: the command line options passed in
// url: url to run test on
async function all(opts, url) {

    let [lerr, lresp] = await on(lighthouse(opts, url));
    let [oerr, oresp] = await on(observatory(opts, url));

    if(lerr) {
        logError(lerr.message);
    } else if(oerr) {
        logError(oerr.message);
    }
}

module.exports = {
    lighthouse,
    observatory,
    pagespeed,
    all
}