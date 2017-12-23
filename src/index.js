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
  * TODO: Change the "false" or "true" in the "Pass or Fail" column of the observatory test result to a 
  * red "X" or green checkmark
  * 
  * TODO: write the tests.run.all function that just does a lighthouse test, then observatory test
  *
  * TODO: Format the tables in the output better, maybe theres a node module that can help with that
  *     https://www.npmjs.com/package/cli-table - this module can help with the formatting of the tables
  *     And it uses https://github.com/marak/colors.js for text colors
  *
  * TODO: fix the bugs with the js vulnerabilities table
  *
  * TODO: To allow the user to run the command over and over again without having the previous report.html file
  * overwrite the current "report.html" file change the name of the file to "report-{unix-time-stamp-of-time-of-request}.html".
  * e.g. report-18928393.html.
  *
  * TODO: add the ability to have a report.json inside of the current directory with keys for "local", "test" and "prod"
  * so you can just run "report -l" or "report --local" or "report -t" or "report --test" or "report -p" or "report --prod"
  * and not have to specify a url. And then document this in the command help output and the README
  *
  * TODO: Add the ability to save the terminal output to a pdf file with a "--file" or "-f" option which by default will save 
  * the PDF to the directory the command is being run from but you can pass in an argument of where you want the pdf file to
  * be outputted to instead. When the -f option is passed in a folder will be created (will have to have a unique name) with the
  * lighthouse report html and the holisitic report pdf. Maybe if a -z or "--zip" option is passed in then it will zip the folder
  * and delete the original folder so you only have the zip file. That would be great for when this commmand is run as a cron job
  * on a server. Make the filename of the pdf report-{unix-time-stamp-of-time-of-request}.pdf, this will solve the problem
  * that could occur by calling "report -pf" without passing in a file path to save the pdf to multiple times and the the previous
  * pdf getting overwritten by the new pdf. E.g. report-18383039.pdf.
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