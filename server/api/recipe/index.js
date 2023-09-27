var express = require("express");
const authJwt = require('../jwt-helper');
var runtime;
var secureFnc;
var checkGroupsFnc;

module.exports = {
    init: function (_runtime, _secureFnc, _checkGroupFnc) {
        runtime = _runtime;
        secureFnc = _secureFnc;
        checkGroupsFnc = _checkGroupFnc
    },
    app: function () {
        var recApp = express();
        recApp.use(function (req, res, next){
           if(!runtime.recipe){
               res.status(404).end();
           } else {
               next();
           }
        });

        recApp.get("/api/recipes", secureFnc, function(req, res){
            runtime.recipe.pageRecipes(req.pageN, req.pagS).then(result => {
                if (result) {
                    res.json(result);
                } else {
                    res.status(404).end();
                    runtime.logger.error("api get project: Not Found!");
                }
            }).catch(function(err) {
                if (err && err.code) {
                    if (err.code !== 'ERR_HTTP_HEADERS_SENT') {
                        res.status(400).json({error:err.code, message: err.message});
                        runtime.logger.error("api get project: " + err.message);
                    }
                } else {
                    res.status(400).json({error:"unexpected_error", message: err});
                    runtime.logger.error("api get project: " + err);
                }
            });
        })

        recApp.post("api/recipe", secureFnc, function (req, res,){
            var groups = checkGroupsFnc(req);
            if(res.statusCode === 403){
                runtime.logger.error("api post users: Tocken Expired");
            } else if(authJwt.adminGroups.indexOf(groups) === -1){
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                runtime.logger.error("api post users: Unauthorized");
            } else {
                runtime.recipe.setRecipe(req.body.params).then(function () {
                    res.end();
                }).catch(function (err){
                    if (err.code) {
                        res.status(400).json({error:err.code, message: err.message});
                    } else {
                        res.status(400).json({error:"unexpected_error", message:err.toString()});
                    }
                    runtime.logger.error("api post recipe: " + err.message);
                })
            }
        })

        return recApp;

    }
}