'use strict';

const sinon = require('sinon');
const recipeService = require('../../runtime/recipes/recipe-service');

describe('recipe-service', () => {
    let expect;

    before(async () => {
        const chai = await import('chai');
        expect = chai.expect;
    });

    describe('coerceValue', () => {

        describe('Boolean types', () => {
            it('should coerce "true" to true for bool/boolean', () => {
                expect(recipeService.coerceValue('true', 'bool')).to.equal(true);
                expect(recipeService.coerceValue('true', 'boolean')).to.equal(true);
            });

            it('should coerce "1" to true for bool/boolean', () => {
                expect(recipeService.coerceValue('1', 'bool')).to.equal(true);
                expect(recipeService.coerceValue('1', 'boolean')).to.equal(true);
            });

            it('should coerce "false" to false for bool/boolean', () => {
                expect(recipeService.coerceValue('false', 'bool')).to.equal(false);
                expect(recipeService.coerceValue('false', 'boolean')).to.equal(false);
            });

            it('should coerce "0" to false for bool/boolean', () => {
                expect(recipeService.coerceValue('0', 'bool')).to.equal(false);
                expect(recipeService.coerceValue('0', 'boolean')).to.equal(false);
            });

            it('should pass through boolean values unchanged', () => {
                expect(recipeService.coerceValue(true, 'bool')).to.equal(true);
                expect(recipeService.coerceValue(true, 'boolean')).to.equal(true);
                expect(recipeService.coerceValue(false, 'bool')).to.equal(false);
                expect(recipeService.coerceValue(false, 'boolean')).to.equal(false);
            });
        });

        describe('Integer types', () => {
            it('should coerce "42" to 42 for integer types', () => {
                expect(recipeService.coerceValue('42', 'int')).to.equal(42);
                expect(recipeService.coerceValue('42', 'dint')).to.equal(42);
                expect(recipeService.coerceValue('42', 'int16')).to.equal(42);
                expect(recipeService.coerceValue('42', 'int32')).to.equal(42);
                expect(recipeService.coerceValue('42', 'number')).to.equal(42);
            });

            it('should coerce "-10" to -10 for integer types', () => {
                expect(recipeService.coerceValue('-10', 'int')).to.equal(-10);
            });

            it('should handle Int16 type', () => {
                expect(recipeService.coerceValue('32767', 'int16')).to.equal(32767);
            });

            it('should handle Int32 type', () => {
                expect(recipeService.coerceValue('2147483647', 'int32')).to.equal(2147483647);
            });

            it('should handle number type', () => {
                expect(recipeService.coerceValue('42', 'number')).to.equal(42);
            });

            it('should return original value if not a valid integer', () => {
                const result = recipeService.coerceValue('abc', 'int');
                expect(result).to.equal('abc');
            });
        });

        describe('Float/Real types', () => {
            it('should coerce "3.14" to 3.14 for Real type', () => {
                expect(recipeService.coerceValue('3.14', 'real')).to.equal(3.14);
            });

            it('should coerce "2.5" to 2.5 for Float type', () => {
                expect(recipeService.coerceValue('2.5', 'float')).to.equal(2.5);
            });

            it('should coerce "1.5" to 1.5 for Double type', () => {
                expect(recipeService.coerceValue('1.5', 'double')).to.equal(1.5);
            });

            it('should coerce "3.14" to 3.14 for number type', () => {
                expect(recipeService.coerceValue('3.14', 'number')).to.equal(3.14);
            });

            it('should return original value if not a valid float', () => {
                const result = recipeService.coerceValue('not-a-number', 'real');
                expect(result).to.equal('not-a-number');
            });
        });

        describe('Byte type', () => {
            it('should coerce "128" to 128 for byte type', () => {
                expect(recipeService.coerceValue('128', 'byte')).to.equal(128);
            });

            it('should clamp "300" to 255 for byte type', () => {
                expect(recipeService.coerceValue('300', 'byte')).to.equal(255);
            });

            it('should clamp "-10" to 0 for byte type', () => {
                expect(recipeService.coerceValue('-10', 'byte')).to.equal(0);
            });

            it('should return original value if not a valid byte', () => {
                const result = recipeService.coerceValue('abc', 'byte');
                expect(result).to.equal('abc');
            });
        });

        describe('String/Word types', () => {
            it('should pass through string values unchanged', () => {
                expect(recipeService.coerceValue('hello', 'string')).to.equal('hello');
            });

            it('should pass through word values unchanged', () => {
                expect(recipeService.coerceValue('world', 'word')).to.equal('world');
            });
        });

        describe('Edge cases', () => {
            it('should pass through null unchanged for any tagType', () => {
                expect(recipeService.coerceValue(null, 'int')).to.equal(null);
                expect(recipeService.coerceValue(null, 'bool')).to.equal(null);
                expect(recipeService.coerceValue(null, 'string')).to.equal(null);
            });

            it('should pass through undefined unchanged for any tagType', () => {
                expect(recipeService.coerceValue(undefined, 'int')).to.equal(undefined);
                expect(recipeService.coerceValue(undefined, 'bool')).to.equal(undefined);
                expect(recipeService.coerceValue(undefined, 'string')).to.equal(undefined);
            });

            it('should pass through value unchanged for empty or unknown tagType', () => {
                expect(recipeService.coerceValue('hello', '')).to.equal('hello');
                expect(recipeService.coerceValue('42', 'unknown')).to.equal('42');
                expect(recipeService.coerceValue(true, '')).to.equal(true);
            });
        });
    });

    describe('recipe execution', () => {
        let sandbox;
        let runtime;
        let recipeData;

        beforeEach(() => {
            sandbox = sinon.createSandbox();
            recipeData = {
                id: 'r_test123',
                name: 'Test Recipe',
                entries: [
                    { id: 'e_001', tagId: 't1', tagName: 'Temp', tagType: 'real', value: '25.5' },
                    { id: 'e_002', tagId: 't2', tagName: 'Pressure', tagType: 'int', value: '100' },
                    { id: 'e_003', tagId: 't3', tagName: 'Valve', tagType: 'bool', value: 'true' }
                ]
            };

            runtime = {
                recipeStorage: {
                    getRecipeData: sandbox.stub().resolves(recipeData),
                    setRecipeData: sandbox.stub().resolves({ changes: 1 })
                },
                devices: {
                    setTagValue: sandbox.stub().resolves({}),
                    getTagValue: sandbox.stub().resolves(42)
                },
                io: {
                    emit: sandbox.spy()
                }
            };

            recipeService.init(null, null, runtime);
        });

        afterEach(() => {
            sandbox.restore();
            // Ensure no stray running recipe state bleeds between tests
            try { recipeService.cancelRecipe('r_test123'); } catch (e) { /* noop */ }
        });

        describe('downloadRecipe', () => {
            it('should emit progress for each entry and complete on success', async () => {
                await recipeService.downloadRecipe('r_test123');

                // setTagValue called for each of 3 entries
                expect(runtime.devices.setTagValue.callCount).to.equal(3);
                expect(runtime.devices.setTagValue.getCall(0).args).to.deep.equal(['t1', 25.5]);
                expect(runtime.devices.setTagValue.getCall(1).args).to.deep.equal(['t2', 100]);
                expect(runtime.devices.setTagValue.getCall(2).args).to.deep.equal(['t3', true]);

                // 7 io.emit calls: 3 writing + 3 success + 1 complete
                expect(runtime.io.emit.callCount).to.equal(7);

                // Verify complete event
                const completeCall = runtime.io.emit.getCalls().find(c =>
                    c.args[0] === 'recipe:download-complete'
                );
                expect(completeCall).to.exist;
                expect(completeCall.args[1]).to.deep.equal({
                    recipeId: 'r_test123',
                    successCount: 3,
                    errorCount: 0,
                    errors: []
                });
            });

            it('should handle partial failures and report errors', async () => {
                runtime.devices.setTagValue = sandbox.stub();
                runtime.devices.setTagValue.onFirstCall().resolves({});
                runtime.devices.setTagValue.onSecondCall().rejects(new Error('Write timeout'));
                runtime.devices.setTagValue.onThirdCall().resolves({});

                await recipeService.downloadRecipe('r_test123');

                expect(runtime.io.emit.callCount).to.equal(7);

                const completeCall = runtime.io.emit.getCalls().find(c =>
                    c.args[0] === 'recipe:download-complete'
                );
                expect(completeCall).to.exist;
                expect(completeCall.args[1].successCount).to.equal(2);
                expect(completeCall.args[1].errorCount).to.equal(1);
                expect(completeCall.args[1].errors[0].entryId).to.equal('e_002');
                expect(completeCall.args[1].errors[0].error).to.equal('Write timeout');
            });

            it('should report an error when a write fails silently (resolves null)', async () => {
                runtime.devices.setTagValue = sandbox.stub().resolves(null);

                await recipeService.downloadRecipe('r_test123');

                const completeCall = runtime.io.emit.getCalls().find(c =>
                    c.args[0] === 'recipe:download-complete'
                );
                expect(completeCall).to.exist;
                expect(completeCall.args[1].successCount).to.equal(0);
                expect(completeCall.args[1].errorCount).to.equal(3);
                expect(completeCall.args[1].errors[0].error).to.include('Write failed for tag');
                expect(completeCall.args[1].errors[0].error).to.include('Temp');
            });

            it('should emit error event if recipe is not found', async () => {
                runtime.recipeStorage.getRecipeData.resolves(null);

                try {
                    await recipeService.downloadRecipe('r_test123');
                    expect.fail('Should have thrown');
                } catch (err) {
                    expect(err.message).to.equal('Recipe not found');
                }

                const errorCall = runtime.io.emit.getCalls().find(c =>
                    c.args[0] === 'recipe:download-error'
                );
                expect(errorCall).to.exist;
                expect(errorCall.args[1].recipeId).to.equal('r_test123');
                expect(errorCall.args[1].error).to.equal('Recipe not found');
            });

            it('should prevent concurrent execution', async () => {
                // Start first download
                recipeService.downloadRecipe('r_test123');

                // Second download should be rejected
                let threw = false;
                try {
                    await recipeService.downloadRecipe('r_test123');
                } catch (err) {
                    threw = true;
                    expect(err.message).to.equal('Recipe execution already in progress');
                }
                expect(threw).to.be.true;

                // First download completes via setTimeout to avoid hanging
                await new Promise(resolve => setTimeout(resolve, 100));
                expect(recipeService.isRecipeRunning('r_test123')).to.be.false;
            });
        });

        describe('uploadRecipe', () => {
            it('should read values, emit progress, and persist on success', async () => {
                await recipeService.uploadRecipe('r_test123');

                expect(runtime.devices.getTagValue.callCount).to.equal(3);

                // Should persist because at least one succeeded
                expect(runtime.recipeStorage.setRecipeData.calledOnce).to.be.true;

                const completeCall = runtime.io.emit.getCalls().find(c =>
                    c.args[0] === 'recipe:upload-complete'
                );
                expect(completeCall).to.exist;
                expect(completeCall.args[1].successCount).to.equal(3);
            });

            it('should NOT persist if all entries fail', async () => {
                runtime.devices.getTagValue = sandbox.stub().rejects(new Error('Read failed'));

                await recipeService.uploadRecipe('r_test123');

                // setRecipeData should NOT be called (successCount === 0)
                expect(runtime.recipeStorage.setRecipeData.called).to.be.false;

                const completeCall = runtime.io.emit.getCalls().find(c =>
                    c.args[0] === 'recipe:upload-complete'
                );
                expect(completeCall).to.exist;
                expect(completeCall.args[1].successCount).to.equal(0);
                expect(completeCall.args[1].errorCount).to.equal(3);
            });

            it('should report an error and not persist when a read returns null', async () => {
                runtime.devices.getTagValue = sandbox.stub().resolves(null);

                await recipeService.uploadRecipe('r_test123');

                expect(runtime.recipeStorage.setRecipeData.called).to.be.false;

                const completeCall = runtime.io.emit.getCalls().find(c =>
                    c.args[0] === 'recipe:upload-complete'
                );
                expect(completeCall).to.exist;
                expect(completeCall.args[1].successCount).to.equal(0);
                expect(completeCall.args[1].errorCount).to.equal(3);
                expect(completeCall.args[1].errors[0].error).to.include('Read failed for tag');
            });

            it('should persist if at least one entry succeeded', async () => {
                runtime.devices.getTagValue = sandbox.stub();
                runtime.devices.getTagValue.onFirstCall().resolves(99);
                runtime.devices.getTagValue.onSecondCall().rejects(new Error('timeout'));
                runtime.devices.getTagValue.onThirdCall().rejects(new Error('timeout'));

                await recipeService.uploadRecipe('r_test123');

                // setRecipeData should be called (successCount === 1 > 0)
                expect(runtime.recipeStorage.setRecipeData.calledOnce).to.be.true;
                expect(runtime.recipeStorage.setRecipeData.calledWith('r_test123')).to.be.true;
            });
        });

        describe('cancelRecipe', () => {
            it('should cancel a running recipe', async () => {
                // Fire download (it will start and add to runningRecipes)
                const downloadPromise = recipeService.downloadRecipe('r_test123').catch(() => {});

                // Cancel immediately after the first microtask
                await new Promise(resolve => setTimeout(resolve, 10));
                recipeService.cancelRecipe('r_test123');

                expect(recipeService.isRecipeRunning('r_test123')).to.be.false;

                // Wait for download to finish its cleanup
                await downloadPromise;
            });

            it('should be a no-op for non-running recipe', () => {
                expect(() => recipeService.cancelRecipe('nonexistent')).to.not.throw();
            });
        });

        describe('isRecipeRunning', () => {
            it('should return false after download completes', async () => {
                await recipeService.downloadRecipe('r_test123');
                expect(recipeService.isRecipeRunning('r_test123')).to.be.false;
            });
        });
    });
});
