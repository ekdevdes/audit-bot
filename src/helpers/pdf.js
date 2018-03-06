// Libraries
const path = require("path");
const unix = require("to-unix-timestamp"); // get the current unix timestamp
const chalk = require("chalk"); // allows colorful console logs
const exec = require("shell-exec"); // used to exec cli commands like lighthouse and observatory
const ora = require("ora"); // colorful cli spinners
const expandObject = require("expand-object"); // expand a.b.c to {a: b: {c: ""}}
const bluebird = require("bluebird"); // library for "promisifying" all functions of a module
const fs = bluebird.promisifyAll(require("fs")); // Promisify thge "fs" module (http://bit.ly/2H77JXE)
const once = require("once") // used to generate the html results of the tests only once

// Local Libs
const urlFormatter = require("./url"); // run simple tests on urls (e.g whether its local or not, get only the domain)
const { 
    logError,
    formatFileName,
    formatRuleName
} = require("./logger"); // logs warnings and errors to the console using chalk.js for pretty errors
const ratings = require("./ratings")(); // maps a test's score to its grade (e.g. 80 = fail, 70 = average, 60 = fail)

const unixTimeStamp = unix(new Date()); // a unique unix timestamp

// Private functions and data
const fieldNames = {
    lighthouse: [
        'url',
        'pathtolighthousereport',
        'scores.pwa.score',
        'scores.pwa.class',
        'scores.performance.score',
        'scores.performance.class',
        'scores.accessibility.score',
        'scores.accessibility.class',
        'scores.bestpractices.score',
        'scores.bestpractices.class',
        'scores.seo.score',
        'scores.seo.class',
        'section.notes',
        'section.vulns'
    ],
    observatory: [
        'url',
        'score',
        'grade',
        'host',
        'section.obsRule'
    ],
    pagespeed: [],
    all() {
        let vals = [...this.lighthouse, ...this.observatory, ...this.pagespeed];

        // remove the duplicates using a set
        return [...new Set(vals)];
        
    },
    note: [
        'metric.name',
        'metric.grade',
        'metric.class',
        'pathtolighthousereport'
    ],
    'section.notes': [
        'notes'
    ],
    'section.obsRule': [
        'rule.score',
        'rule.slug',
        'rule.desc',
        'rule.class',
        'rule.isPassed'
    ],
    'section.vulns': [
        'vuln.counts',
        'vuln'
    ],
    vuln: [
        'vuln.libraryVersion',
        'vuln.vulnCount',
        'vuln.highestSeverity',
        'vuln.url'
    ]
}

const templateData = {
    scores: {}
};

function trimCurlyBraces(str) {
    return str.replace("{{", "").replace("}}", "");
}

// builds a regex object that contains all the placeholders for that section
function regexForSection(sectionName) {
    let regex = "";
    let validKeys = Object.keys(fieldNames);

    if(validKeys.includes(sectionName)) {
        // fieldNames.all is a function but all the keys are simply objects, so we check to see if the value is a function and if so execute it
        const replacements = (typeof fieldNames[sectionName] === "function") ? fieldNames[sectionName]() : fieldNames[sectionName];

        replacements.map(val => {
            regex += `{{${val}}}|`
        });

        regex = regex.substring(0, regex.length - 1);
        return new RegExp(regex, "g");
    } else {
        throw new Error(`Section: "${sectionName}" does not exist.`);
    }
}

// Public functions
// adds a piece of data to an internal object that will ultimately be used to fill in template data
function addData(key, data) {
   key = key.toString().toLowerCase();
   
   const lighthouseAudits = ["pwa", "performance", "accessibility", "bestpractices", "seo"];

   if(lighthouseAudits.includes(key)) {
       let expandedObject = expandObject(`scores.${key}.class|scores.${key}.score`);

       expandedObject.scores[key].class = data.class;
       expandedObject.scores[key].score = data.score;
   
       let newScoresValue = Object.assign(templateData.scores, expandedObject.scores);

       templateData.scores = newScoresValue;
   } else {
       templateData[key] = data;
   }
}

function getTemplateData() {
    return templateData;
}

