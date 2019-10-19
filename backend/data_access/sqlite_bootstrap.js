var env = process.env.NODE_ENV || 'development'
  , cfg = require('../config/config.'+env);

var options = {};

const db = require('better-sqlite3')(cfg.db.path, options);

// docker run --volume /UNItopia/ftpwww/webmud3/run/db/:/run/db -it myonara/webmud3:unitopiatest node /app/data_access/sqlite_bootstrap.js

// timestamp : isoDate,
// level : ilvl,
// fileName:posArr[0],
// lineNumber:posArr[1],
// real_ip:real_ip,
// message:msg,
// additional:additional,

const creation = 'DROP TABLE IF EXISTS debugaddittionals;DROP TABLE IF EXISTS debuglog;'+
                 'CREATE TABLE debuglog(id BIGINT primary key, ts VARCHAR(20), '+
                    'ilevel SMALLINT,filename VARCHAR(400),line INTEGER,real_ip  VARCHAR(100), message  TEXT);'+
                 'CREATE TABLE debugaddittionals(id BIGINT,line INTEGER,additionals TEXT,PRIMARY KEY (id,line), '+
                 'FOREIGN KEY (id) REFERENCES debuglog(id));' +
                 '';

db.exec(creation);