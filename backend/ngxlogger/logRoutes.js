'use strict';

var express = require('express');
var router = express.Router();
var logger = require('./ngxlogger');
// middleware that is specific to this router
router.use(function(req,res,next){
    // TODO realip ermitteln und ergaenzen.
    if (req.session.user) {
        console.log('logRoutes: ',req.method,req.url);
        next();
        return;
    }
    res.status(401).send({ // Unauthorised
        msgid:'BUG99',msg: 'You need to logon',msgclass:'LogonRequired'
    });
    next();
})

router.route('/search')
.get(logger.getEntry)
.post(logger.search);

module.exports = router