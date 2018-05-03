#!/usr/bin/env node

const { spawn } = require('child_process')

// used to validate and parse passed in cli options and style help screen
const argv = require('yargs')
  .usage("$0 url [options]")
  .option("verbose", {
    alias: "v",
    type: "boolean",
    describe: "Logs the lighthouse metric currently being tested",
    default: false
  })
  .option("test", {
    alias: "t",
    describe: "Which test to run",
    type: "string",
    choices: ["lighthouse", "observatory", "pagespeed"]
  })
  .option("output-path", {
    alias: "o",
    describe: "Where to save the PDF output of the test results",
    type: "string"
  })
  .argv;

const { isURLValid } = require("./helpers/url"); 

// Logs warnings and errors to the console using chalk.js for pretty errors
const { logError } = require("./helpers/logger");

// Runs all of our site audits
const {
    lighthouse,
    observatory,
    pagespeed,
    all
} = require("./tests-new");

// the url passed into the command, we're just defaulting it to an empty string and not null
const url = argv._[0] || "";

// list of non-valid options that were passed in to the command (e.g. not one of the options specified above)
let invalidCommandOptions = [];

// gather the invalid options passed in and throw them in the invalidOptions array
Object.keys(argv).map(key => {
    const standardOptions = ["_", "$0", "version", "help"];
    const customOptions = ["v", "t", "o", "verbose", "test", "output-path", "outputPath"];

    if(![...standardOptions, ...customOptions].includes(key)) {
        invalidCommandOptions.push(key);
    }
})

// if we have any invalid passed in options throw an error and trigger the help screen
if(invalidCommandOptions.length) {
    const optsMsg = invalidCommandOptions.map(option => `"${option}"`).join(", ");
    const optsMsgEnding = (invalidCommandOptions.length > 1) ? "are not valid options" : "is not a valid option";

    logError(`${optsMsg} ${optsMsgEnding}`);
    
    const cmd = spawn('report', ['--help'])
    cmd.stdout.on('data', (data) => {
        console.log(data.toString())
    })

    // end execution of the file
    return;
}

if(url !== "" && isURLValid(url)) {

    let { 
        verbose, 
        outputPath, 
        test 
    } = argv

    switch (test) {
        case "lighthouse":
            lighthouse({ verbose, outputPath }, url);
            break;

        case "observatory":
            observatory({ verbose, outputPath }, url);
            break;

        // case "pagespeed":
        //     pagespeed({ verbose, outputPath }, url);
        //     break;

        default:
            all({ verbose, outputPath }, url);
            break;
    }

} else if(url !== "" && !isURLValid(url)) {

    logError("Invalid URL format");

} else {

    logError("A URL is required");

}