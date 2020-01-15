'use strict';

const jwt = require('jsonwebtoken');

var secretCode = 'frangoteam751';

function init(_secretCode) {
    if (_secretCode) {
        secretCode = _secretCode;
    }
}

function verifyToken (req, res, next) {
    let token = req.headers['x-access-token'];

    if (token) {
        jwt.verify(token, secretCode, (err, decoded) => {
            if (err) {
                req.userId = null;
                next();
                // return res.status(500).send({
                //     auth: false,
                //     message: 'Fail to Authentication. Error -> ' + err
                // });
            } else {
                req.userId = decoded.id;
                next();
            }
        });
    } else {
        // notice that no token was provided...}
        req.userId = null;        
        next();
    }
}


module.exports = {
    init: init,
    verifyToken: verifyToken,
    secretCode: secretCode
};
