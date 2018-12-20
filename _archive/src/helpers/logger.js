const chalk = require("chalk");

// Logging helper functions
function logWarning(msg) {
    console.log(chalk.bgYellow.black.bold(`[WARN] ${msg}`));
}

function logError(msg) {
    console.log(chalk.bgRed.white.bold(`[ERROR] ${msg.replace("Error: ", "")}`));
}

function logMultilineMsg(msgs) {
    console.log(msgs.join("\n"));
}

function logNewLine() {
    console.log("");
}

// Information formatting helper functions
function formatFileName(path) {
    return chalk.cyan.bold.underline(path);
}

function formatRuleName(ruleSlug) {
    if(ruleSlug.includes("x-")) {
        const parts = ruleSlug.split("-");
        let result = "";

        for(var i = 0; i < parts.length; i++) {
            const part = parts[i];

          if(i === 0) {
              result += `${part.toUpperCase()}-`;
          } else {
              let newPart = (part === "xss") ?  ("XSS") : (part.charAt(0).toUpperCase() + part.slice(1));
              result += `${newPart}-`;
          }
        }

        result = result.substring(0, result.length - 1);

        return result;
    } else {
        let prettyName = ruleSlug.replace(/-/g, " ");

        return prettyName.charAt(0).toUpperCase() + prettyName.slice(1);
    }
}

module.exports = {
    logWarning,
    logError,
    formatFileName,
    logMultilineMsg,
    logNewLine,
    formatRuleName
}