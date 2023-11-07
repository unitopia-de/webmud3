var config = require('./config.global');

config.env = 'development';

config.whitelist = ['http://localhost:2018','http://localhost:5000','http://localhost:4200',];

module.exports = config;