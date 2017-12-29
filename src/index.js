#!/usr/bin/env node

 /**
  * TODOS
  *
  * TODO: URLs like http://localhost:8888/vuejs-tuts/coligo/dynamic-components/ throw an "Improper URL format" error,
  * also http://localhost:8888/MAMP/?language=English is an improper url and so is http://localhost/
  *
  * TODO: Add the ability to save the terminal output to a pdf file with a "--file" or "-f" option which by default will save 
  * the PDF to the directory the command is being run from but you can pass in an argument of where you want the pdf file to
  * be outputted to instead. When the -f option is passed in a folder will be created (will have to have a unique name) with the
  * lighthouse report html and the holisitic report pdf. Maybe if a -z or "--zip" option is passed in then it will zip the folder
  * and delete the original folder so you only have the zip file. That would be great for when this commmand is run as a cron job
  * on a server. Make the filename of the pdf report-{unix-time-stamp-of-time-of-request}.pdf, this will solve the problem
  * that could occur by calling "report <url> -f" without passing in a file path to save the pdf to multiple times and the the previous
  * pdf getting overwritten by the new pdf. E.g. report-18383039.pdf. And a "--open" and "-o" options can open the resulting PDF in the 
  * browser/pdf viewer of choice.
  *
  * TODO: Make observatory tests run on localhost urls (urls containing "localhost") output an error saying that
  * observatory does not support localhost urls. When running both lighthouse and observatory with a localhost url 
  * tests at the same time output a yellow warning saying that observatory tests will not be ran because observatory
  * does not support localhost urls
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
  .example("$0 http://localhost:3030 --verbose", "Runs a lighthouse test on localhost. Localhost urls don't work with observatory. Using the verbose output option described above.")
  .example("$0 https://example.com -v", "Runs a lighthouse and observatory security test on example.com. Localhost urls don't work with observatory. Using the verbose output option described above.")
  .example("$0 https://internet.example.com --test=observatory", "Runs only a observatory security test on internet.example.com. Without using verbose output.")
  .example("$0 http://example.localhost.com -t lighthouse", "Runs only a lighthouse test on exaple.localhost.com. Without using verbose output.")
  .example("$0 https://amazing.io -vt lighthouse", "Runs only a lighthouse test on amazing.io, using verbose output.")
  .argv;

/**
 * The library we're using to execute the "lighthouse" and "observatory" cli commands from node
 * 
 * @var {function} shellExec
 * @see https://www.npmjs.com/package/shell-exec
 */
const shellExec = require("shell-exec");

const tests = require("./tests");

const url = argv._[0] || "";
const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&\/\/=]*)/g;
const isURLValid = url.match(urlRegex);

/**
 * An array of non valid options passed into the command 
 * 
 * @var {array} nonValidOptions
 */
let nonValidOptions = [];

/**
 * map through the argv object that has the list of potential options for the command
 * and the actual passed in option and create an array of keys that aren't help, only or verbose
 * save them to an array and if that array is not empty we have passed in an invalid option
 */
Object.keys(argv).map(key => {
    const standardKeys = ["_", "$0", "version", "help"];
    const customOptions = ["v", "t", "verbose", "test"];

    if(!standardKeys.includes(key) && !customOptions.includes(key)) {
        nonValidOptions.push(key);
    }
});

/** If we have any invalid options that were passed into the command error out */
if(nonValidOptions.length > 0) {
    const optsMsg = nonValidOptions.map(opt => `"${opt}"`).join(", ");
    const optsMsgEnding = (nonValidOptions.length > 1) ? "are not valid options" : "is not a valid option";

    console.log(chalk.bgRed.white.bold(`[ERROR] ${optsMsg} ${optsMsgEnding}.\n`));
    shellExec(`${argv["$0"]} --help`);
    return;
}

/** A url was passed in to the command is a valid url */
if(url && isURLValid) {
    const urlMatches = urlRegex.exec(url);
    const domainOnlyURL = urlMatches[0].split("//")[1].split("/")[0];

    if(argv.test && argv.test === "lighthouse") {
        tests.run.lighthouse(argv, url);
    } else if(argv.test && argv.test === "observatory") {
        tests.run.observatory(argv, domainOnlyURL);
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