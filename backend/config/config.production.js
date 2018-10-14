var config = require('./config.global');

config.env = 'production';

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

module.exports = config;