// generates a PDF with data from an internal object (built by addData() method) and uses that info to fill in an HTML template then converts that HTML template to a PDF
async function generate(testName, pdfPath) {
    
    if(typeof pdfPath === "string" && pdfPath !== "") {
        const resolvedPath = path.resolve(pdfPath);
        const generatedHTMLPath = path.resolve(__dirname, `../generated/test-${unixTimeStamp}.html`);

        const spinner = ora({
            text: "Generating PDF...",
            color: "blue"
        }); 

        const templateContents = {
            test: await fs.readFileAsync(path.resolve(__dirname, `../pdf-generation-template/templates/${testName}.html`), "utf8"),
            lists: {
                notes: await fs.readFileAsync(path.resolve(__dirname, `../pdf-generation-template/blocks/notes.html`), "utf8"),
                vulns: await fs.readFileAsync(path.resolve(__dirname, `../pdf-generation-template/blocks/vulns.html`), "utf8"),
            },
            listItems: {
                note: await fs.readFileAsync(path.resolve(__dirname, "../pdf-generation-template/blocks/note.html"), "utf8"),
                vuln: await fs.readFileAsync(path.resolve(__dirname, "../pdf-generation-template/blocks/vuln.html"), "utf8"),
                obsRule: await fs.readFileAsync(path.resolve(__dirname, "../pdf-generation-template/blocks/obsRule.html"), "utf8")
            }
        }

        if(templateContents.test) {
            const generatedHTMLContents = templateContents.test.replace(regexForSection(testName), (match) => {
                match = trimCurlyBraces(match)
 
                 switch (match) {
                     case "url":
                     case "pathtolighthousereport":
                     case "score":
                     case "grade":
                         return templateData[match];
 
                     case "section.notes":
                         let contentForListItems = "";
                         const {lists: { notes }, listItems: { note }} = templateContents;
 
                         if(note) {
                             templateData.metrics.map(metric => {
                                 contentForListItems += note.replace(regexForSection("note"), (match) => {
                                     match = trimCurlyBraces(match)
 
                                     switch (match) {
                                         case "metric.class":
                                             return metric.class;
                                         case "metric.name":
                                             return metric.name;
                                         case "metric.grade":
                                             return metric.grade;
                                     
                                         default:
                                             return templateData.pathtolighthousereport;
                                     }
                                 })
                              });
 
                              if(notes) {
                                 return notes.replace(regexForSection("section.notes"), contentForListItems);
                              } 
 
                              return contentForListItems;
                         }
 
                         return match;
 
                     case "section.vulns":
                         let contentForTable = "";
                         const {lists: { vulns }, listItems: { vuln }} = templateContents;
 
                         if(vuln) {
                             templateData.vulns.vulns.map(item => {
                                 contentForTable += vuln.replace(regexForSection("vuln"), (match) => {
                                     match = trimCurlyBraces(match)
 
                                     switch (match) {
                                         case "vuln.libraryVersion":
                                             return item.libraryVersion;
                                         case "vuln.vulnCount":
                                             return item.vulnCount;
                                         case "vuln.highestSeverity":
                                             return item.highestSeverity;
                                     
                                         default:
                                             return item.url;
                                     }
                                 })
                              });
 
                              if(vulns) {
                                 return vulns.replace(regexForSection("section.vulns"), contentForTable);
                              } 
 
                              return contentForTable;
                         }
 
                         return match;
                     
                     case "host":
                         return urlFormatter.domainOnlyURL(templateData.url);
 
                     
                     case "section.obsRule":
                         let contentForRulesTable = "";
                         const {listItems: { obsRule }} = templateContents;
 
                         if(obsRule) {
                             templateData.rules.map(rule => {
                                 contentForRulesTable += obsRule.replace(regexForSection("section.obsRule"), (match) => {
                                     match = trimCurlyBraces(match)
 
                                     switch (match) {
                                         case "rule.score":
                                             return rule.score;
                                         case "rule.class":
                                             return rule.class;
                                         case "rule.slug":
                                             return formatRuleName(rule.slug);
                                         case "rule.desc":
                                             return rule.desc;
 
                                         default:
                                             return (rule.isPassed) ? "\u2714" : "\u2718";
                                     }
                                 })
                              });
 
                              return contentForRulesTable;
                         }
 
                         return match;
 
                     default:
                         if(match.includes("scores.")) {
                             const [name, prop] = match.replace("scores.", "").split(".")
 
                             return templateData.scores[name][prop];
                         }
                         
                         return match;
                 }
            })

            
        // await fs.writeFileAsync(generatedHTMLPath, generatedHTMLContents, "utf8");
        }
    }

    return;
}

addData("url", "http://ethankr.me")
addData("pwa", {
    score: 1, 
    class: "poor"
})
addData("performance", {
    score: 1, 
    class: "poor"
})
addData("accessibility", {
    score: 1, 
    class: "poor"
})
addData("bestpractices", {
    score: 1, 
    class: "poor"
})
addData("seo", {
    score: 1, 
    class: "poor"
})
addData("score", 25)
addData("grade", "D")
addData("metrics", [
    {name: "Progressive Web App", gradE: "is poor", class: "poor"},
    {name: "Accessibility", grade: "needs imporvement", class: "ok"}
])
addData("vulns", {
    total: 1,
    vulns: [
        {libraryVersion: "jQuery@2.1.3", vulnCount: 2, highestSeverity: "Medium", url: "https://snyk.io/vuln/npm:jquery?lh@2.1.3"}
    ]
})
addData("pathtolighthousereport", path.resolve(`report-${unixTimeStamp}.html`))
addData("rules", [
    {score: -25, slug: 'content-security-policy', desc: "Content Security Policy (CSP) header not implemented", isPassed: false },
    {score: -25, slug: 'content-security-policy', desc: "Content Security Policy (CSP) header not implemented", isPassed: false }
])
generate("all", ".")
    .then(data => data)
    .catch(err => logError(err.message)) /*?  */;

module.exports = {
    addData,
    generate,
    getTemplateData,
    templateData
};