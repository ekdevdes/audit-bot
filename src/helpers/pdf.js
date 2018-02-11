// Libraries
const path = require("path");
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
    pagespeed: [],
    all() {
        let vals = [...this.lighthouse, ...this.observatory, ...this.pagespeed];

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
    scores: {
        pwa: {
            class: "good",
            score: 98
        }
    }
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
// DELETE THIS LINE: uses expand-object – expand("scores.performance.score|scores.performance.class") -> { scores: { performance: { score: '', class: '' } } }
// DELETE THIS LINE: envisioned usage of this function: pdf.addData("url", "http://ethankr.me") or pdf.addData("pwa", {score: 98, class: "good"})
// adds a piece of data to an internal object that will ultimately be used to fill in template data
function addData(key, data) {
    // DELETE THESE LINES: how to use expand object
    let obj1 = expandObject("scores.pwa.class|scores.pwa.score");
    let obj2 = expandObject("scores.performance.class|scores.performance.score");
    // END DELETE THESE LINES

    // DELETE THESE LINES: how to merge objects.scores of multiple objects together
    let obj3 = Object.assign(obj1.scores, obj2.scores);
    // END DELETE THESE LINES

    // DELETE THESE LINES: how to merge the existing value of templateData.scores with the new value so I can set templateData.scores to this new value
    // DELETE THESE LINES: envisioned usage of this addData function pdf.addData("pwa", {score: 98, class: "good"})
    let expandedObject = expandObject(`scores.${key}.class|scores.${key}.score`);

    expandedObject.scores[key].class = data.class;
    expandedObject.scores[key].score = data.score;

    let obj4 = Object.assign(templateData.scores, expandedObject.scores);

    console.log(obj4);
    // END DELETE THESE LINES
}

// generates a PDF with data from an internal object (built by addData() method) and uses that info to fill in an HTML template then converts that HTML template to a PDF
async function generate(testName, pdfPath = "") {

}

module.exports = {
    addData,
    generate
};