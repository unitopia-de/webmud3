'use strict';

var express = require('express');
var router = express.Router();
var authcon = require('./auth');
// middleware that is specific to this router
router.use(function(req,res,next){
    var ip = req.headers['x-forwarded-for'] || 
     req.connection.remoteAddress || 
     req.socket.remoteAddress ||
     (req.connection.socket ? req.connection.socket.remoteAddress : null);
    console.log(ip,"/api/auth",req.method,req.url);
    next();
})


router.route('/login')
.post(authcon.logon)
.get(authcon.loggedon);

router.route('/logout')
.post(authcon.logout);

module.exports = router