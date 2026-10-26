'use strict';

const assert = require('node:assert/strict');
const service = require('../../runtime/recipes/recipe-service');

function deferred() {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
}

describe('recipe progress ownership', () => {
    const recipeId = 'progress-ownership';
    let runtime, events;

    beforeEach(() => {
        events = [];
        runtime = {
            recipeStorage: {
                getRecipeData: async () => ({ entries: [{ id: 'entry', tagId: 'tag', value: 7 }] }),
                setRecipeData: async () => {}
            },
            devices: { getTagValue: async () => 7, setTagValue: async () => ({}) },
            io: { emit: (type, payload) => events.push({ type, payload }) }
        };
        service.init(null, null, runtime);
    });

    afterEach(() => service.cancelRecipe(recipeId));

    for (const direction of ['download', 'upload']) {
        for (const restart of [false, true]) {
            for (const fails of [false, true]) {
                it(`${direction} suppresses late ${fails ? 'failure' : 'success'} progress after cancel${restart ? ' and restart' : ''}`, async () => {
                    const first = deferred(), second = deferred();
                    const firstStarted = deferred(), secondStarted = deferred();
                    const method = direction === 'download' ? 'setTagValue' : 'getTagValue';
                    let calls = 0, saves = 0;
                    runtime.recipeStorage.setRecipeData = async () => { saves++; };
                    runtime.devices[method] = () => {
                        calls++;
                        (calls === 1 ? firstStarted : secondStarted).resolve();
                        return (calls === 1 ? first : second).promise;
                    };
                    const oldRun = service[`${direction}Recipe`](recipeId);
                    let newRun;
                    try {
                        await firstStarted.promise;
                        service.cancelRecipe(recipeId);
                        if (restart) {
                            newRun = service[`${direction}Recipe`](recipeId);
                            await secondStarted.promise;
                        }
                        const before = events.length;
                        if (fails) first.reject(new Error('old device failure'));
                        else first.resolve(41);
                        await oldRun;

                        assert.deepEqual(events.slice(before), restart ? [] : [
                            { type: 'recipe:cancel-confirmed', payload: { recipeId } }
                        ]);
                        assert.equal(service.isRecipeRunning(recipeId), restart);
                        assert.equal(saves, 0);
                        assert.equal(calls, restart ? 2 : 1);

                        if (restart) {
                            second.resolve(82);
                            await newRun;
                            const completed = events.filter(event => event.type === `recipe:${direction}-complete`);
                            assert.equal(completed.length, 1);
                            assert.equal(completed[0].payload.successCount, 1);
                            assert.equal(completed[0].payload.errorCount, 0);
                            assert.equal(saves, direction === 'upload' ? 1 : 0);
                        }
                    } finally {
                        first.resolve(41);
                        second.resolve(82);
                        await Promise.allSettled([oldRun, newRun]);
                    }
                });
            }
        }
    }

    for (const fails of [false, true]) {
        it(`upload suppresses late storage ${fails ? 'error' : 'completion'} after restart`, async () => {
            const saving = deferred(), saveStarted = deferred();
            const reading = deferred(), readStarted = deferred();
            runtime.recipeStorage.setRecipeData = () => { saveStarted.resolve(); return saving.promise; };
            const oldRun = service.uploadRecipe(recipeId).catch(error => error);
            let newRun;
            try {
                await saveStarted.promise;
                service.cancelRecipe(recipeId);
                runtime.devices.getTagValue = () => { readStarted.resolve(); return reading.promise; };
                newRun = service.uploadRecipe(recipeId);
                await readStarted.promise;
                const before = events.length;
                if (fails) saving.reject(new Error('old storage failure'));
                else saving.resolve();
                const result = await oldRun;
                if (fails) assert.equal(result.message, 'old storage failure');
                assert.deepEqual(events.slice(before), []);
                assert.equal(service.isRecipeRunning(recipeId), true);
                runtime.recipeStorage.setRecipeData = async () => {};
                reading.resolve(82);
                await newRun;
                assert.equal(events.filter(event => event.type === 'recipe:upload-complete').length, 1);
            } finally {
                saving.resolve();
                reading.resolve(82);
                await Promise.allSettled([oldRun, newRun]);
            }
        });
    }
});
