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

            it('should treat a false boolean write result as a successful write', async () => {
                runtime.devices.setTagValue = sandbox.stub().resolves(false);

                await recipeService.downloadRecipe('r_test123');

                const completeCall = runtime.io.emit.getCalls().find(c =>
                    c.args[0] === 'recipe:download-complete'
                );
                expect(completeCall).to.exist;
                expect(completeCall.args[1].successCount).to.equal(3);
                expect(completeCall.args[1].errorCount).to.equal(0);
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

            it('should stop the first run when cancelled and immediately re-run', async () => {
                // Gate writes: the first run pauses on write 1, the re-run on write 2
                let releaseFirstWrite;
                let releaseSecondWrite;
                let firstWriteStarted;
                let secondWriteStarted;
                const firstWriteGate = new Promise(resolve => { releaseFirstWrite = resolve; });
                const secondWriteGate = new Promise(resolve => { releaseSecondWrite = resolve; });
                const firstWriteStartedPromise = new Promise(resolve => { firstWriteStarted = resolve; });
                const secondWriteStartedPromise = new Promise(resolve => { secondWriteStarted = resolve; });

                runtime.devices.setTagValue = sandbox.stub();
                let writeCalls = 0;
                runtime.devices.setTagValue.callsFake(() => {
                    writeCalls++;
                    if (writeCalls === 1) {
                        firstWriteStarted();
                        return firstWriteGate;
                    }
                    if (writeCalls === 2) {
                        secondWriteStarted();
                        return secondWriteGate;
                    }
                    return Promise.resolve({});
                });

                // Start the first run and wait until it is in-flight on its first write
                const firstRun = recipeService.downloadRecipe('r_test123').catch(() => {});
                await firstWriteStartedPromise;

                // Cancel, then immediately start a second run of the same recipe
                recipeService.cancelRecipe('r_test123');
                const secondRun = recipeService.downloadRecipe('r_test123').catch(() => {});
                await secondWriteStartedPromise;

                // Release the first run's pending write: it must NOT continue once
                // the second run re-added the running state
                releaseFirstWrite({});
                await firstRun;

                expect(writeCalls).to.equal(2);

                // Let the second run finish normally
                releaseSecondWrite({});
                await secondRun;

                expect(writeCalls).to.equal(4);
                expect(recipeService.isRecipeRunning('r_test123')).to.be.false;

                // The superseded first run must not emit COMPLETE or CANCELED to
                // the new owner — only the second run completes. This suppresses
                // stale events that would otherwise flip the client dialog back.
                const completeCalls = runtime.io.emit.getCalls().filter(c =>
                    c.args[0] === 'recipe:download-complete'
                );
                expect(completeCalls).to.have.length(1);
                expect(completeCalls[0].args[1].successCount).to.equal(3);

                const cancelCalls = runtime.io.emit.getCalls().filter(c =>
                    c.args[0] === 'recipe:cancel-confirmed'
                );
                expect(cancelCalls).to.have.length(0);
            });

            it('should treat a cancel during the FINAL entry write as a cancel (no COMPLETE)', async () => {
                // 1-entry recipe: the single device write IS the final entry op,
                // and it is exactly where the user clicks Cancel.
                recipeData.entries = [
                    { id: 'e_001', tagId: 't1', tagName: 'Temp', tagType: 'real', value: '25.5' }
                ];

                let releaseWrite;
                let writeStarted;
                const writeGate = new Promise(resolve => { releaseWrite = resolve; });
                const writeStartedPromise = new Promise(resolve => { writeStarted = resolve; });

                runtime.devices.setTagValue = sandbox.stub().callsFake(() => {
                    writeStarted();
                    return writeGate;
                });

                const downloadPromise = recipeService.downloadRecipe('r_test123').catch(() => {});
                await writeStartedPromise;

                // Cancel while the final (only) entry write is still in flight
                recipeService.cancelRecipe('r_test123');
                releaseWrite({});
                await downloadPromise;

                // The loop must observe the cancel after the in-flight write and
                // emit CANCELED, never DOWNLOAD_COMPLETE.
                expect(runtime.io.emit.getCalls().some(c =>
                    c.args[0] === 'recipe:download-complete'
                )).to.be.false;
                expect(runtime.io.emit.getCalls().some(c =>
                    c.args[0] === 'recipe:cancel-confirmed'
                )).to.be.true;
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

            it('should treat a false boolean value as a successful read and persist', async () => {
                runtime.devices.getTagValue = sandbox.stub().resolves(false);

                await recipeService.uploadRecipe('r_test123');

                expect(runtime.recipeStorage.setRecipeData.calledOnce).to.be.true;

                const completeCall = runtime.io.emit.getCalls().find(c =>
                    c.args[0] === 'recipe:upload-complete'
                );
                expect(completeCall).to.exist;
                expect(completeCall.args[1].successCount).to.equal(3);
                expect(completeCall.args[1].errorCount).to.equal(0);
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

            it('should NOT persist partial data when cancelled mid-upload', async () => {
                let releaseFirstRead;
                let firstReadStarted;
                const firstReadGate = new Promise(resolve => { releaseFirstRead = resolve; });
                const firstReadStartedPromise = new Promise(resolve => { firstReadStarted = resolve; });

                runtime.devices.getTagValue = sandbox.stub();
                let readCalls = 0;
                runtime.devices.getTagValue.callsFake(() => {
                    readCalls++;
                    if (readCalls === 1) {
                        firstReadStarted();
                        return firstReadGate;
                    }
                    return Promise.resolve(7);
                });

                const uploadPromise = recipeService.uploadRecipe('r_test123').catch(() => {});
                await firstReadStartedPromise;

                recipeService.cancelRecipe('r_test123');

                // Release the pending read: entry 1 succeeds, then the loop breaks on cancel
                releaseFirstRead(99);
                await uploadPromise;

                // successCount === 1 but the run was cancelled, so the partial
                // recipe must NOT be persisted and no COMPLETE may be emitted
                expect(runtime.recipeStorage.setRecipeData.called).to.be.false;
                expect(runtime.io.emit.getCalls().some(c => c.args[0] === 'recipe:upload-complete')).to.be.false;
                // Cancel confirmation emitted (no successor owns the slot)
                expect(runtime.io.emit.getCalls().some(c => c.args[0] === 'recipe:cancel-confirmed')).to.be.true;
            });

            it('should stop the first upload when cancelled and immediately re-run (no stale events)', async () => {
                let releaseFirstRead;
                let releaseSecondRead;
                let firstReadStarted;
                let secondReadStarted;
                const firstReadGate = new Promise(resolve => { releaseFirstRead = resolve; });
                const secondReadGate = new Promise(resolve => { releaseSecondRead = resolve; });
                const firstReadStartedPromise = new Promise(resolve => { firstReadStarted = resolve; });
                const secondReadStartedPromise = new Promise(resolve => { secondReadStarted = resolve; });

                runtime.devices.getTagValue = sandbox.stub();
                let readCalls = 0;
                runtime.devices.getTagValue.callsFake(() => {
                    readCalls++;
                    if (readCalls === 1) {
                        firstReadStarted();
                        return firstReadGate;
                    }
                    if (readCalls === 2) {
                        secondReadStarted();
                        return secondReadGate;
                    }
                    return Promise.resolve(7);
                });

                // Start the first upload and wait until it is in-flight on its first read
                const firstRun = recipeService.uploadRecipe('r_test123').catch(() => {});
                await firstReadStartedPromise;

                // Cancel, then immediately start a second upload of the same recipe
                recipeService.cancelRecipe('r_test123');
                const secondRun = recipeService.uploadRecipe('r_test123').catch(() => {});
                await secondReadStartedPromise;

                // Release the first run's pending read: it must NOT continue once
                // the second run re-added the running state
                releaseFirstRead(42);
                await firstRun;

                expect(readCalls).to.equal(2);

                // Let the second run finish normally
                releaseSecondRead(42);
                await secondRun;

                expect(readCalls).to.equal(4);
                expect(recipeService.isRecipeRunning('r_test123')).to.be.false;

                // Only the second run may emit COMPLETE; the superseded first run
                // must not emit COMPLETE or CANCELED to the new owner
                const completeCalls = runtime.io.emit.getCalls().filter(c =>
                    c.args[0] === 'recipe:upload-complete'
                );
                expect(completeCalls).to.have.length(1);
                expect(completeCalls[0].args[1].successCount).to.equal(3);

                const cancelCalls = runtime.io.emit.getCalls().filter(c =>
                    c.args[0] === 'recipe:cancel-confirmed'
                );
                expect(cancelCalls).to.have.length(0);
            });

            it('should NOT persist or emit COMPLETE when a cancel lands during the FINAL entry read', async () => {
                // 1-entry recipe: the single device read IS the final entry op,
                // and it is exactly where the user clicks Cancel.
                recipeData.entries = [
                    { id: 'e_001', tagId: 't1', tagName: 'Temp', tagType: 'real', value: '25.5' }
                ];

                let releaseRead;
                let readStarted;
                const readGate = new Promise(resolve => { releaseRead = resolve; });
                const readStartedPromise = new Promise(resolve => { readStarted = resolve; });

                runtime.devices.getTagValue = sandbox.stub().callsFake(() => {
                    readStarted();
                    return readGate;
                });

                const uploadPromise = recipeService.uploadRecipe('r_test123').catch(() => {});
                await readStartedPromise;

                // Cancel while the final (only) entry read is still in flight
                recipeService.cancelRecipe('r_test123');
                releaseRead(99);
                await uploadPromise;

                // The loop must observe the cancel after the in-flight read:
                // successCount is 1 but the run was cancelled, so the recipe must
                // NOT be persisted and no UPLOAD_COMPLETE may be emitted.
                expect(runtime.recipeStorage.setRecipeData.called).to.be.false;
                expect(runtime.io.emit.getCalls().some(c =>
                    c.args[0] === 'recipe:upload-complete'
                )).to.be.false;
                expect(runtime.io.emit.getCalls().some(c =>
                    c.args[0] === 'recipe:cancel-confirmed'
                )).to.be.true;
                expect(recipeService.isRecipeRunning('r_test123')).to.be.false;
            });
        });

        describe('cancelRecipe', () => {
            it('should cancel a running recipe and break the loop', async () => {
                // Gate the first write so the cancel happens mid-loop
                let releaseFirstWrite;
                let firstWriteStarted;
                const firstWriteGate = new Promise(resolve => { releaseFirstWrite = resolve; });
                const firstWriteStartedPromise = new Promise(resolve => { firstWriteStarted = resolve; });

                runtime.devices.setTagValue = sandbox.stub();
                let writeCalls = 0;
                runtime.devices.setTagValue.callsFake(() => {
                    writeCalls++;
                    if (writeCalls === 1) {
                        firstWriteStarted();
                        return firstWriteGate;
                    }
                    return Promise.resolve({});
                });

                const downloadPromise = recipeService.downloadRecipe('r_test123').catch(() => {});

                // Wait until the loop is in-flight on its first write
                await firstWriteStartedPromise;
                recipeService.cancelRecipe('r_test123');

                expect(recipeService.isRecipeRunning('r_test123')).to.be.false;

                // Release the pending write: the loop must break, not continue to entry 2
                releaseFirstWrite({});
                await downloadPromise;

                expect(writeCalls).to.equal(1);
                expect(runtime.io.emit.getCalls().some(c =>
                    c.args[0] === 'recipe:cancel-confirmed'
                )).to.be.true;
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
