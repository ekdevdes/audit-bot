module.exports = {
    isURLValid(url) {
        const rx = /(https?):\/\/([a-zA-Z0-9-_.]{2,63}):?([0-9]{4,5})?\/?(\#)?([\/a-zA-Z0-9-_.]{1,})?\??([a-zA-Z0-9&-_.=]{1,})?/g;
        const urlMatch = url.match(rx);

        return urlMatch && urlMatch.length;
    },
    domainOnlyURL(url) {
        const rx = /(https?):\/\/([a-zA-Z0-9-_.]{2,63}):?([0-9]{4,5})?\/?(\#)?([\/a-zA-Z0-9-_.]{1,})?\??([a-zA-Z0-9&-_.=]{1,})?/g;
        return rx.exec(url)[2];
    },
    isLocal(url) {
        return url.includes("localhost");
    }

}