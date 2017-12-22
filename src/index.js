#!/usr/bin/env node

/**
 * Notes:
 * 
 * Local urls don't work for observatory. 
 * As its working currently the report.html file is going into the directory they run the command from
 * Observatory cli command does like www and subdomains actually I just tried it (12/22)
 */

 /**
  * TODOS
  *
  * TODO: write the tests.run.all function that just does a lighthouse test, then observatory test
  *
  * TODO: Format the tables in the output better, maybe theres a node module that can help with that
  *     https://www.npmjs.com/package/cli-table - this module can help with the formatting of the tables
  *     And it uses https://github.com/marak/colors.js for text colors
  *
  * TODO: fix the bugs with the js vulnerabilities table documented in the "debug_screenshots/" folder
  *
  * TODO: add an a unique identifier to the end of the report.html file name so its report-xyz.html so you can run the
  * command over and over again in the same directory and have all the reports seperate, not overwriting each other 
  */

/**
 * The library we're using for colorful console.logs (e.g. changing text color, text bg color)
 * 
 * @var {object} chalk
 * @see https://www.npmjs.com/package/chalk
 */
const chalk = require("chalk");

/**
 * The library we're using to pull out and parse the passed in args to the command. Additionally,
 * we're documenting the available options, their aliases, their default values and their purpose
 * for the help screen
 * 
 * @var {object} yargs
 * @see https://www.npmjs.com/package/yargs
 */
const argv = require('yargs')
  .usage("$0 url [options]")
  .option("verbose", {
    alias: "v",
    type: 'boolean',
    describe: "Logs all the metrics currently being tested",
    default: false
  })
  .option("only", {
    alias: "o",
    describe: "Run only lighthouse or only observatory tests",
    type: 'string',
    choices: ['lighthouse', 'observatory']
  })
  .example("$0 http://localhost:3030 --verbose", "Runs a lighthouse test on localhost. Localhost urls don't work with observatory. Using the verbose output option described above.")
  .example("$0 https://example.com -v", "Runs a lighthouse and observatory security test on example.com. Localhost urls don't work with observatory. Using the verbose output option described above.")
  .example("$0 https://internet.example.com -only=observatory", "Runs only a observatory security test on internet.example.com. Without using verbose output.")
  .example("$0 http://example.localhost.com -o lighthouse", "Runs only a lighthouse test on exaple.localhost.com. Without using verbose output.")
  .example("$0 https://amazing.io -vo lighthouse", "Runs only a lighthouse test on amazing.io, using verbose output.")
  .argv;

const tests = require("./tests");

const url = argv._[0] || "";
const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&\/\/=]*)/g;
const isURLValid = url.match(urlRegex);

/** A url was passed in to the command is a valid url */
if(url && isURLValid) {
    const urlMatches = urlRegex.exec(url);
    const noProtoURL = urlMatches[0].split("//")[1];

    if(argv.only && argv.only === "lighthouse") {
        tests.run.lighthouse(argv, url);
    } else if(argv.only && argv.only === "observatory") {
        tests.run.observatory(argv, noProtoURL);
    } else {

        // tests.run.all will have to split the url itself
       tests.run.all(argv, url);
    }


/** A url was passed in to the command, but was invalid */
} else if(url && !isURLValid) {
    console.log(chalk.bgRed.white.bold("[ERROR] Invalid url format\nValid Formats: https://example.com, http://example.com, http://subdomain.example.com, http://subdomain.example.com?a=b&c=d"));

/** A url was not passed into the command */
} else {
    console.log(chalk.bgRed.white.bold("[ERROR] url is required"));
}