'use strict';

const url = require('url');

const dbglvl = ['TRACE','DEBUG','INFO','LOG','WARN','ERROR','FATAL','OFF'];
var outputlevel = 0; // Errors,Fatals...

// var NGXLogger = class NGXLogger {
module.exports = {

    addLogEntry : function(log) {
    },
    createLogEntry : function (real_ip,lvl,msg,additional) {
        var isoDate = new Date().toISOString();
        var posArr = this.getPosition(this.getStackLine(4));
        var ilvl = 0;
        if (typeof(lvl) === 'string') {
            ilvl = dbglvl.indexOf(lvl);
        } else if (typeof lvl === 'number' && lvl >= 0 && lvl < dbglvl.length) {
            ilvl = lvl;
        }
        var log = {
            timestamp : isoDate,
            level : ilvl,
            fileName:posArr[0],
            lineNumber:posArr[1],
            real_ip:real_ip,
            message:msg,
            additional:additional,
        }
        return log;
    },
    addAndShowLog : function(real_ip,lvl,msg,additional) {
        var log = this.createLogEntry(real_ip,lvl,msg,additional);
        this.addLogEntry(log);
        this.log2console(log);
    },

    log2string : function (log){
    // function log2srting(log) {
        var outpline =log.timestamp+" "+dbglvl[log.level]+" ["+log.fileName+":"+log.lineNumber+']'+log.real_ip+'\r\n'+(log.message||'(####)')+' ';
        log.additional.forEach(function(val,idx,arr){
            if (typeof val !== 'string') {
                outpline = outpline + JSON.stringify(val,undefined,"\r");
            } else {
                outpline = outpline + val;
            }
        })
        return outpline;
    },
    log2console : function (log) {
        if (log.level < outputlevel) {
            return;
        }
        var outpline = this.log2string(log)+"\r\n";
        switch (dbglvl[log.level]) {
            case 'TRACE':
                    console.debug(outpline);
                    break;
            case 'DEBUG':
                    console.debug(outpline);
                    break;
            case 'INFO':
                    console.info(outpline);
                    break;
            case 'LOG':
                    console.log(outpline);
                    break;
            case 'WARN':
                    console.warn(outpline);
                    break;
            case 'ERROR':
                    console.error(outpline);
                    break;
            case 'FATAL':
                    console.error(outpline);
                    break;
            case 'OFF':
                break;
        }
    },
    getPosition : function (stackLine) {
        const position = stackLine.substring(stackLine.lastIndexOf('(') + 1, stackLine.indexOf(')'));
        const dataArray = position.split(':');
        // console.log('getPosition',stackLine,position,dataArray);
        if (dataArray.length === 3) { // unix
            return [dataArray[0], +dataArray[1], +dataArray[2]]
        } else if (dataArray.length === 4) { // windows
            return [dataArray[0]+":"+dataArray[1], +dataArray[2], +dataArray[3]]
        } else {
            return ['unknown',0,0];
        }
    },

    getStackLine : function(lvl) {
        const error = new Error();
    
        try {
          // noinspection ExceptionCaughtLocallyJS
          throw error;
        } catch (e) {
    
          try {
            // console.info('stack',error.stack);
            return error.stack.split('\n')[lvl];
          } catch (e) {
            return null;
          }
        }
      },

};
