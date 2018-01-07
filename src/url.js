module.exports = {
    regex: /(https?):\/\/([a-zA-Z0-9-_.]{2,63}):?([0-9]{4,5})?\/?(\#)?([\/a-zA-Z0-9-_.]{1,})?\??([a-zA-Z0-9&-_.=]{1,})?/g,
    isURLValid(url) {
        const urlMatch = url.match(this.regex);

        return urlMatch && urlMatch.length;
    },
    domainOnlyURL(url) {
        const matches = this.regex.exec(url);

        return matches[2];
    },
    isLocal(url) {
        return url.includes("localhost");
    }

}