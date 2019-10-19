'use strict';

var express = require('express');
var router = express.Router();
var logger = require('./ngxlogger');
// middleware that is specific to this router
router.use(function(req,res,next){
    // TODO authentification
    // TODO realip ermitteln und ergaenzen.
    console.log('logRoutes: ',req.method,req.url);
    next();
})

router.route('/search')
.post(logger.search);

module.exports = router