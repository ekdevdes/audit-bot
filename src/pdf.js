const fs = require("fs");
const path = require("path");

/**
 * Used to easily get the current unix timestamp 
 * 
 * @var {function} unix
 * @see https://www.npmjs.com/package/to-unix-timestamp
 */
const unix = require("to-unix-timestamp");

/**
 * The library we're using for colorful console.logs (e.g. changing text color, text bg color)
 * 
 * @var {object} chalk
 * @see https://www.npmjs.com/package/chalk
 */
const chalk = require("chalk");

/**
 * The library we're using to execute the "lighthouse" and "observatory" cli commands from node
 * 
 * @var {function} shellExec
 * @see https://www.npmjs.com/package/shell-exec
 */
const shellExec = require("shell-exec");

const urlLib = require("./url");

const unixTimeStamp = unix(new Date());

module.exports = {
    placeholders: {
        lighthouse: [
            'url',
            'pathToLighthouseReport',
            'scores.pwa.score',
            'scores.pwa.class',
            'scores.performance.score',
            'scores.performance.class',
            'scores.accessibility.score',
            'scores.accessibility.class',
            'scores.bestPractices.score',
            'scores.bestPractices.class',
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
        // this key is basically a concatenation of the lighthouse and observatory
        // keys with the duplicates removed
        all() {
            // concatenate the lighthouse and observatory values
            let vals =  [
                ...this['lighthouse'],
                ...this['observatory']
            ];

            // remove the duplicates...
            return vals.filter((el, pos) => {
                return vals.indexOf(el) == pos
            });
        },
        note: [
            'metric.name',
            'metric.grade',
            'metric.class',
            'pathToLighthouseReport'
        ],
        'section.notes': [
            'notes'
        ],
        'section.obsRule': [
            'rule.score',
            'rule.slug',
            'rule.desc',
            'rule.result',
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
    },
    regexFor(type) {
        let regex = "";

        // this.placeholders.all is a function but none of the other keys in this.placeholders are so 
        // we detect if the type of this.placeholders[type] is a function and if so, execute it, 
        // if simply save the value to this variable
        const replacements = (typeof this.placeholders[type] === "function") ? this.placeholders[type]() : this.placeholders[type];

        replacements.map(val => {
            regex += `{{${val}}}|`
        });

        regex = regex.substring(0, regex.length - 1);
        
        return {
            regex: new RegExp(regex, "g"),
            placeholders: replacements.map(el => {
                return el;
            })
        };
    },
    generate(testName, values, pdfPath = "") {
        const { regex, placeholders } = this.regexFor(testName);

        fs.readFile(path.resolve(__dirname, `templates/${testName}.html`), "utf8", (err, data) => {
            if(err) {
                console.log(chalk.bgRed.white.bold(err.message.replace("Error: ", "")));
            }

            const replacement = data.replace(regex, match => {
                const rawMatch = this.trimCurlyBraces(match);

                if(rawMatch == "url" || 
                    rawMatch == "pathToLighthouseReport" ||
                    rawMatch == "score" ||
                    rawMatch == "grade"){

                    return values[rawMatch];

                } else if(rawMatch.includes("scores.")) {
                    const keys = rawMatch.replace("scores.", "").split(".");
                    const testName = keys[0];
                    const testAttr = keys[1];

                    return values.scores[testName][testAttr];
                } else if(rawMatch === "section.notes") {
                    const notesFileData = fs.readFileSync(path.resolve(__dirname, "blocks/notes.html"), "utf8");
                    const noteData = fs.readFileSync(path.resolve(__dirname, "blocks/note.html"), "utf8")
                    let noteRegex = this.regexFor("note").regex;
                    let lis = "";
                    
                    values.metrics.map(metric => {
                        lis += noteData.replace(noteRegex, match => {
                            const rawMatch = this.trimCurlyBraces(match);

                            if(rawMatch === "metric.class") {
                                return metric.class;
                            } else if(rawMatch === "metric.name") {
                                return metric.name;
                            } else if(rawMatch === "metric.grade") {
                                return metric.grade;
                            } else if(rawMatch === "pathToLighthouseReport") {
                                return values.pathToLighthouseReport;
                            }
                        });
                    });

                    return notesFileData.replace("{{notes}}", lis);
                } else if(rawMatch === "section.vulns") {
                    const vulnsFileData = fs.readFileSync(path.resolve(__dirname, "blocks/vulns.html"), "utf8");
                    const vulnData = fs.readFileSync(path.resolve(__dirname, "blocks/vuln.html"), "utf8")
                    let vulnRegex = this.regexFor("vuln").regex;
                    let tds = "";
                    
                    values.vulns.vulns.map(vuln => {
                        tds += vulnData.replace(vulnRegex, match => {
                            const rawMatch = this.trimCurlyBraces(match);

                            if(rawMatch === "vuln.libraryVersion") {
                                return vuln.libraryVersion;
                            } else if(rawMatch === "vuln.vulnCount") {
                                return vuln.vulnCount;
                            } else if(rawMatch === "vuln.highestSeverity") {
                                return vuln.highestSeverity;
                            } else if(rawMatch === "vuln.url") {
                                return vuln.url;
                            }
                        });
                    });

                    return vulnsFileData.replace("{{vuln}}", tds).replace("{{vuln.counts}}", values.vulns.total);
                } else if(rawMatch === "host") {
                    return urlLib.domainOnlyURL(values.url);
                } else if(rawMatch === "section.obsRule") {
                    const obsFileData = fs.readFileSync(path.resolve(__dirname, "blocks/obsRule.html"), "utf8");
                    let tds = "";

                    values.rules.map(rule => {
                        tds += obsFileData.replace(this.regexFor("section.obsRule").regex, match => {
                            const rawMatch = this.trimCurlyBraces(match);

                            if(rawMatch === "rule.score") {
                                return rule.score;
                            } else if (rawMatch === "rule.class") {
                                return rule.class;
                            } else if (rawMatch === "rule.slug") {
                                return rule.slug;
                            } else if (rawMatch === "rule.desc") {
                                return rule.desc;
                            } else if (rawMatch === "rule.result") {
                                return rule.result;
                            } else if (rawMatch === "rule.isPassed") {
                                return (rule.isPassed) ? "\u2714" : "\u2718";
                            }
                        });
                    });

                    return tds;
                }
            });

            const generateHTMLPath = path.resolve(__dirname, `generated/test-${unixTimeStamp}.html`);
            fs.writeFile(path.resolve(__dirname, generateHTMLPath), replacement, "utf8", (err) => {
                if(err) {
                    console.log(chalk.bgRed.white.bold(err.message.replace("Error: ", "")))
                }
            });

            const generatedPDFPath = path.resolve(__dirname,`report-${unixTimeStamp}.pdf`);
            shellExec(`html-pdf ${generateHTMLPath} ${generatedPDFPath}`).then(() => {
                console.log(`PDF Saved to: "${generatedPDFPath}"`);

                fs.unlink(path.resolve(__dirname, generateHTMLPath), (err) => {
                    if(err) {
                        console.log(chalk.bgRed.white.bold(err.message.replace("Error: ", "")))
                    }
                });
            }).catch(err => {
                console.log(chalk.bgRed.white.bold(err.message.replace("Error: ", "")));
            });

        });
    },
    trimCurlyBraces(str) {
        return str.replace("{{", "").replace("}}", "");
    }
}