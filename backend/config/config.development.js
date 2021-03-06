var config = require('./config.global');

config.env = 'development';

config.whitelist = ['http://localhost:2018','http://localhost:5000','http://localhost:4200',];

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

config.muds.unitopia1 = {
    name : 'UNItopia1',
    host : 'unitopia.de',
    port : 992, // SSL-Port!!!
    ssl  : true,
    rejectUnauthorized: false,
    description: 'UNItopia via SSL w/o reject',
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

config.muds.orbit1 = {
    name : 'Orbit1',
    host : 'unitopia.de',
    port : 9988, // SSL-Port!!!
    ssl  : true,
    rejectUnauthorized: false,
    description: 'Orbit via SSL w/o reject',
    playerlevel : 'wizard,testplayer',
    mudfamily : 'unitopia',
};

config.muds.orbit2 = {
    name : 'Orbit2',
    host : 'unitopia.de',
    port : 9876, // non SSL!!
    ssl  : false,
    rejectUnauthorized: true, // unused
    description: 'Orbit w/o SSL Only for internal testing purposes',
    playerlevel : 'wizard,testplayer',
    mudfamily : 'unitopia',
};

config.muds.orbit3 = {
    name : 'Orbit3',
    host : 'unitopia.de',
    port : 9876, // non SSL!!
    ssl  : true,
    rejectUnauthorized: true, // unused
    description: 'Orbit for internal testing purposes',
    playerlevel : 'wizard,testplayer',
    mudfamily : 'unitopia',
};

module.exports = config;