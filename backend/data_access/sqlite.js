var env = process.env.NODE_ENV || 'development'
  , cfg = require('../config/config.'+env);

var options = {};

const db = require('better-sqlite3')(cfg.db.path, options);
 
function database() {
    
    // timestamp : isoDate,
    // level : ilvl,
    // fileName:posArr[0],
    // lineNumber:posArr[1],
    // real_ip:real_ip,
    // message:msg,
    // additional:additional, 
    this.InsertLogEntry = function(entry) {
        const insertAdd = db.prepare('INSERT INTO debugaddittionals (id, line,additionals) VALUES (?,?,?)');
        const insertDbg = db.prepare("INSERT INTO debuglog(id,ts,ilevel,filename,line,real_ip,message) VALUES (?,?,?,?,?,?,?,?)");
        const getNextId = db.prepare("SELECT MAX(id)+1 AS newid FROM debuglog");
        const insertEntry = db.transaction((entry)=>{
            const iInfo = getNextId.get();
            const newId = iInfo.newid;
            const dinfo = insertDbg.run(newId,entry.timestamp,entry.ilvl,entry.filename,entry.line,entry.real_ip,entry.message);
            var line = 1;
            entry.additional.forEach(element => {
                const ainfo = insertAdd.run(newId,line,element);
                line = line + 1;
            });
        })
    }
    function getEntryRow(row,adds) {
        return {
            id : row.id,
            timestamp : row.ts,
            ilvl : row.ilevel,
            filename = row.filename,
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
            additionals.push(add.additionals);
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
        var paramCount = 0;
        for (var name in searchParam) {
            if (searchParam.hasOwnProperty(name)) {
                var cond = '';
                switch (name) {
                    case 'idFrom': cond = 'id >= '+getParam(searchParam[name],'number'); break;
                    case 'idTo':   cond = 'id <= '+getParam(searchParam[name],'number'); break;
                    case 'tsFrom': cond = 'ts >= \''+getParam(searchParam[name],'string')+'\''; break;
                    case 'tsTo':   cond = 'ts <= \''+getParam(searchParam[name],'string')+'\''; break;
                    case 'ilevelList': cond = 'ilevel in '+getListParam(searchParam['ilevel'],'number');break;
                    case 'filename': cond = 'filename = \''+getParam(searchParam[name],'string')+'\''; break;
                    case 'filenameLike': cond = 'filename LIKE \''+getParam(searchParam[name],'string')+'\''; break;
                    case 'real_ip': cond = 'real_ip = \''+getParam(searchParam[name],'string')+'\''; break;
                    case 'messageLike': cond = 'message LIKE \''+getParam(searchParam[name],'string')+'\''; break;
                    default:
                        return 'ERROR: unknown searchParam: '+name;
                }
                if (paramCount <= 0) {
                    sq += "WHERE "+cond+' ';
                } else {
                    sq += "AND "+cond+' ';
                }
                paramCount++;
            }
        }
        sq += ' LIMIT '+getParam(limit,'number')+' OFFSET '+getParam(offset,'number');
        return sq;
    }
    this.searchLogEntries = function(searchParam,limit,offset) {
        if (typeof searchParam !== 'object' || typeof limit !== 'number' || typeof offset !== 'number') {
            return {ok:false,error:'ParameterError'};
        }
        if (limit <= 0 || limit > 50) {
            limit = 10;
        }
        const sq = getSearchQuery(searchParam,limit,offset);
        if (!sq.startsWith('SELECT')) {
            return {ok:false,error:sq};
        }
        var result = [];
        const stmt = db.prepare(sq);
        for (const row of stmt.iterate()) {
            result.push(getEntryRow(row,[]));
        }
        return {ok : true,data : result};
    }
}

module.exports = new database();