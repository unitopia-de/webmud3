var config = module.exports = {};

config.env = 'development';

config.other = {
    storage : {
        url : 'http://localhost:8000',
        host: 'localhost',
        port: 8000,
        active:false,
    }
}

config.mudfamilies = {
    unitopia : {
        MXP : true,
        GMCP : true,
    }
}

config.tls = process.env.TLS || false;
config.tls_cert = process.env.TLS_CERT || '';
config.tls_key = process.env.TLS_KEY || '',

config.muds = {};