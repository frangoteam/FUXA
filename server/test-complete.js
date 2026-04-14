/**
 * 完整测试 - 验证所有功能
 * 包括 Coil、Input、Float64 类型的读写
 */

const ModbusRTU = require('modbus-serial');
const client = new ModbusRTU();

const PORT = 'COM20';
const BAUDRATE = 9600;

// 测试结果
const testResults = {
    coil: { passed: 0, failed: 0, details: [] },
    input: { passed: 0, failed: 0, details: [] },
    inputRegister: { passed: 0, failed: 0, details: [] },
    holdingRegister: { passed: 0, failed: 0, details: [] },
    float64: { passed: 0, failed: 0, details: [] }
};

async function testComplete() {
    try {
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║         FUXA Modbus RTU 完整功能测试                       ║');
        console.log('╚════════════════════════════════════════════════════════════╝\n');
        
        // 连接串口
        await client.connectRTU(PORT, {
            baudRate: BAUDRATE,
            dataBits: 8,
            stopBits: 1,
            parity: 'none'
        });
        console.log(`✓ 已连接到 ${PORT}\n`);
        
        // 测试所有从站
        for (let slaveId = 1; slaveId <= 5; slaveId++) {
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`【从站 ${slaveId}】测试开始`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
            
            client.setID(slaveId);
            
            // 1. 测试 Coil Status
            console.log('▸ Coil Status 测试');
            try {
                const coilRes = await client.readCoils(0, 5);
                console.log(`  读取地址 1-5: ${JSON.stringify(coilRes.data.slice(0, 5))}`);
                
                // 写入测试
                await client.writeCoil(0, true);
                await new Promise(resolve => setTimeout(resolve, 50));
                const coilVerify = await client.readCoils(0, 1);
                
                if (coilVerify.data[0] === true) {
                    console.log(`  ✓ 写入/读取 Coil 1: true`);
                    testResults.coil.passed++;
                    testResults.coil.details.push(`从站${slaveId} Coil 1: 通过`);
                } else {
                    console.log(`  ✗ 写入/读取 Coil 1: 失败`);
                    testResults.coil.failed++;
                    testResults.coil.details.push(`从站${slaveId} Coil 1: 失败`);
                }
                
                // 恢复为 false
                await client.writeCoil(0, false);
            } catch (err) {
                console.log(`  ✗ Coil 测试失败: ${err.message}`);
                testResults.coil.failed++;
            }
            console.log();
            
            // 2. 测试 Digital Inputs
            console.log('▸ Digital Inputs 测试');
            try {
                const inputRes = await client.readDiscreteInputs(0, 5);
                console.log(`  读取地址 1-5: ${JSON.stringify(inputRes.data.slice(0, 5))}`);
                console.log(`  ✓ Digital Inputs 读取正常`);
                testResults.input.passed++;
                testResults.input.details.push(`从站${slaveId}: 通过`);
            } catch (err) {
                console.log(`  ✗ Digital Inputs 测试失败: ${err.message}`);
                testResults.input.failed++;
            }
            console.log();
            
            // 3. 测试 Input Registers
            console.log('▸ Input Registers 测试');
            try {
                const inputRegRes = await client.readInputRegisters(0, 5);
                console.log(`  读取地址 1-5: ${JSON.stringify(inputRegRes.data)}`);
                console.log(`  ✓ Input Registers 读取正常`);
                testResults.inputRegister.passed++;
                testResults.inputRegister.details.push(`从站${slaveId}: 通过`);
            } catch (err) {
                console.log(`  ✗ Input Registers 测试失败: ${err.message}`);
                testResults.inputRegister.failed++;
            }
            console.log();
            
            // 4. 测试 Holding Registers (Int16)
            console.log('▸ Holding Registers (Int16) 测试');
            try {
                const testValue = 1000 + slaveId * 100;
                await client.writeRegister(0, testValue);
                await new Promise(resolve => setTimeout(resolve, 50));
                const holdingRes = await client.readHoldingRegisters(0, 1);
                
                if (holdingRes.data[0] === testValue) {
                    console.log(`  ✓ 写入/读取 地址 1: ${testValue}`);
                    testResults.holdingRegister.passed++;
                    testResults.holdingRegister.details.push(`从站${slaveId} Int16: 通过`);
                } else {
                    console.log(`  ✗ 写入/读取 地址 1: 期望值 ${testValue}, 实际值 ${holdingRes.data[0]}`);
                    testResults.holdingRegister.failed++;
                }
            } catch (err) {
                console.log(`  ✗ Holding Registers 测试失败: ${err.message}`);
                testResults.holdingRegister.failed++;
            }
            console.log();
            
            // 5. 测试 Float64
            console.log('▸ Float64 测试');
            try {
                const testValue = 3.141592653589793 * slaveId;
                const buffer = Buffer.allocUnsafe(8);
                buffer.writeDoubleBE(testValue, 0);
                const registers = [];
                for (let i = 0; i < 8; i += 2) {
                    registers.push(buffer.readUInt16BE(i));
                }
                
                await client.writeRegisters(7, registers);
                await new Promise(resolve => setTimeout(resolve, 50));
                const float64Res = await client.readHoldingRegisters(7, 4);
                
                const readBuffer = Buffer.allocUnsafe(8);
                for (let i = 0; i < 4; i++) {
                    readBuffer.writeUInt16BE(float64Res.data[i], i * 2);
                }
                const readValue = readBuffer.readDoubleBE(0);
                const error = Math.abs(testValue - readValue);
                
                if (error < 1e-10) {
                    console.log(`  ✓ 写入/读取 Float64 地址 8: ${readValue} (误差: ${error})`);
                    testResults.float64.passed++;
                    testResults.float64.details.push(`从站${slaveId} Float64: 通过 (误差: ${error})`);
                } else {
                    console.log(`  ✗ 写入/读取 Float64 地址 8: 期望值 ${testValue}, 实际值 ${readValue}`);
                    testResults.float64.failed++;
                }
            } catch (err) {
                console.log(`  ✗ Float64 测试失败: ${err.message}`);
                testResults.float64.failed++;
            }
            console.log();
        }
        
        // 生成测试报告
        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║                     测试报告                               ║');
        console.log('╚════════════════════════════════════════════════════════════╝\n');
        
        console.log('┌─────────────────────┬─────────┬─────────┐');
        console.log('│ 测试项目            │ 通过    │ 失败    │');
        console.log('├─────────────────────┼─────────┼─────────┤');
        console.log(`│ Coil Status         │ ${String(testResults.coil.passed).padEnd(7)} │ ${String(testResults.coil.failed).padEnd(7)} │`);
        console.log(`│ Digital Inputs      │ ${String(testResults.input.passed).padEnd(7)} │ ${String(testResults.input.failed).padEnd(7)} │`);
        console.log(`│ Input Registers     │ ${String(testResults.inputRegister.passed).padEnd(7)} │ ${String(testResults.inputRegister.failed).padEnd(7)} │`);
        console.log(`│ Holding Registers   │ ${String(testResults.holdingRegister.passed).padEnd(7)} │ ${String(testResults.holdingRegister.failed).padEnd(7)} │`);
        console.log(`│ Float64             │ ${String(testResults.float64.passed).padEnd(7)} │ ${String(testResults.float64.failed).padEnd(7)} │`);
        console.log('└─────────────────────┴─────────┴─────────┘');
        
        const totalPassed = testResults.coil.passed + testResults.input.passed + 
                           testResults.inputRegister.passed + testResults.holdingRegister.passed + 
                           testResults.float64.passed;
        const totalFailed = testResults.coil.failed + testResults.input.failed + 
                           testResults.inputRegister.failed + testResults.holdingRegister.failed + 
                           testResults.float64.failed;
        
        console.log(`\n总计: ${totalPassed} 通过, ${totalFailed} 失败`);
        
        if (totalFailed === 0) {
            console.log('\n✓ 所有测试通过！');
        } else {
            console.log('\n✗ 存在失败的测试');
        }
        
    } catch (err) {
        console.error('测试失败:', err);
    } finally {
        client.close(() => {
            console.log('\n连接已关闭');
        });
    }
}

testComplete();
