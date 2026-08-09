'use strict';

const http = require('http');
const express = require('express');
const sinon = require('sinon');

const recipesApi = require('../../api/recipes');

let expect;

function request(server, path) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            host: '127.0.0.1',
            port: server.address().port,
            method: 'GET',
            path
        }, (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: body ? tryParse(body) : null
                });
            });
        });
        req.on('error', reject);
        req.end();
    });
}

function postRequest(server, path, body) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(body);
        const options = {
            host: '127.0.0.1',
            port: server.address().port,
            method: 'POST',
            path,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        const req = http.request(options, (res) => {
            let data = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data ? tryParse(data) : null
                });
            });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

function deleteRequest(server, path) {
    return new Promise((resolve, reject) => {
        const options = {
            host: '127.0.0.1',
            port: server.address().port,
            method: 'DELETE',
            path
        };
        const req = http.request(options, (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    body: body ? tryParse(body) : null
                });
            });
        });
        req.on('error', reject);
        req.end();
    });
}

function tryParse(str) {
    try { return JSON.parse(str); } catch (e) { return str; }
}

describe('Recipes API', () => {
    let server;
    let runtime;
    let sandbox;

    // Mutable user captured by the auth fns below — tests switch the caller
    // by reassigning this, e.g. guest vs non-admin vs admin.
    let currentUser = { userId: 'user-1', groups: ['admin'] };

    before(async () => {
        const chai = await import('chai');
        expect = chai.expect;
    });

    beforeEach(async () => {
        sandbox = sinon.createSandbox();

        const recipeService = require('../../runtime/recipes/recipe-service');

        runtime = {
            settings: {},
            project: {
                id: 'test-project',
                ProjectDataCmdType: {
                    SetRecipe: 'set-recipe',
                    DelRecipe: 'del-recipe'
                },
                getRecipe: sandbox.stub().returns(null),
                getRecipesSync: sandbox.stub().returns([]),
                setProjectData: sandbox.stub().resolves(true)
            },
            recipeStorage: {
                getRecipeData: sandbox.stub().resolves(null),
                getAllRecipes: sandbox.stub().resolves([]),
                getAllRecipeInstances: sandbox.stub().resolves([]),
                setRecipeData: sandbox.stub().resolves({ changes: 1 }),
                deleteRecipeData: sandbox.stub().resolves({ changes: 1 }),
                deleteAllRecipesByType: sandbox.stub().resolves({ changes: 0 })
            },
            recipeService: {
                isRecipeRunning: sandbox.stub().returns(false),
                downloadRecipe: sandbox.stub().resolves(),
                uploadRecipe: sandbox.stub().resolves(),
                coerceValue: recipeService.coerceValue
            },
            logger: {
                error() {},
                info() {}
            }
        };

        function secureFnc(req, res, next) {
            req.userId = currentUser.userId;
            req.userGroups = currentUser.groups;
            next();
        }

        function checkGroupsFnc(req) {
            return currentUser.groups;
        }

        recipesApi.init(runtime, secureFnc, checkGroupsFnc);

        const app = express();
        app.use(express.json());
        app.use(recipesApi.app());

        server = await new Promise((resolve) => {
            const listeningServer = app.listen(0, '127.0.0.1', () => {
                resolve(listeningServer);
            });
        });
    });

    afterEach((done) => {
        sandbox.restore();
        server.close(done);
    });

    describe('GET /api/recipes/types and /api/recipes/instances', () => {
        it('should return list of recipe types', async () => {
            const recipes = [
                { id: 'r_001', data: { id: 'r_001', name: 'Recipe 1', entries: [{ id: 'e_001', tagId: 't1', tagName: 'T1', tagType: 'int', value: '42' }] } },
                { id: 'r_002', data: { id: 'r_002', name: 'Recipe 2', entries: [{ id: 'e_002', tagId: 't2', tagName: 'T2', tagType: 'real', value: '3.14' }] } }
            ];
            runtime.project.getRecipesSync.returns(recipes.map(row => row.data));

            const res = await request(server, '/api/recipes/types');

            expect(res.statusCode).to.equal(200);
            expect(res.body.recipes).to.have.lengthOf(2);
            expect(res.body.recipes[0].id).to.equal('r_001');
        });

        it('should return single recipe instance by id', async () => {
            const recipeData = { name: 'Test', entries: [{ id: 'e_001', tagId: 't1', tagName: 'T1', tagType: 'int', value: '42' }] };
            runtime.recipeStorage.getRecipeData.withArgs('r_test').resolves(recipeData);

            const res = await request(server, '/api/recipes/instances/r_test');

            expect(res.statusCode).to.equal(200);
            expect(res.body.name).to.equal('Test');
        });

        it('should merge instance values with the current recipe type entries', async () => {
            runtime.project.getRecipe.withArgs('r_type').returns({
                id: 'r_type',
                name: 'Type',
                entries: [
                    { id: 'e_a', tagId: 'tag-a', tagName: 'Tag A', tagType: 'int', value: 0 },
                    { id: 'e_b', tagId: 'tag-b', tagName: 'Tag B', tagType: 'string', value: '' }
                ]
            });
            runtime.recipeStorage.getRecipeData.withArgs('r_instance').resolves({
                id: 'r_instance',
                typeId: 'r_type',
                name: 'Instance',
                entries: [{ tagId: 'tag-a', value: 42 }]
            });

            const res = await request(server, '/api/recipes/instances/r_instance');

            expect(res.statusCode).to.equal(200);
            expect(res.body.entries.map(entry => entry.tagId)).to.deep.equal(['tag-a', 'tag-b']);
            expect(res.body.entries[0].tagName).to.equal('Tag A');
            expect(res.body.entries[0].value).to.equal(42);
            expect(res.body.entries[1].value).to.equal('');
        });

        it('should return 404 for non-existent recipe', async () => {
            const res = await request(server, '/api/recipes/instances/r_nonexistent');

            expect(res.statusCode).to.equal(404);
        });

        it('should return 404 when no project loaded', async () => {
            runtime.project = null;

            const res = await request(server, '/api/recipes/types');

            expect(res.statusCode).to.equal(404);
        });
    });

    describe('POST /api/recipes/types', () => {
        it('should create a new recipe with generated id', async () => {
            const recipeData = {
                name: 'New Recipe',
                entries: [{ tagId: 't1', tagName: 'Temp', tagType: 'real', value: '25.5' }]
            };

            const res = await postRequest(server, '/api/recipes/types', recipeData);

            expect(res.statusCode).to.equal(200);
            expect(res.body.id).to.exist;
            expect(res.body.id).to.match(/^r_[0-9a-f]{12}$/);

            expect(runtime.project.setProjectData.calledOnce).to.be.true;
            const setArgs = runtime.project.setProjectData.getCall(0).args;
            expect(setArgs[0]).to.equal('set-recipe');
            expect(setArgs[1].id).to.match(/^r_[0-9a-f]{12}$/);
            expect(setArgs[1].name).to.equal('New Recipe');
            expect(setArgs[1].entries[0].id).to.match(/^e_[0-9a-f]{8}$/);
            expect(setArgs[1].createdAt).to.exist;
            expect(setArgs[1].updatedAt).to.exist;
            expect(runtime.recipeStorage.setRecipeData.called).to.be.false;
        });

        it('should update existing recipe with provided id', async () => {
            const recipeData = {
                id: 'r_existing',
                name: 'Updated Recipe',
                entries: [{ id: 'e_001', tagId: 't1', tagName: 'Temp', tagType: 'real', value: '99.9' }]
            };

            const res = await postRequest(server, '/api/recipes/types', recipeData);

            expect(res.statusCode).to.equal(200);
            expect(res.body.id).to.equal('r_existing');
            expect(runtime.project.setProjectData.calledWith('set-recipe')).to.be.true;
            expect(runtime.project.setProjectData.getCall(0).args[1].id).to.equal('r_existing');
        });

        it('should reject recipe instances on the template endpoint', async () => {
            const recipeData = {
                typeId: 'r_type',
                name: 'Instance A',
                entries: [{ id: 'e_001', tagId: 't1', tagName: 'Temp', tagType: 'real', value: '99.9' }]
            };

            const res = await postRequest(server, '/api/recipes/types', recipeData);

            expect(res.statusCode).to.equal(400);
            expect(res.body.error).to.include('must not have typeId');
            expect(runtime.recipeStorage.setRecipeData.called).to.be.false;
            expect(runtime.project.setProjectData.called).to.be.false;
        });

        it('should reject non-admin recipe template changes when secure mode is enabled', async () => {
            runtime.settings.secureEnabled = true;
            currentUser = { userId: 'operator', groups: 2 };

            const res = await postRequest(server, '/api/recipes/types', {
                name: 'Template',
                entries: [{ tagId: 't1', tagName: 'Temp', tagType: 'real', value: '99.9' }]
            });

            expect(res.statusCode).to.equal(401);
            expect(res.body.error).to.equal('unauthorized_error');
            expect(runtime.project.setProjectData.called).to.be.false;
        });

        it('should return 400 for missing name', async () => {
            const res = await postRequest(server, '/api/recipes/types', { entries: [{ tagId: 't1', tagName: 'T1', tagType: 'int', value: '1' }] });

            expect(res.statusCode).to.equal(400);
            expect(res.body.error).to.include('name is required');
        });

        it('should return 400 for empty name', async () => {
            const res = await postRequest(server, '/api/recipes/types', { name: '', entries: [{ tagId: 't1', tagName: 'T1', tagType: 'int', value: '1' }] });

            expect(res.statusCode).to.equal(400);
            expect(res.body.error).to.include('name is required');
        });

        it('should return 400 for name exceeding 128 characters', async () => {
            const res = await postRequest(server, '/api/recipes/types', {
                name: 'A'.repeat(129),
                entries: [{ tagId: 't1', tagName: 'T1', tagType: 'int', value: '1' }]
            });

            expect(res.statusCode).to.equal(400);
            expect(res.body.error).to.include('128 characters');
        });

        it('should return 400 for missing entries', async () => {
            const res = await postRequest(server, '/api/recipes/types', { name: 'Test' });

            expect(res.statusCode).to.equal(400);
            expect(res.body.error).to.include('entries');
        });

        it('should return 400 for empty entries array', async () => {
            const res = await postRequest(server, '/api/recipes/types', { name: 'Test', entries: [] });

            expect(res.statusCode).to.equal(400);
            expect(res.body.error).to.include('at least one entry');
        });

        it('should return 400 for more than 1000 entries', async () => {
            const entries = Array.from({ length: 1001 }, (_, i) => ({
                tagId: 't' + i, tagName: 'T' + i, tagType: 'int', value: '1'
            }));
            const res = await postRequest(server, '/api/recipes/types', { name: 'Test', entries });

            expect(res.statusCode).to.equal(400);
            expect(res.body.error).to.include('1000 entries');
        });

        it('should return 400 for entry with missing tagId', async () => {
            const res = await postRequest(server, '/api/recipes/types', {
                name: 'Test',
                entries: [{ tagName: 'T1', tagType: 'int', value: '1' }]
            });

            expect(res.statusCode).to.equal(400);
            expect(res.body.error).to.include('tagId');
        });

        it('should return 400 for entry with invalid tagType', async () => {
            const res = await postRequest(server, '/api/recipes/types', {
                name: 'Test',
                entries: [{ tagId: 't1', tagName: 'T1', tagType: 'invalid_type', value: '1' }]
            });

            expect(res.statusCode).to.equal(400);
            expect(res.body.error).to.include('invalid tagType');
        });

        it('should return 400 for entry with uncoercible value', async () => {
            const res = await postRequest(server, '/api/recipes/types', {
                name: 'Test',
                entries: [{ tagId: 't1', tagName: 'T1', tagType: 'int', value: 'not-a-number' }]
            });

            expect(res.statusCode).to.equal(400);
            expect(res.body.error).to.include('cannot be coerced');
        });

        it('should accept string/word values for string and word tagTypes', async () => {
            const res = await postRequest(server, '/api/recipes/types', {
                name: 'Test',
                entries: [
                    { tagId: 't1', tagName: 'T1', tagType: 'string', value: 'hello world' },
                    { tagId: 't2', tagName: 'T2', tagType: 'word', value: 'recipe-code' }
                ]
            });

            expect(res.statusCode).to.equal(200);
            expect(res.body.id).to.exist;
            expect(runtime.project.setProjectData.calledOnce).to.be.true;
        });

        it('should coerce an empty string value to 0 for a numeric tag on POST', async () => {
            const res = await postRequest(server, '/api/recipes/types', {
                name: 'Empty Numeric',
                entries: [{ tagId: 't1', tagName: 'T1', tagType: 'int', value: '' }]
            });

            expect(res.statusCode).to.equal(200);
            const saved = runtime.project.setProjectData.getCall(0).args[1];
            expect(saved.entries[0].value).to.equal(0);
        });

        it('should coerce an empty string value to false for a bool tag on POST', async () => {
            const res = await postRequest(server, '/api/recipes/types', {
                name: 'Empty Bool',
                entries: [{ tagId: 't1', tagName: 'T1', tagType: 'bool', value: '' }]
            });

            expect(res.statusCode).to.equal(200);
            const saved = runtime.project.setProjectData.getCall(0).args[1];
            expect(saved.entries[0].value).to.equal(false);
        });

        it('should keep an empty string value valid for a string tag on POST', async () => {
            const res = await postRequest(server, '/api/recipes/types', {
                name: 'Empty String',
                entries: [{ tagId: 't1', tagName: 'T1', tagType: 'string', value: '' }]
            });

            expect(res.statusCode).to.equal(200);
            const saved = runtime.project.setProjectData.getCall(0).args[1];
            expect(saved.entries[0].value).to.equal('');
        });
    });

    describe('POST /api/recipes/instances', () => {
        it('should store recipe instances in recipe storage', async () => {
            const recipeData = {
                typeId: 'r_type',
                name: 'Instance A',
                entries: [{ id: 'e_001', tagId: 't1', tagName: 'Temp', tagType: 'real', value: '99.9' }]
            };

            const res = await postRequest(server, '/api/recipes/instances', recipeData);

            expect(res.statusCode).to.equal(200);
            expect(res.body.id).to.match(/^r_[0-9a-f]{12}$/);
            expect(runtime.recipeStorage.setRecipeData.calledOnce).to.be.true;
            expect(runtime.recipeStorage.setRecipeData.getCall(0).args[1].typeId).to.equal('r_type');
            expect(runtime.project.setProjectData.called).to.be.false;
        });

        it('should require typeId for recipe instances', async () => {
            const res = await postRequest(server, '/api/recipes/instances', {
                name: 'Missing Type',
                entries: [{ tagId: 't1', tagName: 'Temp', tagType: 'real', value: '99.9' }]
            });

            expect(res.statusCode).to.equal(400);
            expect(res.body.error).to.include('typeId');
            expect(runtime.recipeStorage.setRecipeData.called).to.be.false;
        });

        it('should allow non-admin recipe instance changes when secure mode is enabled', async () => {
            runtime.settings.secureEnabled = true;
            currentUser = { userId: 'operator', groups: 2 };

            const res = await postRequest(server, '/api/recipes/instances', {
                typeId: 'r_type',
                name: 'Instance',
                entries: [{ tagId: 't1', tagName: 'Temp', tagType: 'real', value: '99.9' }]
            });

            expect(res.statusCode).to.equal(200);
            expect(runtime.recipeStorage.setRecipeData.calledOnce).to.be.true;
        });
    });

    describe('DELETE /api/recipes/instances', () => {
        it('should delete existing recipe', async () => {
            const res = await deleteRequest(server, '/api/recipes/instances?id=r_test');

            expect(res.statusCode).to.equal(200);
            expect(res.body.result).to.equal('ok');
            expect(res.body.deleted).to.equal(1);
        });

        it('should return 404 for non-existent recipe', async () => {
            runtime.recipeStorage.deleteRecipeData.resolves({ changes: 0 });

            const res = await deleteRequest(server, '/api/recipes/instances?id=r_nonexistent');

            expect(res.statusCode).to.equal(404);
            expect(res.body.error).to.equal('Recipe not found');
        });

        it('should return 400 for missing id parameter', async () => {
            const res = await deleteRequest(server, '/api/recipes/instances');

            expect(res.statusCode).to.equal(400);
            expect(res.body.error).to.include('Missing id parameter');
        });

        describe('auth gate (secure enabled)', () => {
            it('should reject guest with 401', async () => {
                runtime.settings.secureEnabled = true;
                currentUser = { userId: 'guest', groups: ['guest'] };

                const res = await deleteRequest(server, '/api/recipes/instances?id=r_test');

                expect(res.statusCode).to.equal(401);
                expect(res.body.error).to.equal('unauthorized_error');
            });

            it('should allow non-admin user to delete an instance with 200', async () => {
                runtime.settings.secureEnabled = true;
                currentUser = { userId: 'operator', groups: 2 };

                const res = await deleteRequest(server, '/api/recipes/instances?id=r_test');

                expect(res.statusCode).to.equal(200);
                expect(res.body.result).to.equal('ok');
                expect(res.body.deleted).to.equal(1);
            });

            it('should allow admin user with 200', async () => {
                runtime.settings.secureEnabled = true;
                currentUser = { userId: 'admin', groups: 255 };

                const res = await deleteRequest(server, '/api/recipes/instances?id=r_test');

                expect(res.statusCode).to.equal(200);
                expect(res.body.result).to.equal('ok');
                expect(res.body.deleted).to.equal(1);
            });
        });
    });

    describe('DELETE /api/recipes/types', () => {
        it('should delete existing recipe type and cascade its instances', async () => {
            runtime.project.getRecipe.withArgs('r_template').returns({ id: 'r_template', name: 'Template', entries: [] });
            runtime.recipeStorage.deleteAllRecipesByType.withArgs('r_template').resolves({ changes: 2 });

            const res = await deleteRequest(server, '/api/recipes/types?id=r_template');

            expect(res.statusCode).to.equal(200);
            expect(res.body.result).to.equal('ok');
            expect(res.body.deleted).to.equal(3);
            expect(runtime.project.setProjectData.calledWith('del-recipe')).to.be.true;
            expect(runtime.recipeStorage.deleteAllRecipesByType.calledWith('r_template')).to.be.true;
        });

        it('should return 404 for non-existent recipe type', async () => {
            const res = await deleteRequest(server, '/api/recipes/types?id=r_nonexistent');

            expect(res.statusCode).to.equal(404);
            expect(res.body.error).to.equal('Recipe not found');
        });

        it('should reject non-admin user deleting a template when secure mode is enabled', async () => {
            runtime.settings.secureEnabled = true;
            currentUser = { userId: 'operator', groups: 2 };
            runtime.project.getRecipe.withArgs('r_template').returns({ id: 'r_template', name: 'Template', entries: [] });

            const res = await deleteRequest(server, '/api/recipes/types?id=r_template');

            expect(res.statusCode).to.equal(401);
            expect(res.body.error).to.equal('unauthorized_error');
            expect(runtime.project.setProjectData.called).to.be.false;
        });

        it('should allow admin user deleting a template when secure mode is enabled', async () => {
            runtime.settings.secureEnabled = true;
            currentUser = { userId: 'admin', groups: 255 };
            runtime.project.getRecipe.withArgs('r_template').returns({ id: 'r_template', name: 'Template', entries: [] });

            const res = await deleteRequest(server, '/api/recipes/types?id=r_template');

            expect(res.statusCode).to.equal(200);
            expect(res.body.result).to.equal('ok');
            expect(runtime.project.setProjectData.calledWith('del-recipe')).to.be.true;
        });
    });

    describe('POST /api/recipes/download', () => {
        beforeEach(() => {
            runtime.recipeStorage.getRecipeData.resolves({
                id: 'r_test',
                name: 'Test',
                entries: [{ id: 'e_001', tagId: 't1', tagName: 'T1', tagType: 'int', value: '42' }]
            });
        });

        it('should return 202 and start download', async () => {
            const res = await postRequest(server, '/api/recipes/download', { id: 'r_test' });

            expect(res.statusCode).to.equal(202);
            expect(res.body.result).to.equal('started');
            expect(res.body.recipeId).to.equal('r_test');
            expect(res.body.totalEntries).to.equal(1);
            expect(runtime.recipeService.downloadRecipe.calledWith('r_test')).to.be.true;
        });

        it('should return 400 for missing id', async () => {
            const res = await postRequest(server, '/api/recipes/download', {});

            expect(res.statusCode).to.equal(400);
            expect(res.body.error).to.include('Missing recipe id');
        });

        it('should return 400 for non-existent recipe', async () => {
            runtime.recipeStorage.getRecipeData.resolves(null);

            const res = await postRequest(server, '/api/recipes/download', { id: 'r_nonexistent' });

            expect(res.statusCode).to.equal(400);
            expect(res.body.error).to.equal('Recipe not found');
        });

        it('should return 400 for empty entries', async () => {
            runtime.recipeStorage.getRecipeData.resolves({ id: 'r_test', name: 'Test', entries: [] });

            const res = await postRequest(server, '/api/recipes/download', { id: 'r_test' });

            expect(res.statusCode).to.equal(400);
            expect(res.body.error).to.include('No entries to download');
        });

        it('should return 400 if already running', async () => {
            runtime.recipeService.isRecipeRunning.returns(true);

            const res = await postRequest(server, '/api/recipes/download', { id: 'r_test' });

            expect(res.statusCode).to.equal(400);
            expect(res.body.error).to.include('already in progress');
        });
    });

    describe('POST /api/recipes/upload', () => {
        beforeEach(() => {
            runtime.recipeStorage.getRecipeData.resolves({
                id: 'r_test',
                name: 'Test',
                entries: [{ id: 'e_001', tagId: 't1', tagName: 'T1', tagType: 'int', value: '42' }]
            });
        });

        it('should return 202 and start upload', async () => {
            const res = await postRequest(server, '/api/recipes/upload', { id: 'r_test' });

            expect(res.statusCode).to.equal(202);
            expect(res.body.result).to.equal('started');
            expect(res.body.recipeId).to.equal('r_test');
            expect(runtime.recipeService.uploadRecipe.calledWith('r_test')).to.be.true;
        });

        it('should return 400 for missing id', async () => {
            const res = await postRequest(server, '/api/recipes/upload', {});

            expect(res.statusCode).to.equal(400);
        });

        it('should return 400 for non-existent recipe', async () => {
            runtime.recipeStorage.getRecipeData.resolves(null);

            const res = await postRequest(server, '/api/recipes/upload', { id: 'r_nonexistent' });

            expect(res.statusCode).to.equal(400);
            expect(res.body.error).to.equal('Recipe not found');
        });

        it('should return 400 if already running', async () => {
            runtime.recipeService.isRecipeRunning.returns(true);

            const res = await postRequest(server, '/api/recipes/upload', { id: 'r_test' });

            expect(res.statusCode).to.equal(400);
            expect(res.body.error).to.include('already in progress');
        });
    });

    describe('POST /api/recipes/export', () => {
        beforeEach(() => {
            runtime.recipeStorage.getRecipeData.resolves({
                id: 'r_test',
                name: 'TestRecipe',
                entries: [
                    { id: 'e_001', tagId: 't1', tagName: 'Temp', tagType: 'real', value: 25.5 },
                    { id: 'e_002', tagId: 't2', tagName: 'Press', tagType: 'int', value: 100 }
                ]
            });
        });

        it('should export as JSON with correct Content-Type and filename', async () => {
            const res = await postRequest(server, '/api/recipes/export', { id: 'r_test', format: 'json' });

            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-type']).to.include('application/json');
            expect(res.headers['content-disposition']).to.include('TestRecipe.json');
            expect(res.body.name).to.equal('TestRecipe');
            expect(res.body.entries).to.have.lengthOf(2);
        });

        it('should export as CSV with correct Content-Type and RFC 4180 format', async () => {
            const res = await postRequest(server, '/api/recipes/export', { id: 'r_test', format: 'csv' });

            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-type']).to.include('text/csv');
            expect(res.headers['content-disposition']).to.include('TestRecipe.csv');

            const csvBody = typeof res.body === 'string' ? res.body : '';
            expect(csvBody).to.include('tagId,tagName,tagType,value');
            expect(csvBody).to.include('t1');
            expect(csvBody).to.include('Temp');
        });

        it('should return 404 for non-existent recipe', async () => {
            runtime.recipeStorage.getRecipeData.resolves(null);

            const res = await postRequest(server, '/api/recipes/export', { id: 'r_nonexistent' });

            expect(res.statusCode).to.equal(404);
            expect(res.body.error).to.equal('Recipe not found');
        });

        it('should return 400 for invalid format', async () => {
            const res = await postRequest(server, '/api/recipes/export', { id: 'r_test', format: 'xml' });

            expect(res.statusCode).to.equal(400);
            expect(res.body.error).to.include('Invalid export format');
        });
    });

    describe('POST /api/recipes/types/import', () => {
        it('should reject non-admin import when secure mode is enabled', async () => {
            runtime.settings.secureEnabled = true;
            currentUser = { userId: 'operator', groups: 2 };

            const res = await postRequest(server, '/api/recipes/types/import', {
                file: JSON.stringify({
                    name: 'Imported JSON',
                    entries: [{ tagId: 't1', tagName: 'T1', tagType: 'int', value: '42' }]
                }),
                format: 'json'
            });

            expect(res.statusCode).to.equal(401);
            expect(res.body.error).to.equal('unauthorized_error');
            expect(runtime.project.setProjectData.called).to.be.false;
        });

        it('should import valid JSON', async () => {
            const jsonPayload = JSON.stringify({
                name: 'Imported JSON',
                entries: [{ tagId: 't1', tagName: 'T1', tagType: 'int', value: '42' }]
            });

            const res = await postRequest(server, '/api/recipes/types/import', {
                file: jsonPayload,
                format: 'json'
            });

            expect(res.statusCode).to.equal(200);
            expect(res.body.id).to.match(/^r_[0-9a-f]{12}$/);
            expect(res.body.name).to.equal('Imported JSON');
            expect(res.body.entriesCount).to.equal(1);
            expect(runtime.project.setProjectData.calledOnce).to.be.true;
        });

        it('should import valid CSV', async () => {
            const csvPayload = 'tagId,tagName,tagType,value\nt1,Temp,real,25.5\nt2,Press,int,100';

            const res = await postRequest(server, '/api/recipes/types/import', {
                file: csvPayload,
                format: 'csv'
            });

            expect(res.statusCode).to.equal(200);
            expect(res.body.entriesCount).to.equal(2);
            expect(runtime.project.setProjectData.calledOnce).to.be.true;
        });

        it('should auto-detect CSV format from content', async () => {
            const csvPayload = 'tagId,tagName,tagType,value\nt1,Temp,real,25.5';

            const res = await postRequest(server, '/api/recipes/types/import', {
                file: csvPayload
                // No format — should auto-detect
            });

            expect(res.statusCode).to.equal(200);
            expect(res.body.entriesCount).to.equal(1);
        });

        it('should auto-detect JSON format when content has a UTF-8 BOM', async () => {
            const bomJson = '\uFEFF' + JSON.stringify({
                name: 'BOM Imported',
                entries: [{ tagId: 't1', tagName: 'T1', tagType: 'int', value: '42' }]
            });

            // No format — must route to JSON (not CSV) and parse despite the BOM
            const res = await postRequest(server, '/api/recipes/types/import', {
                file: bomJson
            });

            expect(res.statusCode).to.equal(200);
            expect(res.body.name).to.equal('BOM Imported');
            expect(res.body.entriesCount).to.equal(1);
            expect(runtime.project.setProjectData.calledOnce).to.be.true;
        });

        it('should strip formula-injection guard prefix on CSV import', async () => {
            // Round-trip of an export where _quoteCSVField prefixed "'" to values
            // starting with -, +, = or @ (e.g. negative numbers, formulas)
            const csvPayload = 'tagId,tagName,tagType,value\nt1,Temp,real,\'-5.5\nt2,Pres,real,\'+100\n';

            const res = await postRequest(server, '/api/recipes/types/import', {
                file: csvPayload,
                format: 'csv'
            });

            expect(res.statusCode).to.equal(200);
            expect(runtime.project.setProjectData.calledOnce).to.be.true;
            const saved = runtime.project.setProjectData.getCall(0).args[1];
            expect(saved.entries[0].value).to.equal('-5.5');
            expect(saved.entries[1].value).to.equal('+100');
        });

        it('should store 0 for an empty value cell when importing CSV for a numeric tag', async () => {
            // A hand-made CSV with an empty value cell on an int row must be
            // coerced to 0 on store, never kept as a literal '' that a download
            // would later write to the device.
            const csvPayload = 'tagId,tagName,tagType,value\nt1,Temp,int,\n';

            const res = await postRequest(server, '/api/recipes/types/import', {
                file: csvPayload,
                format: 'csv'
            });

            expect(res.statusCode).to.equal(200);
            const saved = runtime.project.setProjectData.getCall(0).args[1];
            expect(saved.entries[0].value).to.equal(0);
        });

        it('should return 400 for invalid JSON syntax', async () => {
            const res = await postRequest(server, '/api/recipes/types/import', {
                file: '{invalid json}',
                format: 'json'
            });

            expect(res.statusCode).to.equal(400);
            expect(res.body.error).to.include('invalid JSON');
        });

        it('should return 400 for missing file/data', async () => {
            const res = await postRequest(server, '/api/recipes/types/import', {});

            expect(res.statusCode).to.equal(400);
            expect(res.body.error).to.include('Missing file or data');
        });
    });

    describe('TOCTOU double-start', () => {
        it('should return 409 when the start rejects with already-in-progress', async () => {
            runtime.recipeStorage.getRecipeData.resolves({
                id: 'r_test',
                name: 'Test',
                entries: [{ id: 'e_001', tagId: 't1', tagName: 'T1', tagType: 'int', value: '42' }]
            });
            // Pre-check passes, but the underlying claim rejects immediately:
            // the route must turn that into a definitive 409, not a silent 202.
            runtime.recipeService.isRecipeRunning.returns(false);
            runtime.recipeService.downloadRecipe.rejects(new Error('Recipe execution already in progress'));

            const res = await postRequest(server, '/api/recipes/download', { id: 'r_test' });

            expect(res.statusCode).to.equal(409);
            expect(res.body.error).to.include('already in progress');
        });

        it('should start once and give a concurrent second start a definitive error', async () => {
            // Wire the REAL recipe service so the running-slot claim and the
            // concurrent "already in progress" rejection are genuinely exercised.
            const realService = require('../../runtime/recipes/recipe-service');
            realService.init(null, null, runtime);
            runtime.recipeService = {
                isRecipeRunning: (id) => realService.isRecipeRunning(id),
                downloadRecipe: (id) => realService.downloadRecipe(id),
                uploadRecipe: (id) => realService.uploadRecipe(id),
                coerceValue: realService.coerceValue
            };
            runtime.io = { emit: sandbox.spy() };
            runtime.devices = { setTagValue: sandbox.stub().resolves({}), getTagValue: sandbox.stub().resolves(42) };

            runtime.recipeStorage.getRecipeData.resolves({
                id: 'r_touctou',
                name: 'Race',
                entries: [{ id: 'e_001', tagId: 't1', tagName: 'T1', tagType: 'int', value: '42' }]
            });

            // Hold the first download's write open so its running slot stays
            // claimed while the concurrent second request is processed.
            let releaseWrite;
            const gate = new Promise(resolve => { releaseWrite = resolve; });
            runtime.devices.setTagValue = sandbox.stub().callsFake(() => gate);

            const [r1, r2] = await Promise.all([
                postRequest(server, '/api/recipes/download', { id: 'r_touctou' }),
                postRequest(server, '/api/recipes/download', { id: 'r_touctou' })
            ]);

            const statuses = [r1.statusCode, r2.statusCode].sort();
            // Exactly one success + a definitive error for the loser (no hung dialog) —
            // the loser may be caught by the pre-check (400) or the claim (409).
            expect(statuses).to.deep.equal([202, 400]);
            const errRes = r1.statusCode === 202 ? r2 : r1;
            expect(errRes.body.error).to.include('already in progress');

            // Release the winner's write so it completes — no stuck running state
            releaseWrite({});
            await new Promise(resolve => setTimeout(resolve, 30));
            expect(realService.isRecipeRunning('r_touctou')).to.be.false;
        });
    });
});


