/**
 * 测试 Modbus RTU 重新加载变量后的数据读取
 * 模拟新增/删除变量后的情况
 */

const ModbusRTU = require('modbus-serial');
const client = new ModbusRTU();

const PORT = 'COM20';
const BAUDRATE = 9600;

// 测试配置 - 模拟新增变量 I1.1
const testConfig = {
    slaves: [1, 2, 3, 4, 5],
    // 原有变量
    existingVars: [
        { slaveId: 1, address: 1, type: 'Int16' },
        { slaveId: 1, address: 2, type: 'Int32' },
        { slaveId: 1, address: 4, type: 'UInt32' },
        { slaveId: 2, address: 1, type: 'Int16' },
        { slaveId: 2, address: 2, type: 'Int32' },
        { slaveId: 3, address: 1, type: 'Int16' },
    ],
    // 新增变量 I1.1 (从站1，输入寄存器地址1)
    newVar: { slaveId: 1, address: 1, type: 'Int16', memaddress: 300000 }
};

async function readHoldingRegisters(slaveId, address, count) {
    try {
        client.setID(slaveId);
        const result = await client.readHoldingRegisters(address - 1, count);
        return result.data;
    } catch (err) {
        console.error(`[从站 ${slaveId}] 读取保持寄存器失败:`, err.message);
        return null;
    }
}

async function readInputRegisters(slaveId, address, count) {
    try {
        client.setID(slaveId);
        const result = await client.readInputRegisters(address - 1, count);
        return result.data;
    } catch (err) {
        console.error(`[从站 ${slaveId}] 读取输入寄存器失败:`, err.message);
        return null;
    }
}

async function runTest() {
    try {
        console.log('=== Modbus RTU 重新加载变量测试 ===\n');
        
        // 连接串口
        await client.connectRTUBuffered(PORT, {
            baudRate: BAUDRATE,
            dataBits: 8,
            stopBits: 1,
            parity: 'none'
        });
        console.log(`已连接到 ${PORT}\n`);
        
        // 测试1: 读取原有变量
        console.log('--- 测试1: 读取原有变量 ---');
        for (const v of testConfig.existingVars) {
            const data = await readHoldingRegisters(v.slaveId, v.address, v.type === 'Int32' || v.type === 'UInt32' ? 2 : 1);
            if (data) {
                console.log(`[从站 ${v.slaveId}] 地址 ${v.address} (${v.type}): ${data[0]}${data[1] !== undefined ? ', ' + data[1] : ''}`);
            }
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // 测试2: 模拟新增变量 I1.1 后，读取所有变量
        console.log('\n--- 测试2: 模拟新增变量 I1.1 后 ---');
        console.log('新增变量: I1.1 (从站1，输入寄存器地址1)');
        
        // 读取原有变量
        for (const v of testConfig.existingVars) {
            const data = await readHoldingRegisters(v.slaveId, v.address, v.type === 'Int32' || v.type === 'UInt32' ? 2 : 1);
            if (data) {
                console.log(`[从站 ${v.slaveId}] 保持寄存器 地址 ${v.address} (${v.type}): ${data[0]}${data[1] !== undefined ? ', ' + data[1] : ''}`);
            }
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // 读取新增变量
        const inputData = await readInputRegisters(testConfig.newVar.slaveId, testConfig.newVar.address, 1);
        if (inputData) {
            console.log(`[从站 ${testConfig.newVar.slaveId}] 输入寄存器 地址 ${testConfig.newVar.address} (${testConfig.newVar.type}): ${inputData[0]}`);
        }
        
        // 测试3: 快速切换读取
        console.log('\n--- 测试3: 快速切换读取 ---');
        for (let i = 0; i < 3; i++) {
            console.log(`\n第 ${i + 1} 轮:`);
            for (const slaveId of testConfig.slaves) {
                const data = await readHoldingRegisters(slaveId, 1, 1);
                if (data) {
                    console.log(`  [从站 ${slaveId}] 保持寄存器 地址 1: ${data[0]}`);
                }
                await new Promise(resolve => setTimeout(resolve, 30));
            }
        }
        
        console.log('\n=== 测试完成 ===');
        
    } catch (err) {
        console.error('测试失败:', err);
    } finally {
        client.close(() => {
            console.log('连接已关闭');
            process.exit(0);
        });
    }
}

runTest();
