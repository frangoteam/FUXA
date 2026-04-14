/**
 * 详细测试脚本 - 验证 Coil、Input、Float64 类型的实际值
 */

const ModbusRTU = require('modbus-serial');
const client = new ModbusRTU();

const PORT = 'COM20';
const BAUDRATE = 9600;

async function testDetailed() {
    try {
        console.log('=== 详细测试 - 验证实际值 ===\n');
        
        // 连接串口
        await client.connectRTU(PORT, {
            baudRate: BAUDRATE,
            dataBits: 8,
            stopBits: 1,
            parity: 'none'
        });
        console.log(`已连接到 ${PORT}\n`);
        
        // 测试从站 1
        const slaveId = 1;
        client.setID(slaveId);
        
        // 1. 测试 Coil Status - 地址 1-5
        console.log(`[从站 ${slaveId}] 读取 Coil Status 地址:1-5`);
        const coilRes = await client.readCoils(0, 5);
        console.log('  原始结果:', coilRes);
        console.log('  data 类型:', typeof coilRes.data);
        console.log('  data 是数组:', Array.isArray(coilRes.data));
        if (Array.isArray(coilRes.data)) {
            console.log('  data 长度:', coilRes.data.length);
            console.log('  data 内容:', coilRes.data);
            console.log('  data[0] 类型:', typeof coilRes.data[0]);
        }
        console.log('  buffer:', coilRes.buffer ? coilRes.buffer.toString('hex') : 'undefined');
        console.log();
        
        // 2. 测试 Digital Inputs - 地址 1-5
        console.log(`[从站 ${slaveId}] 读取 Digital Inputs 地址:1-5`);
        const inputRes = await client.readDiscreteInputs(0, 5);
        console.log('  原始结果:', inputRes);
        console.log('  data 类型:', typeof inputRes.data);
        console.log('  data 是数组:', Array.isArray(inputRes.data));
        if (Array.isArray(inputRes.data)) {
            console.log('  data 长度:', inputRes.data.length);
            console.log('  data 内容:', inputRes.data);
            console.log('  data[0] 类型:', typeof inputRes.data[0]);
        }
        console.log('  buffer:', inputRes.buffer ? inputRes.buffer.toString('hex') : 'undefined');
        console.log();
        
        // 3. 测试 Input Registers - 地址 1-5
        console.log(`[从站 ${slaveId}] 读取 Input Registers 地址:1-5`);
        const inputRegRes = await client.readInputRegisters(0, 5);
        console.log('  原始结果:', inputRegRes);
        console.log('  data:', inputRegRes.data);
        console.log('  buffer:', inputRegRes.buffer ? inputRegRes.buffer.toString('hex') : 'undefined');
        console.log();
        
        // 4. 测试 Holding Registers - 地址 1-40 (包含 Float64)
        console.log(`[从站 ${slaveId}] 读取 Holding Registers 地址:1-40`);
        const holdingRes = await client.readHoldingRegisters(0, 40);
        console.log('  原始结果 data:', holdingRes.data);
        console.log('  buffer:', holdingRes.buffer ? holdingRes.buffer.toString('hex') : 'undefined');
        
        // 解析 Float64 (地址 8-11)
        if (holdingRes.buffer && holdingRes.buffer.length >= 24) {
            const float64BE = holdingRes.buffer.readDoubleBE(14); // 地址 8 开始 (8-1)*2 = 14
            console.log('  Float64 (地址8, 大端):', float64BE);
        }
        console.log();
        
        // 5. 写入测试值到 Holding Registers 地址 8 (Float64)
        console.log(`[从站 ${slaveId}] 写入 Float64 测试值到地址 8`);
        const testValue = 123.456789;
        const buffer = Buffer.allocUnsafe(8);
        buffer.writeDoubleBE(testValue, 0);
        const registers = [];
        for (let i = 0; i < 8; i += 2) {
            registers.push(buffer.readUInt16BE(i));
        }
        console.log('  写入值:', testValue);
        console.log('  寄存器值:', registers);
        await client.writeRegisters(7, registers); // 地址 8 (0-indexed: 7)
        console.log('  写入成功');
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 读取验证
        const verifyRes = await client.readHoldingRegisters(7, 4);
        console.log('  读取验证 data:', verifyRes.data);
        if (verifyRes.buffer && verifyRes.buffer.length >= 8) {
            const verifyValue = verifyRes.buffer.readDoubleBE(0);
            console.log('  读取验证 Float64:', verifyValue);
            console.log('  误差:', Math.abs(testValue - verifyValue));
        }
        console.log();
        
        // 6. 写入 Coil 测试
        console.log(`[从站 ${slaveId}] 写入 Coil 地址 1 = true`);
        await client.writeCoil(0, true);
        console.log('  写入成功');
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const coilVerify = await client.readCoils(0, 1);
        console.log('  读取验证:', coilVerify.data);
        console.log();
        
        console.log('=== 详细测试完成 ===');
        
    } catch (err) {
        console.error('测试失败:', err);
    } finally {
        client.close(() => {
            console.log('连接已关闭');
        });
    }
}

testDetailed();
