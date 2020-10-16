/**
 * 'api/auth': Authentication API to Sign In/Out users
 */

var express = require("express");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authJwt = require('../jwt-helper');

var runtime;
var secretCode;
var tokenExpiresIn;

module.exports = {
    init: function (_runtime, _secretCode, _tokenExpires) {
        runtime = _runtime;
        secretCode = _secretCode;
        tokenExpiresIn = _tokenExpires;
    },
    app: function () {
        var authApp = express();
        authApp.use(function (req, res, next) {
            if (!runtime.project) {
                res.status(404).end();
            } else {
                next();
            }
        });

        /**
         * POST SignIn
         * Sign In with User credential
         */
        authApp.post("/api/signin", function (req, res, next) {
            console.log(req.body.params)
            runtime.users.findOne(req.body).then(function (userInfo) {
                if (userInfo && userInfo.length && userInfo[0].password) {
                    if (bcrypt.compareSync(req.body.password, userInfo[0].password)) {
                        const token = jwt.sign({ id: userInfo[0].username, groups: userInfo[0].groups }, secretCode, { expiresIn: tokenExpiresIn });//'1h' });
                        res.json({ status: "success", message: "user found!!!", data: { username: userInfo[0].username, groups: userInfo[0].groups , token: token } });
                        runtime.logger.info("api post signin: " + userInfo[0].username + " " + + userInfo[0].groups);
                    } else {
                        res.status(401).json({ status: "error", message: "Invalid email/password!!!", data: null });
                        runtime.logger.error("api post signin: Invalid email/password!!!");
                    }
                } else {
                    res.status(404).end();
                    runtime.logger.error("api post signin: Not Found!");
                }
            }).catch(function (err) {
                if (err.code) {
                    res.status(400).json({error:err.code, message: err.message});
                } else {
                    res.status(400).json({error:"unexpected_error", message:err.toString()});
                }
                runtime.logger.error("api post signin: " + err.message);
            });
        });

        return authApp;
    }
}