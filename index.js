#!/usr/bin/env node

/**
 * Notes:
 * 
 * Local urls don't work for observatory. 
 * 
 * TODO: Add the ability for a user to have a report.json file in the root of their project (optional)
 * that when present would read the local, prod and test urls from so instead of having to pass the local, test
 * and prod url in every time you could do something like "report --prod --verbose" or "report --local --verbose" or 
 * "report --test --verbose". The report.json can also allow config of the passing/average/fail req'd scores
 * 
 * TODO: look into how to include the result of the htbridge.com third party test because it has things like PCI-DSS 
 * and HIPAA compliance, as well as Heartbleed vulnerabilities and other popular vulnerabilities and how vulnerable 
 * you are to them. If not possible to output in terminal maybe the web test results link will have it and
 * I can point the user to it
 * 
 * TODO: Reformat the lighthouse test results to look more like observatory test results
 * TODO: Add in help docs
 * TODO: Make the "only" option respected
 * TODO: Add an error message if no url is passed in
 * TODO: Improve the formatting of the url passed to observatory got this error when passing in https://www.google.com/:
 * 
 * [ERROR] Unable to get result. Host:www.google.com/ Error:invalid-hostname.
 * 
 * TODO: Format the observatory results like the lighthouse results with the different colored scores
 */

const fs = require("fs");

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
 * The library we're using to pull out and parse the passed in args to the command
 * 
 * @var {object} argv
 * @see https://www.npmjs.com/package/yargs
 */
const argv = require('yargs').argv;

// -----------------------------------------------
// Arguments (argv)
// -----------------------------------------------
// argv.verbose: [Boolean] Whether or not verbose lighthouse test result logging should be enabled (default: false)
// argv.only: [String] When passed in only runs the passed in kind of test (options are "lighthouse" and "observatory") (no default value)
// argv.help: [Boolean] When true, outputs the command's help screen
// -----------------------------------------------

/**
 * Gather the raw url passed into the commmand and the url without the protocol into
 * one object to use later. Lighthouse doesn't care if the url has a protocol but observatory
 * doesn't like when the url has a protocol
 * 
 * @var {object} url
 */
const url = {
    raw: argv._[0],
    noProto: argv._[0].split("//")[1]
};

/**
 * What scores for each metric of each test will result in a pass, fail or average result
 * 
 * @var {obj} ratings
 */
const ratings = {
    pass: 80,
    average: 70,
    fail: 69
}

let lighthouseCommand = `lighthouse ${url.raw} --chrome-flags="--headless" --quiet --output=html --output-path=./report.html`;

/** Show the log from the lighthouse command if --verbose is passed in */
if(argv.verbose) {
    lighthouseCommand = `lighthouse ${url.raw} --chrome-flags="--headless" --output=html --output-path=./report.html`;
}

/**
 * If we don't care about verbose output give the user some feedback that we are doing something and
 * its just taking lighthouse a good few seconds to come back with the result
 */
let interval;

if(!argv.verbose) {

    /**
     * Logging the message this way allows us to append a "." to the end of the message for each half second the
     * user waits for
     */
    let msg = "Running through tests. A few seconds please.";

    console.log(msg);

    interval = setInterval(() => {
        msg = `${msg}.`;

        console.clear();
        console.log(msg);
    }, 500);
}

/**
 * Start the lighthouse reporting process, then do stuff after its finished.
 */
shellExec(lighthouseCommand).then(() => {

  /**
   * If we don't care about verbose output remove what we logged earlier about how we are waiting for 
   * the lighthouse test results since we have the resuls now
   */
  if(!argv.verbose){
    /** Invalidate the interval/timer */
    clearInterval(interval);
    console.clear();
  }

  /**
   * The result of the test is an html file that we can present the user with so they can read up on they
   * can improve their site. But we need to know what scores they got in each category without having to
   * scrape the html of the report or re-run the report with json output this time. Turns out the json results 
   * are saved in a script tag at the bottom of the <body> of the html of the report so we're just invoking an 
   * instance of JSDOM to parse that JSON so we can pull out the info we need.
   * 
   * Also we're assuming that the report was outputted to the current folder. Doesn't that mean the command's folder
   * or the directory the user ran the command in?? I'll have to find out
   */
  fs.readFile("report.html", "utf8", (err, contents) => {
    
    if(err) {
        throw err;
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
    if(argv.verbose) {
        console.log("");
    }

    /**
     * Logging the results of the lighthouse test
     */
    let notes = `\n${chalk.blue.bold("Notes:")}\n`;

    console.log(`${chalk.blue.bold("Google Lighthouse Report")}: ${parsedJSON.url}\nAll scores are out of 100.\n`);
    console.log(`${chalk.blue.bold("Score\tMetric")}`);

    parsedJSON.reportCategories.forEach(el => {

        /**
         * The scores for each category include decimal values, we don't really need 
         * to be that precise, so we're rounding down to the closes whole number
         */
        let score = Math.floor(el.score);

        if(el.score >= ratings.pass) {

            /** Highlight passing scores green and bold */
            score = chalk.green.bold(score);

        } else if(el.score > ratings.fail && el.score <= ratings.pass) {

            /** Highlight average scores yellow and bold */
            score = chalk.yellow.bold(score);
            notes = `${notes}* Your score for the "${el.name}" metric needs improvment, please consult the report.html file generated for a detailed breakdown on what to improve.\n`;

        } else if(el.score <= ratings.fail) {
            
            /** Highlight failing scores red and bold */
            score = chalk.red.bold(score);
            notes = `${notes}* Your score for the "${el.name}" metric is poor, please consult the report.html file generated for a detailed breakdown on how to improve it.\n`;
        }

        console.log(`${score}\t${el.name}`);
    });

    /** Output the notes to the console now that we've gathered all of them into one string */
    console.log(`${notes}\n`);

    /**
     * Get the result of the "no-vulnerable-libraries" audit under the "Best Practices" section
     */
    let vulnerabilities = parsedJSON.reportCategories[3].audits[9].result;

    /** If there are in fact vulnerable JS libraries in the passed in site let the user now */
    if(!vulnerabilities.score) {
        console.log(`${chalk.blue.bold("Included front-end JavaScript libraries with known security vulnerabilities:")}\n`);
        console.log(vulnerabilities.displayValue + "\n");
        console.log(`${chalk.blue.bold("Library Version")}\t${chalk.blue.bold("Vulnerability Count")}\t${chalk.blue.bold("Highest Severity")}\t${chalk.blue.bold("Url")}`);
        
        vulnerabilities.extendedInfo.jsLibs.forEach(el => {
            console.log(`${el.detectedLib.text}\t${el.vulnCount}\t\t\t${el.highestSeverity}\t\t\t${el.pkgLink}`);
        });

        /**
         * Add an extra line between the end our vulnerabilities table and the beginning of the observatory results
         */
        console.log("\n");
    }

    /**
     * Run the observatory report
     */
    console.log(chalk.blue.bold("Mozilla Observatory Security Report"));
    shellExec(`observatory ${url.noProto} --format=report`);
  });

});