var config = module.exports = {};

config.env = 'development';

config.mudfamilies = {
    basistelnet : {
        charset: 'ascii',
        MXP : false,
        GMCP : false,
        GMCP_Support: {}
    },
    unitopia : {
        charset: 'utf8',
        MXP : true,
        GMCP : true,
        GMCP_Support: {
            Sound : {
                version : '1',
                standard: true,
                optional: false,
            },
            Char : {
                version : '1',
                standard:true,
                optional:false,
            },
            'Char.Items' : {
                version : '1',
                standard:true,
                optional:false,
            },
            Comm : {
                version : '1',
                standard:true,
                optional:false,
            },
            Playermap : {
                version : '1',
                standard:false,
                optional:true,
            },
            Files : {
                version : '1',
                standard:false,
                optional:true,
            },
        }
    }
}

config.tls = process.env.TLS || false;
config.tls_cert = process.env.TLS_CERT || '';
config.tls_key = process.env.TLS_KEY || '',

config.muds = {};