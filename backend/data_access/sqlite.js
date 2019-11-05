const creation = 'DROP TABLE IF EXISTS debugaddittionals;DROP TABLE IF EXISTS debuglog;'+
                 'CREATE TABLE debuglog(id BIGINT primary key, ts VARCHAR(20), '+
                    'ilevel SMALLINT,filename VARCHAR(400),line INTEGER,real_ip  VARCHAR(100), message  TEXT);'+
                 'CREATE TABLE debugaddittionals(id BIGINT,line INTEGER,additionals TEXT,PRIMARY KEY (id,line), '+
                 'FOREIGN KEY (id) REFERENCES debuglog(id));' +
                 '';

var options = {};

var db_filename = typeof process.env.MY_LOG_DB; // can be undefined, then module shouldn't be loaded...
console.log('dbpath: ',db_filename);
var db = require('better-sqlite3')(db_filename, options);
 
function database() {
    
    var begin = db.prepare('BEGIN');
    var commit = db.prepare('COMMIT');
    var rollback = db.prepare('ROLLBACK');

    // Higher order function - returns a function that always runs in a transaction
    function asTransaction(func) {
        return function (...args) {
            begin.run();
            try {
            func(...args);
            commit.run();
            } finally {
            if (db.inTransaction) rollback.run();
            }
        };
    }
    function bootstrap(flag) {
        if (flag) {
            db.exec(creation);
        }
        try {
            var getNextId = db.prepare("SELECT MAX(id)+1 AS newid FROM debuglog");
            getNextId.get();
            var checkAdds = dp.prepare("SELECT COUNT(*) FROM debugaddittionals");
            checkAdds.get();
        } catch (error) {
            db.exec(creation);
        }
    }
    // timestamp : isoDate,
    // level : ilvl,
    // fileName:posArr[0],
    // lineNumber:posArr[1],
    // real_ip:real_ip,
    // message:msg,
    // additional:additional, 
    this.InsertLogEntry = function(entry) {
        bootstrap(false);
        // console.log('InsertLogEntry: ',entry);
        var insertAdd = db.prepare('INSERT INTO debugaddittionals (id, line,additionals) VALUES (?,?,?)');
        var insertDbg = db.prepare("INSERT INTO debuglog(id,ts,ilevel,filename,line,real_ip,message) VALUES (?,?,?,?,?,?,?)");
        var getNextId = db.prepare("SELECT MAX(id)+1 AS newid FROM debuglog");
        var insertEntry = asTransaction(function(entry) {
            var iInfo = getNextId.get();
            var newId = iInfo.newid || 1;
            insertDbg.run(newId,entry.timestamp,entry.level,entry.fileName,entry.lineNumber,entry.real_ip,entry.message);
            var line = 1;
            entry.additional.forEach(element => {
                var el = '';
                if (typeof element === 'string') {
                    el = element;
                } else {
                    el = JSON.stringify(element);
                }
                insertAdd.run(newId,line,el);
                line = line + 1;
            });
        })
        insertEntry(entry); 
    }
    function getEntryRow(row,adds) {
        return {
            id : row.id,
            timestamp : row.ts,
            ilvl : row.ilevel,
            filename : row.filename,
            line : row.line,
            real_ip : row.real_ip,
            message : row.message,
            additional :adds,
        };
    }
    this.GettLogEntry = function(id) {
        const selectDbg = db.prepare('SELECT id,ts,ilevel,filename,line,real_ip,message FROM debuglog WHERE id = ?');
        const selectAdd = db.prepare('SELECT additionals FROM debugaddittionals WHERE id = ? ORDER BY line ASC');
        var additionals = [];
        for (const adds of selectAdd.iterate(id)) {
            additionals.push(adds.additionals);
        }
        const row = selectDbg.get(id);
        return getEntryRow(row,additionals);
    }
    function getParam(val,typ) {
        if (typeof val == typ) {
            if (typ == 'string') {
                const sea = '' + val;
                if (sea.indexOf('\'')>-1) {
                    return ''; // prevent sql injectionw ith '
                }
            }
            return val;
        }
        switch (typ) {
            default:
            case 'undefined':
            case 'null':   return null;
            case 'number': return 0;
            case 'string': return '';
        }
    }
    function getListParam(list,typ) {
        var rstr = '(';
        var val;
        list.forEach(function(val) {
            if (typeof val !== typ) {
                return "()";
            }
            if (typ =='number') {
                if (rstr == '(') {
                    rstr += ''+val;
                } else {
                    rstr +=','+val;
                }
            } else {
                if (rstr == '(') {
                    rstr += '\''+val+'\'';
                } else {
                    rstr += ',\''+val+'\'';
                }
            }
        });
        rstr += ')';
        return rstr;
    }
    function getSearchQuery(searchParam,limit,offset) {
        var sq = 'SELECT id,ts,ilevel,filename,line,real_ip,message FROM debuglog ';
        var sqc = 'SELECT COUNT(id) AS cnt FROM debuglog ';
        var paramCount = 0;
        for (var name in searchParam) {
            if (searchParam.hasOwnProperty(name)) {
                var cond = '';var rip='';
                switch (name) {
                    case 'idFrom': cond = 'id >= '+getParam(searchParam[name],'number'); break;
                    case 'idTo':   cond = 'id <= '+getParam(searchParam[name],'number'); break;
                    case 'tsFrom': cond = 'ts >= \''+getParam(searchParam[name],'string')+'\''; break;
                    case 'tsTo':   cond = 'ts <= \''+getParam(searchParam[name],'string')+'\''; break;
                    case 'iLevelList': cond = 'ilevel IN '+getListParam(searchParam[name],'number');break;
                    case 'filename': cond = 'filename = \''+getParam(searchParam[name],'string')+'\''; break;
                    case 'filenameLike': cond = 'filename LIKE \''+getParam(searchParam[name],'string')+'\''; break;
                    case 'messageLike': cond = 'message LIKE \''+getParam(searchParam[name],'string')+'\''; break;
                    case 'orderby': continue;
                    case 'real_ip': 
                        rip = getParam(searchParam[name],'string');
                        cond = '(real_ip = \''+rip+'\' OR real_ip =\'SRV:'+rip+'\')'; 
                        break;
                    default:
                        return [undefined,undefined,'ERROR: unknown searchParam: '+name];
                }
                if (paramCount <= 0) {
                    sq += "WHERE "+cond+' ';
                    sqc += "WHERE "+cond+' ';
                } else {
                    sq += "AND "+cond+' ';
                    sqc += "AND "+cond+' ';
                }
                paramCount++;
            }
        }
        if (typeof searchParam.orderby !== 'undefined') {
            switch(searchParam.orderby) {
                default:
                case 'seqdesc':
                    sq += 'ORDER BY id DESC '; break;
                case 'seqasc':
                    sq += 'ORDER BY id ASC '; break;
                case 'tsdesc':
                    sq += 'ORDER BY ts DESC, id DESC '; break;
                case 'tsasc':
                    sq += 'ORDER BY ts ASC, id ASC '; break;
                }
        } else {
            sq += 'ORDER BY id DESC ';
        }
        sq += ' LIMIT '+getParam(limit,'number')+' OFFSET '+getParam(offset,'number');
        return [sq,sqc,undefined];
    }
    this.searchLogEntries = function(searchParam,limit,offset) {
        if (typeof searchParam !== 'object' || typeof limit !== 'number' || typeof offset !== 'number') {
            return {ok:false,error:'ParameterError'};
        }
        if (limit <= 0 || limit > 50) {
            limit = 10;
        }
        var sq = getSearchQuery(searchParam,limit,offset);
        console.log("sq=",sq);
        if (typeof sq[2] !=='undefined') {
            return {ok:false,error:sq[2]};
        }
        var result = [];
        // sq = "SELECT * FROM debuglog LIMIT 50";
        const stmt = db.prepare(sq[0]);
        const cnts = db.prepare(sq[1]);
        var cnt = cnts.get();
        // var result = stmt.all();
        for (const row of stmt.iterate()) {
            result.push(getEntryRow(row,undefined));
        }
        // console.log("result=",result);
        return {ok : true,count:cnt,data : result};
    }
}

module.exports = new database();