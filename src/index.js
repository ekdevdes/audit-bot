#!/usr/bin/env node

/* TODO: 

v1
Speed of lighthouse test results generation
Modify lighthouse test to output json and html and then just use the resulting JSON file from the test instead of parsing the JSON from the DOM of the HTML version of the report
Integrate the google mobile friendliness test API into the lighthouse test
Add page load speed to lighthouse output
Make help docs (report --help) better (might have to use a different pkg than yargs for this)

v2
HTTPS mixed content analysis that comes with lighthouse cli v2.9
PageSpeed test that uses Google's pagespeed insights API
*/

// Libraries
const exec = require("shell-exec"); // used to exec cli commands like lighthouse and observatory

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
  .option("file", {
    alias: "f",
    describe: "Saves a PDF of the test results to the specified path",
    type: "string"
  })
  .example("$0 http://localhost:3030 -v", "Runs a lighthouse test on localhost. Localhost urls don't work with observatory. Using the verbose output option described above.")
  .example("$0 https://example.com -v", "Runs a lighthouse and observatory security test on example.com. Localhost urls don't work with observatory. Using the verbose output option described above.")
  .example("$0 https://internet.example.com -t observatory", "Runs only a observatory security test on internet.example.com. Without using verbose output.")
  .example("$0 http://example.localhost.com -t lighthouse", "Runs only a lighthouse test on exaple.localhost.com. Without using verbose output.")
  .example("$0 https://amazing.io -vt lighthouse", "Runs only a lighthouse test on amazing.io, using verbose output.")
  .example("$0 https://amazing.io -vt lighthouse -f .", "Runs only a lighthouse test on amazing.io, using verbose output.")
  .argv;

// Local Libs
const urlFormatter = require("./helpers/url"); // run simple tests on urls (e.g whether its local or not, get only the domain)
const { logError } = require("./helpers/logger"); // logs warnings and errors to the console using chalk.js for pretty errors
const {
    lighthouse,
    observatory,
    pagespeed,
    all
} = require("./tests"); // runs all of our site audits


const url = argv._[0] || ""; // the url passed into the command, we're just defaulting it to an empty string and not null
const isURLValid = urlFormatter.isURLValid(url);
let invalidCommandOptions = []; // list of non-valid options that were passed in to the command (e.g. not one of the options specified above)

// gather the invalid options passed in and throw them in the invalid optios array
Object.keys(argv).map(key => {
    const standardKeys = ["_", "$0", "version", "help"];
    const customOptions = ["v", "t", "f", "verbose", "test", "file"];

    if(!standardKeys.includes(key) && !customOptions.includes(key)) {
        invalidCommandOptions.push(key);
    }
});

// if we have any invalid passed in options throw an error and trigger the help screen
if(invalidCommandOptions.length) {
    const optsMsg = invalidCommandOptions.map(option => `"${option}"`).join(", ");
    const optsMsgEnding = (invalidCommandOptions.length > 1) ? "are not valid options" : "is not a valid option";

    logError(`${optsMsg} ${optsMsgEnding}`);
    exec(`${argv["$0"]} --help`);

    // end execution of the file
    return;
}

// if there actually is a passed url and its not an invalid format then proceed to determining which test to run
if(url !== "" && isURLValid) {
    // pull off the verbose and file options since those are the only options our test runners need to care about
    let { verbose, file } = argv; 

    switch (argv.test) {
        case "lighthouse":
            lighthouse({ verbose, file }, url);
            break;

        case "observatory":
            observatory({ verbose, file }, url);
            break;

        case "pagespeed":
            pagespeed({ verbose, file }, url);
            break;

        default:
            all({ verbose, file }, url);
            break;
    }

// a url was passed into the command but it was invalid
} else if(url !== "" && !isURLValid) {

    logError("Invalid URL format");

// a url was not passed into the command
} else {

    logError("A URL is required");

}