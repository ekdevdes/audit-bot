// TODO: from observatory maybe look into how to include the result of the htbridge.com third party test
// because it has things like PCI-DSS and HIPAA compliance, as well as Heartbleed vulnerabilities and other
// popular vulnerabilities and how vulnerable you are to them. If not possible to output in terminal maybe the 
// web test results link will have it and I can point the user to it
//
// TODO: see if local urls work with observatory
// 
// TODO: also include some of the links i got from the fed security talk into the output
// 
// TODO: Make the notes section under the lighthouse test resuls dynamic and make it use the levels "poor" and "needs improving"
// TODO: reformat the lighthouse test results to look more like observatory test results
// TODO: integrate into rv-landingpage-gulp

const fs = require("fs"),
      jsdom = require("jsdom"),
      shellExec = require('shell-exec'),
      argv = require('yargs').argv;

const { JSDOM } = jsdom;

// get the url passed into the script using yargs
const urlArg = argv._[0];

let lhCmd = `lighthouse ${urlArg} --chrome-flags="--headless" --quiet --output=html --output-path=./report.html`;

// show the log from the lighthouse command if --verbose is passed in 
if(argv.verbose) {
  lhCmd = `lighthouse ${urlArg} --chrome-flags="--headless" --output=html --output-path=./report.html`;
}

// if we don't care about verbose output give the user some feedback that we are doing something
// its just that the lighthouse report will take a second or two to come back
//
// maaybe we can have a dot added to the end of this string every second? and it start with one dot
if(!argv.verbose) {
  console.log("Running through lighthouse tests. A few seconds please...");
}

shellExec(lhCmd).then(() => {

  // if we don't care about verbose output remove what we logged earlier about how we are waiting for
  // the lighthouse test results since we have the resuls now
  if(!argv.verbose){
    console.clear();
  }

  // lighthouse testing
  //
  // the result of the test is an html file that we can present the user with so they can read up
  // on they can improve their site. But we need to know what scores they got in each category without having 
  // to scrape the html of the report or re-run the report with json output this time
  // 
  // ...turns out the json results are saved in a script tag at the bottom of the <body> of the html of the report
  // so we're just invoking an instance of JSDOM to parse that JSON so we can pull out the info we need
  fs.readFile("report.html", "utf8", (err, contents) => {
    if (err) throw err;

    const dom = new JSDOM(contents);
    let theJSON = dom.window.document.querySelectorAll("script")[1].innerHTML.replace("window.__LIGHTHOUSE_JSON__ = ", "");
    
    // remove the ";" off the end so our JSON will validate
    theJSON = theJSON.substring(0, theJSON.length - 1);
    
    const parsedJSON = JSON.parse(theJSON);

    // if --verbose was passed in add some padding between the last line of the 
    // logs from the lighthouse command and the first line of the results
    if(argv.verbose) {
      console.log("");
    }

    console.log(`Lighthouse Test Results for ${parsedJSON.url}\n`);
    parsedJSON.reportCategories.forEach(el => {
      console.log(`${el.name}: ${Math.floor(el.score)}/100`);
    });

    console.log("\nNotes:\nYour scores for the \"Progressive Web App\" and \"Best Practices\" tests are poor. Consult /Users/ethankramer/Desktop/report.html for more information on how to improve these scores.\n\nMozilla Observatory Security Test Results:");

    // observatory testing
    // observatory doesn't like protocols in the url you pass them....
    var simplerURL = urlArg.split("//")[1];

    shellExec(`observatory ${simplerURL} --format=report`);
  });
});