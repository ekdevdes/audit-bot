// Libraries
const path = require("path");
const pdf = require("phantom-html2pdf");
const unix = require("to-unix-timestamp"); // get the current unix timestamp
const chalk = require("chalk"); // allows colorful console logs
const exec = require("shell-exec"); // used to exec cli commands like lighthouse and observatory
const ora = require("ora"); // colorful cli spinners
const expandObject = require("expand-object"); // expand a.b.c to {a: b: {c: ""}}
const bluebird = require("bluebird"); // library for "promisifying" all functions of a module
const fs = bluebird.promisifyAll(require("fs")); // Promisify thge "fs" module (http://bit.ly/2H77JXE)

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
        'pathtolighthousereport',
        'slug'
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

function isTest(testName) {
    if(testName === "lighthouse") {
        return !templateData.hasOwnProperty("rules");
    } else if(testName === "observatory") {
        return templateData.hasOwnProperty("rules");
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

// generates a PDF with data from an internal object (built by addData() method) and uses that info to fill in an HTML template then converts that HTML template to a PDF
async function generate(testName, pdfPath) {
    const spinner = ora({
        text: "Generating PDF...",
        color: "blue"
    });

    const data = {
        paths: {
            full: path.resolve(pdfPath),
            htmlOutput: path.resolve(__dirname, `../generated/test.${testName}-${unixTimeStamp}.html`),
            pdfOutput: `${path.resolve(pdfPath)}/${urlFormatter.domainOnlyURL(templateData.url)}-audit.${testName}-${unixTimeStamp}.pdf`
        },
        contents: {
            test: "",
            notes: {
                list: "",
                item: ""
            },
            vulns: {
                list: "",
                item: ""
            },
            obsRule: {
                item: ""
            }
        }
    }

    Promise.all([
        fs.readFileAsync(path.resolve(__dirname, `../pdf-generation-template/templates/${testName}.html`), "utf8"),
        fs.readFileAsync(path.resolve(__dirname, `../pdf-generation-template/blocks/notes.html`), "utf8"),
        fs.readFileAsync(path.resolve(__dirname, `../pdf-generation-template/blocks/vulns.html`), "utf8"),
        fs.readFileAsync(path.resolve(__dirname, "../pdf-generation-template/blocks/note.html"), "utf8"),
        fs.readFileAsync(path.resolve(__dirname, "../pdf-generation-template/blocks/vuln.html"), "utf8"),
        fs.readFileAsync(path.resolve(__dirname, "../pdf-generation-template/blocks/obsRule.html"), "utf8")
    ]).then(([
        test, 
        notesList, 
        vulnsList, 
        noteItem, 
        vulnItem, 
        obsRuleItem
    ]) => {

        data.contents.test = test
        data.contents.notes.list = notesList
        data.contents.notes.item = noteItem
        data.contents.vulns.list = vulnsList
        data.contents.vulns.item = vulnItem
        data.contents.obsRule.item = obsRuleItem
    
        if(isTest("lighthouse")) {
            data.contents.test = data.contents.test.replace(regexForSection(testName), (match) => {
                match = trimCurlyBraces(match)

                switch (match) {
                    case "url":
                    case "pathtolighthousereport":
                        return templateData[match];

                    case "section.notes":
                        let sectionContents = "";

                        templateData.metrics.map(metric => {
                            sectionContents += data.contents.notes.item.replace(regexForSection("note"), (match) => {
                                match = trimCurlyBraces(match)

                                switch (match) {
                                    case "metric.class":
                                        return metric.class;
    
                                    case "metric.name":
                                        return metric.name;
    
                                    case "metric.grade":
                                        return metric.grade;
    
                                    case "pathtolighthousereport":
                                        return templateData.pathtolighthousereport;

                                    case "slug":
                                        return metric.slug;
                                }
                            });
                        })

                        data.contents.notes.list = data.contents.notes.list.replace(regexForSection("section.notes"), sectionContents)

                        return data.contents.notes.list;

                    case "section.vulns":
                        let theSectionContents = "";

                        templateData.vulns.vulns.map(vuln => {
                            theSectionContents += data.contents.vulns.item.replace(regexForSection("vuln"), (match) => {
                                match = trimCurlyBraces(match)

                                switch (match) {
                                    case "vuln.libraryVersion":
                                        return vuln.libraryVersion;

                                    case "vuln.vulnCount":
                                        return vuln.vulnCount;

                                    case "vuln.highestSeverity":
                                        return vuln.highestSeverity;

                                    case "vuln.url":
                                        return vuln.url;
                                }
                            });
                        })

                        data.contents.vulns.list = data.contents.vulns.list.replace(regexForSection("section.vulns"), (match) => {
                            match = trimCurlyBraces(match)

                            switch (match) {
                                case "vuln":
                                    return theSectionContents;
                                
                                case "vuln.counts":
                                    return templateData.vulns.total;
                            }
                        })

                        return data.contents.vulns.list;

                    default:
                        if(match.includes("scores.")) {
                            const [name, prop] = match.replace("scores.", "").split(".")

                            return templateData.scores[name][prop];
                        }
                        break;
                }
            })
        } else if(isTest("observatory")) {
            data.contents.test = data.contents.test.replace(regexForSection(testName), (match) => {
                match = trimCurlyBraces(match);

                switch (match) {
                    case "url":
                    case "host":
                    case "score":
                    case "grade":
                        return templateData[match];

                    case "section.obsRule":
                        let sectionContents = "";

                        templateData.rules.map(rule => {
                            sectionContents += data.contents.obsRule.item.replace(regexForSection("section.obsRule"), (match) => {
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

                                    case "rule.isPassed":
                                        return (rule.isPassed) ? "\u2714" : "\u2718";

                                 }

                            })
                        })

                        return sectionContents;
                }
            })
        }

        fs.writeFile(data.paths.htmlOutput, data.contents.test, "utf8", () => {
            pdf.convert({html: data.paths.htmlOutput}, (err, result) => {
                result.toFile(data.paths.pdfOutput, () => {
                    spinner.stop().clear()
                    console.log(`PDF of ${testName} report saved to: ${formatFileName(data.paths.pdfOutput)}.\n`)   

                    // delete the temp html file
                    //fs.unlink(data.paths.htmlOutput, () => {})
                })
            })
        })

    }).catch(err => {})
}

module.exports = {
    addData,
    generate
};