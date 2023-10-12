'use strict';

const recstorage = require('./recstorage');
var utils = require('./../utils');
const usrstorage = require("../users/usrstorage");

const version = '1.00';
var settings;                   // Application settings
var logger;                     // Application logger

function init(_settings, log) {
    settings = _settings;
    logger = log;

    // Init Users database
    return new Promise(function (resolve, reject) {
        recstorage.init(settings, logger).then(result => {
            logger.info('recipe.recstorage-init successful!', true);
            if (result) {
                resolve();
            } else {
                recstorage.setDefault().then(result => {
                    logger.info('recipe.recstorage-set-default successful!', true);
                    resolve();
                }).catch(function (err) {
                    logger.error(`recipe.recstorage.set-default failed! ${err}`);
                    resolve();
                });
            }
        }).catch(function (err) {
            logger.error(`recipe.recstorage-init failed ${err}`);
            reject(err);
        });
    });
}

function setRecipe(recipeData) {
    return new Promise((resolve, reject) => {
        recipeData.creationTime = Date.now();
        recipeData.lastModifiedTime = Date.now();
        recipeData.isActive = false;
        recstorage.addRecipe(recipeData)
            .then(recipeId => {
                console.log("Recipe successfully added with ID:", recipeId);
                resolve(recipeId); // 如果需要，可以将新的recipeId返回给调用者
            })
            .catch(error => {
                console.error('Error adding the recipe:', error);
                reject(error);
            });
    });
}

function getRecipes() {
    return new Promise((resolve, reject) => {
        recstorage.getRecipes()
            .then(recipes => {
                resolve(recipes);
            })
            .catch(error => {
                logger.error()
                reject(error);
            });
    });
}

function updateRecipe(recipeData) {
    return new Promise((resolve, reject) => {
        recstorage.updateRecipe(recipeData)
            .then(() => {
                console.log('Recipe successfully updated');
                resolve(); // 如果需要，可以将一些成功信息返回给调用者
            })
            .catch(error => {
                // 在错误日志中包含 recipeData.id
                console.error('Error updating the recipe with ID', recipeData.id, ':', error);
                reject(error);
            });
    });
}

function removeRecipeFromDatabase(recipeId) {
    return new Promise((resolve, reject) => {
        recstorage.removeRecipe(recipeId)
            .then(() => {
                console.log(`Recipe with ID ${recipeId} successfully removed!`);
                resolve();
            })
            .catch(error => {
                console.error('Error removing the recipe:', error);
                reject(error);
            });
    });
}


function uploadRecipeToRun(recipeId){



}


module.exports = {
    init: init,
    getRecipes: getRecipes,
    updateRecipe: updateRecipe,
    setRecipe: setRecipe
};