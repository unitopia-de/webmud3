'use strict';

var express = require('express');
var router = express.Router();
var logger = require('./ngxlogger');
// middleware that is specific to this router
router.use(function(req,res,next){
    // TODO authentification
    // TODO realip ermitteln und ergaenzen.
    console.log(req.method,req.url);
    next();
})


router.route('/logentry')
.put(authcon.insert)
.get(authcon.loggedon);

router.route('/logout')
.post(authcon.logout);

router.route('/register')
.post(authcon.register);

router.route('/searchinvitations')
.post(authcon.searchInvitations);

router.route('/invitation')
.get(authcon.selectOneInvitation)
.post(authcon.createInvitation)
.put(authcon.updateInvitation);

module.exports = router