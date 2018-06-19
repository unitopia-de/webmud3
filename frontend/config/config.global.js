var config = module.exports = {};

config.env = 'development';

config.other = {
    storage : {
        url : 'http://localhost:8000',
        host: 'localhost',
        port: 8000
    }
}

config.mudfamilies = {
    unitopia : {
        MXP : true,
        GMCP : true,
    }
}

config.muds = {};
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
