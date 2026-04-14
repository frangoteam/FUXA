/**
 * 测试 Modbus RTU 重新加载变量后的数据读取
 * 模拟新增/删除变量后的情况
 * 测试所有类型的寄存器
 */

const ModbusRTU = require('modbus-serial');
const client = new ModbusRTU();

const PORT = 'COM20';
const BAUDRATE = 9600;

// 测试配置
const testConfig = {
    slaves: [1, 2, 3, 4, 5],
    baseAddress: 1,
    count: 10
};

async function testReadCoils(slaveId, address, count) {
    try {
        client.setID(slaveId);
        console.log(`\n[从站 ${slaveId}] 读取 Coil Status 地址:${address} 数量:${count}`);
        
        const result = await client.readCoils(address - 1, count);
        console.log(`  原始结果:`, result);
        console.log(`  数据:`, result.data);
        
        // 解析数据
        if (result.data && result.data.length > 0) {
            for (let i = 0; i < result.data.length; i++) {
                console.log(`  Coil ${address + i}: ${result.data[i]}`);
            }
        }
        
        return result;
    } catch (err) {
        console.error(`  读取失败:`, err.message);
        return null;
    }
}

async function testReadDiscreteInputs(slaveId, address, count) {
    try {
        client.setID(slaveId);
        console.log(`\n[从站 ${slaveId}] 读取 Digital Inputs 地址:${address} 数量:${count}`);
        
        const result = await client.readDiscreteInputs(address - 1, count);
        console.log(`  原始结果:`, result);
        console.log(`  数据:`, result.data);
        
        // 解析数据
        if (result.data && result.data.length > 0) {
            for (let i = 0; i < result.data.length; i++) {
                console.log(`  Input ${address + i}: ${result.data[i]}`);
            }
        }
        
        return result;
    } catch (err) {
        console.error(`  读取失败:`, err.message);
        return null;
    }
}

async function testReadInputRegisters(slaveId, address, count) {
    try {
        client.setID(slaveId);
        console.log(`\n[从站 ${slaveId}] 读取 Input Registers 地址:${address} 数量:${count}`);
        
        const result = await client.readInputRegisters(address - 1, count);
        console.log(`  原始结果:`, result);
        console.log(`  数据:`, result.data);
        console.log(`  Buffer:`, result.buffer);
        
        // 解析数据
        if (result.data && result.data.length > 0) {
            for (let i = 0; i < result.data.length; i++) {
                console.log(`  寄存器 ${address + i}: ${result.data[i]}`);
            }
        }
        
        return result;
    } catch (err) {
        console.error(`  读取失败:`, err.message);
        return null;
    }
}

async function testReadHoldingRegisters(slaveId, address, count) {
    try {
        client.setID(slaveId);
        console.log(`\n[从站 ${slaveId}] 读取保持寄存器 地址:${address} 数量:${count}`);
        
        const result = await client.readHoldingRegisters(address - 1, count);
        console.log(`  原始结果:`, result);
        console.log(`  数据:`, result.data);
        console.log(`  Buffer:`, result.buffer);
        
        // 解析数据
        if (result.data && result.data.length > 0) {
            for (let i = 0; i < result.data.length; i++) {
                console.log(`  寄存器 ${address + i}: ${result.data[i]}`);
            }
        }
        
        return result;
    } catch (err) {
        console.error(`  读取失败:`, err.message);
        return null;
    }
}

async function testWriteCoil(slaveId, address, value) {
    try {
        client.setID(slaveId);
        console.log(`\n[从站 ${slaveId}] 写入 Coil Status 地址:${address} 值:${value}`);
        
        await client.writeCoil(address - 1, value);
        console.log(`  写入成功`);
        
        // 验证写入
        const result = await client.readCoils(address - 1, 1);
        console.log(`  验证读取: ${result.data[0]}`);
        
        return true;
    } catch (err) {
        console.error(`  写入失败:`, err.message);
        return false;
    }
}

async function testWriteRegister(slaveId, address, value) {
    try {
        client.setID(slaveId);
        console.log(`\n[从站 ${slaveId}] 写入保持寄存器 地址:${address} 值:${value}`);
        
        await client.writeRegister(address - 1, value);
        console.log(`  写入成功`);
        
        // 验证写入
        const result = await client.readHoldingRegisters(address - 1, 1);
        console.log(`  验证读取: ${result.data[0]}`);
        
        return true;
    } catch (err) {
        console.error(`  写入失败:`, err.message);
        return false;
    }
}

async function runTest() {
    try {
        console.log('=== Modbus RTU 所有寄存器类型测试 ===\n');
        
        // 连接串口
        await client.connectRTUBuffered(PORT, {
            baudRate: BAUDRATE,
            dataBits: 8,
            stopBits: 1,
            parity: 'none'
        });
        console.log(`已连接到 ${PORT}`);
        
        // 测试1: 测试 Coil Status (000001-065536)
        console.log('\n--- 测试1: Coil Status 测试 ---');
        for (const slaveId of testConfig.slaves) {
            await testReadCoils(slaveId, 1, 5);
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // 测试2: 测试 Digital Inputs (100001-165536)
        console.log('\n--- 测试2: Digital Inputs 测试 ---');
        for (const slaveId of testConfig.slaves) {
            await testReadDiscreteInputs(slaveId, 1, 5);
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // 测试3: 测试 Input Registers (300001-365536)
        console.log('\n--- 测试3: Input Registers 测试 ---');
        for (const slaveId of testConfig.slaves) {
            await testReadInputRegisters(slaveId, 1, 5);
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // 测试4: 测试 Holding Registers (400001-465536)
        console.log('\n--- 测试4: Holding Registers 测试 ---');
        for (const slaveId of testConfig.slaves) {
            await testReadHoldingRegisters(slaveId, 1, 5);
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // 测试5: 写入测试
        console.log('\n--- 测试5: 写入测试 ---');
        for (const slaveId of testConfig.slaves) {
            // 写入 Coil
            await testWriteCoil(slaveId, 1, true);
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // 写入 Holding Register
            await testWriteRegister(slaveId, 8, 100 + slaveId);
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // 测试6: 快速切换从站和寄存器类型
        console.log('\n--- 测试6: 快速切换从站和寄存器类型 ---');
        for (let i = 0; i < 2; i++) {
            console.log(`\n第 ${i + 1} 轮快速切换:`);
            for (const slaveId of testConfig.slaves) {
                // 读取 Coil
                await testReadCoils(slaveId, 1, 1);
                await new Promise(resolve => setTimeout(resolve, 30));
                
                // 读取 Input Register
                await testReadInputRegisters(slaveId, 1, 1);
                await new Promise(resolve => setTimeout(resolve, 30));
                
                // 读取 Holding Register
                await testReadHoldingRegisters(slaveId, 1, 1);
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
