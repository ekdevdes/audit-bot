use strict';

const Hapi = require('hapi');
const dotenv = require('dotenv').config();

const port = process.env.PORT || 4040;

const server = Hapi.server({
    port,
    host: 'localhost'
});

server.route({
    method: 'POST',
    path: '/api/audit',
    handler (request, h)  {
        const siteUrl = request.payload;
        return `Url to audit recieved ${siteUrl}`;
    }
});

const init = async () => {
    await server.start();
    console.log(`Server running at: ${server.info.uri}`);
};

process.on('unhandledRejection', (err) => {
    console.log(err);
    process.exit(1);
});

init();
