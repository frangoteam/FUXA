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
            project: { id: 'test-project' },
            recipeStorage: {
                getRecipeData: sandbox.stub().resolves(null),
                getAllRecipes: sandbox.stub().resolves([]),
                setRecipeData: sandbox.stub().resolves({ changes: 1 }),
                deleteRecipeData: sandbox.stub().resolves({ changes: 1 })
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

    describe('GET /api/recipes', () => {
        it('should return list of recipes', async () => {
            const recipes = [
                { id: 'r_001', data: { name: 'Recipe 1', entries: [{ id: 'e_001', tagId: 't1', tagName: 'T1', tagType: 'int', value: '42' }] } },
                { id: 'r_002', data: { name: 'Recipe 2', entries: [{ id: 'e_002', tagId: 't2', tagName: 'T2', tagType: 'real', value: '3.14' }] } }
            ];
            runtime.recipeStorage.getAllRecipes.resolves(recipes);

            const res = await request(server, '/api/recipes');

            expect(res.statusCode).to.equal(200);
            expect(res.body.recipes).to.have.lengthOf(2);
            expect(res.body.recipes[0].id).to.equal('r_001');
        });

        it('should return single recipe by id', async () => {
            const recipeData = { name: 'Test', entries: [{ id: 'e_001', tagId: 't1', tagName: 'T1', tagType: 'int', value: '42' }] };
            runtime.recipeStorage.getRecipeData.withArgs('r_test').resolves(recipeData);

            const res = await request(server, '/api/recipes/r_test');

            expect(res.statusCode).to.equal(200);
            expect(res.body.name).to.equal('Test');
        });

        it('should return 404 for non-existent recipe', async () => {
            const res = await request(server, '/api/recipes/r_nonexistent');

            expect(res.statusCode).to.equal(404);
        });

        it('should return 404 when no project loaded', async () => {
            runtime.project = null;

            const res = await request(server, '/api/recipes');

            expect(res.statusCode).to.equal(404);
        });
    });

    describe('POST /api/recipes', () => {
        it('should create a new recipe with generated id', async () => {
            const recipeData = {
                name: 'New Recipe',
                entries: [{ tagId: 't1', tagName: 'Temp', tagType: 'real', value: '25.5' }]
            };

            const res = await postRequest(server, '/api/recipes', recipeData);

            expect(res.statusCode).to.equal(200);
            expect(res.body.id).to.exist;
            expect(res.body.id).to.match(/^r_[0-9a-f]{12}$/);

            // setRecipeData should have been called
            expect(runtime.recipeStorage.setRecipeData.calledOnce).to.be.true;
            const setArgs = runtime.recipeStorage.setRecipeData.getCall(0).args;
            expect(setArgs[0]).to.match(/^r_[0-9a-f]{12}$/);
            expect(setArgs[1].name).to.equal('New Recipe');
            expect(setArgs[1].entries[0].id).to.match(/^e_[0-9a-f]{8}$/);
            expect(setArgs[1].createdAt).to.exist;
            expect(setArgs[1].updatedAt).to.exist;
        });

        it('should update existing recipe with provided id', async () => {
            const recipeData = {
                id: 'r_existing',
                name: 'Updated Recipe',
                entries: [{ id: 'e_001', tagId: 't1', tagName: 'Temp', tagType: 'real', value: '99.9' }]
            };

            const res = await postRequest(server, '/api/recipes', recipeData);

            expect(res.statusCode).to.equal(200);
            expect(res.body.id).to.equal('r_existing');
            expect(runtime.recipeStorage.setRecipeData.calledWith('r_existing')).to.be.true;
        });

        it('should return 400 for missing name', async () => {
            const res = await postRequest(server, '/api/recipes', { entries: [{ tagId: 't1', tagName: 'T1', tagType: 'int', value: '1' }] });

            expect(res.statusCode).to.equal(400);
            expect(res.body.error).to.include('name is required');
        });

        it('should return 400 for empty name', async () => {
            const res = await postRequest(server, '/api/recipes', { name: '', entries: [{ tagId: 't1', tagName: 'T1', tagType: 'int', value: '1' }] });

            expect(res.statusCode).to.equal(400);
            expect(res.body.error).to.include('name is required');
        });

        it('should return 400 for name exceeding 128 characters', async () => {
            const res = await postRequest(server, '/api/recipes', {
                name: 'A'.repeat(129),
                entries: [{ tagId: 't1', tagName: 'T1', tagType: 'int', value: '1' }]
            });

            expect(res.statusCode).to.equal(400);
            expect(res.body.error).to.include('128 characters');
        });

        it('should return 400 for missing entries', async () => {
            const res = await postRequest(server, '/api/recipes', { name: 'Test' });

            expect(res.statusCode).to.equal(400);
            expect(res.body.error).to.include('entries');
        });

        it('should return 400 for empty entries array', async () => {
            const res = await postRequest(server, '/api/recipes', { name: 'Test', entries: [] });

            expect(res.statusCode).to.equal(400);
            expect(res.body.error).to.include('at least one entry');
        });

        it('should return 400 for more than 1000 entries', async () => {
            const entries = Array.from({ length: 1001 }, (_, i) => ({
                tagId: 't' + i, tagName: 'T' + i, tagType: 'int', value: '1'
            }));
            const res = await postRequest(server, '/api/recipes', { name: 'Test', entries });

            expect(res.statusCode).to.equal(400);
            expect(res.body.error).to.include('1000 entries');
        });

        it('should return 400 for entry with missing tagId', async () => {
            const res = await postRequest(server, '/api/recipes', {
                name: 'Test',
                entries: [{ tagName: 'T1', tagType: 'int', value: '1' }]
            });

            expect(res.statusCode).to.equal(400);
            expect(res.body.error).to.include('tagId');
        });

        it('should return 400 for entry with invalid tagType', async () => {
            const res = await postRequest(server, '/api/recipes', {
                name: 'Test',
                entries: [{ tagId: 't1', tagName: 'T1', tagType: 'invalid_type', value: '1' }]
            });

            expect(res.statusCode).to.equal(400);
            expect(res.body.error).to.include('invalid tagType');
        });

        it('should return 400 for entry with uncoercible value', async () => {
            const res = await postRequest(server, '/api/recipes', {
                name: 'Test',
                entries: [{ tagId: 't1', tagName: 'T1', tagType: 'int', value: 'not-a-number' }]
            });

            expect(res.statusCode).to.equal(400);
            expect(res.body.error).to.include('cannot be coerced');
        });

        it('should accept string/word values for string and word tagTypes', async () => {
            const res = await postRequest(server, '/api/recipes', {
                name: 'Test',
                entries: [
                    { tagId: 't1', tagName: 'T1', tagType: 'string', value: 'hello world' },
                    { tagId: 't2', tagName: 'T2', tagType: 'word', value: 'recipe-code' }
                ]
            });

            expect(res.statusCode).to.equal(200);
            expect(res.body.id).to.exist;
            expect(runtime.recipeStorage.setRecipeData.calledOnce).to.be.true;
        });
    });

    describe('DELETE /api/recipes', () => {
        it('should delete existing recipe', async () => {
            const res = await deleteRequest(server, '/api/recipes?id=r_test');

            expect(res.statusCode).to.equal(200);
            expect(res.body.result).to.equal('ok');
            expect(res.body.deleted).to.equal(1);
        });

        it('should return 404 for non-existent recipe', async () => {
            runtime.recipeStorage.deleteRecipeData.resolves({ changes: 0 });

            const res = await deleteRequest(server, '/api/recipes?id=r_nonexistent');

            expect(res.statusCode).to.equal(404);
            expect(res.body.error).to.equal('Recipe not found');
        });

        it('should return 400 for missing id parameter', async () => {
            const res = await deleteRequest(server, '/api/recipes');

            expect(res.statusCode).to.equal(400);
            expect(res.body.error).to.include('Missing id parameter');
        });

        describe('auth gate (secure enabled)', () => {
            it('should reject guest with 401', async () => {
                runtime.settings.secureEnabled = true;
                currentUser = { userId: 'guest', groups: ['guest'] };

                const res = await deleteRequest(server, '/api/recipes?id=r_test');

                expect(res.statusCode).to.equal(401);
                expect(res.body.error).to.equal('unauthorized_error');
            });

            it('should allow non-admin user with 200', async () => {
                runtime.settings.secureEnabled = true;
                currentUser = { userId: 'operator', groups: 2 };

                const res = await deleteRequest(server, '/api/recipes?id=r_test');

                expect(res.statusCode).to.equal(200);
                expect(res.body.result).to.equal('ok');
                expect(res.body.deleted).to.equal(1);
            });

            it('should allow admin user with 200', async () => {
                runtime.settings.secureEnabled = true;
                currentUser = { userId: 'admin', groups: 255 };

                const res = await deleteRequest(server, '/api/recipes?id=r_test');

                expect(res.statusCode).to.equal(200);
                expect(res.body.result).to.equal('ok');
                expect(res.body.deleted).to.equal(1);
            });
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

    describe('POST /api/recipes/import', () => {
        it('should import valid JSON', async () => {
            const jsonPayload = JSON.stringify({
                name: 'Imported JSON',
                entries: [{ tagId: 't1', tagName: 'T1', tagType: 'int', value: '42' }]
            });

            const res = await postRequest(server, '/api/recipes/import', {
                file: jsonPayload,
                format: 'json'
            });

            expect(res.statusCode).to.equal(200);
            expect(res.body.id).to.match(/^r_[0-9a-f]{12}$/);
            expect(res.body.name).to.equal('Imported JSON');
            expect(res.body.entriesCount).to.equal(1);
            expect(runtime.recipeStorage.setRecipeData.calledOnce).to.be.true;
        });

        it('should import valid CSV', async () => {
            const csvPayload = 'tagId,tagName,tagType,value\nt1,Temp,real,25.5\nt2,Press,int,100';

            const res = await postRequest(server, '/api/recipes/import', {
                file: csvPayload,
                format: 'csv'
            });

            expect(res.statusCode).to.equal(200);
            expect(res.body.entriesCount).to.equal(2);
            expect(runtime.recipeStorage.setRecipeData.calledOnce).to.be.true;
        });

        it('should auto-detect CSV format from content', async () => {
            const csvPayload = 'tagId,tagName,tagType,value\nt1,Temp,real,25.5';

            const res = await postRequest(server, '/api/recipes/import', {
                file: csvPayload
                // No format — should auto-detect
            });

            expect(res.statusCode).to.equal(200);
            expect(res.body.entriesCount).to.equal(1);
        });

        it('should return 400 for invalid JSON syntax', async () => {
            const res = await postRequest(server, '/api/recipes/import', {
                file: '{invalid json}',
                format: 'json'
            });

            expect(res.statusCode).to.equal(400);
            expect(res.body.error).to.include('invalid JSON');
        });

        it('should return 400 for missing file/data', async () => {
            const res = await postRequest(server, '/api/recipes/import', {});

            expect(res.statusCode).to.equal(400);
            expect(res.body.error).to.include('Missing file or data');
        });
    });
});
