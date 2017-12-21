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

// if we don't care about verbose output give the user some feedback that we are doing something
// its just that the lighthouse report will take a second or two to come back
//
// maaybe we can have a dot added to the end of this string every second? and it start with one dot

/**
 * If we don't care about verbose output give the user some feedback that we are doing something and
 * its just taking lighthouse a good few seconds to come back with the result
 */
if(!argv.verbose) {
    console.log("Running through lighthouse tests. A few seconds please...");
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
    console.log(`${chalk.blue.bold("Google Lighthouse Report")}: ${parsedJSON.url}\n`);
    parsedJSON.reportCategories.forEach(el => {

        /**
         * The scores for each category include decimal values, we don't really need 
         * to be that precise, so we're rounding down to the closes whole number
         */
        console.log(`${el.name}: ${Math.floor(el.score)}/100`);
    });
    
    /**
     * TODO: make this dynamic based on teh scores of each section
     * TODO: add in what js libs you're using that have vulnerabilities
     * TODO: add in common solutions to some of the things they may have wrong like "Offscreen images"
     * and how to fix that just make your images only as big as they are going to be used in the html
     */
    console.log(`\n${chalk.blue.bold("Notes:")}\nYour scores for the \"Progressive Web App\" and \"Best Practices\" tests are poor. Consult /Users/ethankramer/Desktop/report.html for more information on how to improve these scores.\n\nMozilla Observatory Security Test Results:`);

    /**
     * Run the observatory report
     */
    shellExec(`observatory ${url.noProto} --format=report`);
  });

});