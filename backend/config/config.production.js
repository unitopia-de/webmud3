var config = require('./config.global');

config.env = 'production';

config.whitelist = ['https://www.unitopia.de','https://www.unitopia.de/webmud3/'];

config.muds.unitopia = {
    name : 'UNItopia',
    host : 'unitopia.de',
    port : 992, // SSL-Port!!!
    ssl  : true,
    rejectUnauthorized: true,
    description: 'UNItopia via SSL',
    playerlevel : 'all',
    mudfamily : 'unitopia',
};

config.muds.orbit = {
    name : 'Orbit',
    host : 'unitopia.de',
    port : 9988, // SSL-Port!!!
    ssl  : true,
    rejectUnauthorized: true,
    description: 'Orbit via SSL',
    playerlevel : 'wizard,testplayer',
    mudfamily : 'unitopia',
};

config.muds.uni1993 = {
    name : 'Uni1993',
    host : 'unitopia.de',
    port : 1993, 
    ssl  : false,
    rejectUnauthorized: false,
    description: 'Unitopia 1993',
    playerlevel : 'all',
    mudfamily : 'basistelnet',
};

config.tls = false;

module.exports = config;