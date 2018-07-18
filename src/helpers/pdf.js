// Libraries
const path = require("path");
const pdf = require("html-pdf");

// Allows colorful console logs
const chalk = require("chalk");

// Get the current unix timestamp
const unix = require("to-unix-timestamp");

// Used to expand a.b.c to {a: b: {c: ""}}
const expandObject = require("expand-object");

// Library for "promisifying" all functions of a module
const bluebird = require("bluebird");

// Promisify thge "fs" module (http://bit.ly/2H77JXE)
const fs = bluebird.promisifyAll(require("fs"));

// Local Libs
// Run simple tests on urls (e.g whether its local or not, get only the domain)
const urlFormatter = require("./url");

// Logs warnings and errors to the console using chalk.js for pretty errors
const { formatFileName, formatRuleName } = require("./logger");

// A unique unix timestamp
const unixTimeStamp = unix(new Date());

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
        'section.vulns',
        'section.performance'
    ],
    observatory: [
        'url',
        'score',
        'grade',
        'host',
        'section.obsRule'
    ],
    pagespeed: [],
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
    ],
    'section.performance': [
        'perfItem'
    ],
    perfItem: [
        'perf.score',
        'perf.time',
        'perf.metric',
        'perf.class'
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
        const replacements = fieldNames[sectionName];

        replacements.map(val => {
            regex += `{{${val}}}|`
        });

        regex = regex.substring(0, regex.length - 1);
        return new RegExp(regex, "g");
    } else {
        throw new Error(`Section: "${sectionName}" does not exist.`);
    }
}

function isLighthouseTest() {
    return templateData.hasOwnProperty("pathtolighthousereport");
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
            },
            performance: {
                list: "",
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
        fs.readFileAsync(path.resolve(__dirname, "../pdf-generation-template/blocks/obsRule.html"), "utf8"),
        fs.readFileAsync(path.resolve(__dirname, "../pdf-generation-template/blocks/performance.html"), "utf8"),
        fs.readFileAsync(path.resolve(__dirname, "../pdf-generation-template/blocks/perf-item.html"), "utf8")
    ]).then(([
        test, 
        notesList, 
        vulnsList, 
        noteItem, 
        vulnItem, 
        obsRuleItem,
        performance,
        perfItem
    ]) => {

        data.contents.test = test
        data.contents.notes.list = notesList
        data.contents.notes.item = noteItem
        data.contents.vulns.list = vulnsList
        data.contents.vulns.item = vulnItem
        data.contents.obsRule.item = obsRuleItem
        data.contents.performance.list = performance
        data.contents.performance.item = perfItem
        
        if(isLighthouseTest()) {
            data.contents.test = data.contents.test.replace(regexForSection(testName), (match) => {
                match = trimCurlyBraces(match)
                // console.log('match', match)

                switch (match) {
                    case "url":
                    case "pathtolighthousereport":
                        return templateData[match];

                    case "section.notes":
                        let sectionContents = "";

                        templateData.metrics.forEach(metric => {
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

                        templateData.vulns.vulns.forEach(vuln => {
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

                    case "section.performance":
                        // // console.log('performance', performance)
                        // console.log('templateData', templateData)
                        // console.log('templateData.perfitems', templateData.perfitems)
                        let perfSectionContents = "";

                        templateData.perfitems.forEach(perfItem => {
                            perfSectionContents += data.contents.performance.item.replace(regexForSection("perfItem"), match => {
                                match = trimCurlyBraces(match)

                                switch(match) {
                                    case "perf.score":
                                        return (perfItem.scoringMode === "numeric") ? perfItem.score : "-";
                                    
                                    case "perf.time": 
                                        return perfItem.time;
                                        
                                    case "perf.metric":
                                        return perfItem.metric;

                                    case "perf.class":
                                        return perfItem.class;
                                }
                            })
                        })

                        data.contents.performance.list = data.contents.performance.list.replace(regexForSection("section.performance"), perfSectionContents)

                        return data.contents.performance.list;

                    default:
                        if(match.includes("scores.")) {
                            const [name, prop] = match.replace("scores.", "").split(".")

                            return templateData.scores[name][prop];
                        }
                        break;
                }
            })
        } else {
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
        
        // console.log('data.paths.htmlOutput', data.paths.htmlOutput)
        // console.log('data.contents.test', data.contents.test)
        // console.log('data.paths.pdfOutput', data.paths.pdfOutput)

        fs.writeFile(data.paths.htmlOutput, data.contents.test, "utf8", () => {
            pdf.create(data.contents.test).toFile(data.paths.pdfOutput, (err, res) => {
                console.log(chalk.green.bold(`PDF Generated at: ${res.filename}!`))

                fs.unlink(data.paths.htmlOutput, err => {})
            });              
        })

    }).catch(err => {})
}

module.exports = {
    addData,
    generate
};