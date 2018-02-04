#!/usr/bin/env node

 /**
  * TODOS
  *
  * Integrate PDF generation into tests.run.all
  * Integrate the google mobile friendliness test API into the lighthouse test
  * Style the PDFs output more 
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
    type: "boolean",
    describe: "Logs all the metrics currently being tested",
    default: false
  })
  .option("test", {
    alias: "t",
    describe: "Run only lighthouse or only observatory tests",
    type: "string",
    choices: ["lighthouse", "observatory"]
  })
  .option("file", {
    alias: "f",
    describe: "Generate a pdf of the terminal output and specify a path to save it to",
    type: "string"
  })
  .example("$0 http://localhost:3030 --verbose", "Runs a lighthouse test on localhost. Localhost urls don't work with observatory. Using the verbose output option described above.")
  .example("$0 https://example.com -v", "Runs a lighthouse and observatory security test on example.com. Localhost urls don't work with observatory. Using the verbose output option described above.")
  .example("$0 https://internet.example.com --test=observatory", "Runs only a observatory security test on internet.example.com. Without using verbose output.")
  .example("$0 http://example.localhost.com -t lighthouse", "Runs only a lighthouse test on exaple.localhost.com. Without using verbose output.")
  .example("$0 https://amazing.io -vt lighthouse", "Runs only a lighthouse test on amazing.io, using verbose output.")
  .example("$0 https://amazing.io -vft lighthouse", "Runs only a lighthouse test on amazing.io, using verbose output.")
  .argv;

/**
 * The library we're using to execute the "lighthouse" and "observatory" cli commands from node
 * 
 * @var {function} shellExec
 * @see https://www.npmjs.com/package/shell-exec
 */
const shellExec = require("shell-exec");

const urlLib = require("./url");
const tests = require("./tests");

const url = argv._[0] || "";

/**
 * An array of non valid options passed into the command 
 * 
 * @var {array} nonValidOptions
 */
let nonValidOptions = [];

/**
 * Map through the argv object that has the list of potential options for the command
 * and the actual passed in option and create an array of keys that aren't help, only or verbose
 * save them to an array and if that array is not empty we have passed in an invalid option
 */
Object.keys(argv).map(key => {
    const standardKeys = ["_", "$0", "version", "help"];
    const customOptions = ["v", "t", "f", "verbose", "test", "file"];

    if(!standardKeys.includes(key) && !customOptions.includes(key)) {
        nonValidOptions.push(key);
    }
});

/** If we have any invalid options that were passed into the command error out */
if(nonValidOptions.length) {
    const optsMsg = nonValidOptions.map(opt => `"${opt}"`).join(", ");
    const optsMsgEnding = (nonValidOptions.length > 1) ? "are not valid options" : "is not a valid option";

    console.log(chalk.bgRed.white.bold(`[ERROR] ${optsMsg} ${optsMsgEnding}.\n`));
    shellExec(`${argv["$0"]} --help`);
    return;
}

if(url && urlLib.isURLValid(url)) {
    const domainOnlyURL = urlLib.domainOnlyURL(url);

    if(argv.test && argv.test === "lighthouse") {
       tests.run.lighthouse(argv, url);
    } else if(argv.test && argv.test === "observatory") {
        tests.run.observatory(argv, domainOnlyURL);
    } else {
        // tests.run.all will have to split the url itself
       tests.run.all(argv, url);
    }
    
/** A url was passed in to the command, but was invalid */
} else if(url && !urlLib.isURLValid(url)) {
    console.log(chalk.bgRed.white.bold("[ERROR] Invalid URL format"));

/** A url was not passed into the command */
} else {
    console.log(chalk.bgRed.white.bold("[ERROR] url is required"));
}