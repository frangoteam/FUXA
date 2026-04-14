/**
 * Float64 类型数据解析测试
 * 验证 Float64、Float64LE、Float64MLE 类型的读写
 */

const ModbusRTU = require('modbus-serial');
const client = new ModbusRTU();

const PORT = 'COM20';
const BAUDRATE = 9600;

// Float64 测试值
const testValues = {
    Float64: 3.141592653589793,
    Float64LE: 2.718281828459045,
    Float64MLE: 1.4142135623730951
};

// 将 Float64 转换为 4 个 16 位寄存器值（大端）
function float64ToRegisters(value, endian = 'BE') {
    const buffer = Buffer.allocUnsafe(8);
    buffer.writeDoubleBE(value, 0);
    
    if (endian === 'LE') {
        // 小端：反转字节顺序
        for (let i = 0; i < 4; i++) {
            const temp = buffer[i];
            buffer[i] = buffer[7 - i];
            buffer[7 - i] = temp;
        }
    } else if (endian === 'MLE') {
        // Modbus 中间小端：交换 16 位字对
        for (let i = 0; i < 8; i += 4) {
            const temp0 = buffer[i];
            const temp1 = buffer[i + 1];
            buffer[i] = buffer[i + 2];
            buffer[i + 1] = buffer[i + 3];
            buffer[i + 2] = temp0;
            buffer[i + 3] = temp1;
        }
    }
    
    const registers = [];
    for (let i = 0; i < 8; i += 2) {
        registers.push(buffer.readUInt16BE(i));
    }
    return registers;
}

// 将 4 个 16 位寄存器值转换为 Float64
function registersToFloat64(registers, endian = 'BE') {
    if (registers.length !== 4) {
        throw new Error('Float64 requires 4 registers');
    }
    
    const buffer = Buffer.allocUnsafe(8);
    for (let i = 0; i < 4; i++) {
        buffer.writeUInt16BE(registers[i], i * 2);
    }
    
    if (endian === 'LE') {
        // 小端：反转字节顺序
        for (let i = 0; i < 4; i++) {
            const temp = buffer[i];
            buffer[i] = buffer[7 - i];
            buffer[7 - i] = temp;
        }
    } else if (endian === 'MLE') {
        // Modbus 中间小端：交换 16 位字对
        for (let i = 0; i < 8; i += 4) {
            const temp0 = buffer[i];
            const temp1 = buffer[i + 1];
            buffer[i] = buffer[i + 2];
            buffer[i + 1] = buffer[i + 3];
            buffer[i + 2] = temp0;
            buffer[i + 3] = temp1;
        }
    }
    
    return buffer.readDoubleBE(0);
}

async function testFloat64() {
    try {
        console.log('=== Float64 类型数据解析测试 ===\n');
        
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
        
        // 测试 Float64 (大端)
        console.log(`[从站 ${slaveId}] 测试 Float64 (大端)`);
        const float64Value = testValues.Float64;
        const float64Registers = float64ToRegisters(float64Value, 'BE');
        console.log(`  写入值: ${float64Value}`);
        console.log(`  寄存器值: [${float64Registers.join(', ')}]`);
        
        await client.writeRegisters(20, float64Registers);
        console.log('  写入成功');
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const float64Read = await client.readHoldingRegisters(20, 4);
        console.log(`  读取原始数据: [${float64Read.data.join(', ')}]`);
        console.log(`  Buffer: ${float64Read.buffer.toString('hex')}`);
        
        const float64Parsed = registersToFloat64(Array.from(float64Read.data), 'BE');
        console.log(`  解析值: ${float64Parsed}`);
        console.log(`  误差: ${Math.abs(float64Value - float64Parsed)}`);
        console.log(`  结果: ${Math.abs(float64Value - float64Parsed) < 1e-10 ? '✓ 通过' : '✗ 失败'}\n`);
        
        // 测试 Float64LE (小端)
        console.log(`[从站 ${slaveId}] 测试 Float64LE (小端)`);
        const float64LEValue = testValues.Float64LE;
        const float64LERegisters = float64ToRegisters(float64LEValue, 'LE');
        console.log(`  写入值: ${float64LEValue}`);
        console.log(`  寄存器值: [${float64LERegisters.join(', ')}]`);
        
        await client.writeRegisters(24, float64LERegisters);
        console.log('  写入成功');
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const float64LERead = await client.readHoldingRegisters(24, 4);
        console.log(`  读取原始数据: [${float64LERead.data.join(', ')}]`);
        console.log(`  Buffer: ${float64LERead.buffer.toString('hex')}`);
        
        const float64LEParsed = registersToFloat64(Array.from(float64LERead.data), 'LE');
        console.log(`  解析值: ${float64LEParsed}`);
        console.log(`  误差: ${Math.abs(float64LEValue - float64LEParsed)}`);
        console.log(`  结果: ${Math.abs(float64LEValue - float64LEParsed) < 1e-10 ? '✓ 通过' : '✗ 失败'}\n`);
        
        // 测试 Float64MLE (Modbus 中间小端)
        console.log(`[从站 ${slaveId}] 测试 Float64MLE (Modbus 中间小端)`);
        const float64MLEValue = testValues.Float64MLE;
        const float64MLERegisters = float64ToRegisters(float64MLEValue, 'MLE');
        console.log(`  写入值: ${float64MLEValue}`);
        console.log(`  寄存器值: [${float64MLERegisters.join(', ')}]`);
        
        await client.writeRegisters(28, float64MLERegisters);
        console.log('  写入成功');
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const float64MLERead = await client.readHoldingRegisters(28, 4);
        console.log(`  读取原始数据: [${float64MLERead.data.join(', ')}]`);
        console.log(`  Buffer: ${float64MLERead.buffer.toString('hex')}`);
        
        const float64MLEParsed = registersToFloat64(Array.from(float64MLERead.data), 'MLE');
        console.log(`  解析值: ${float64MLEParsed}`);
        console.log(`  误差: ${Math.abs(float64MLEValue - float64MLEParsed)}`);
        console.log(`  结果: ${Math.abs(float64MLEValue - float64MLEParsed) < 1e-10 ? '✓ 通过' : '✗ 失败'}\n`);
        
        // 测试零值
        console.log(`[从站 ${slaveId}] 测试零值`);
        const zeroRegisters = [0, 0, 0, 0];
        await client.writeRegisters(32, zeroRegisters);
        console.log('  写入零值成功');
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const zeroRead = await client.readHoldingRegisters(32, 4);
        console.log(`  读取原始数据: [${zeroRead.data.join(', ')}]`);
        console.log(`  Buffer: ${zeroRead.buffer.toString('hex')}`);
        
        const zeroParsed = registersToFloat64([0, 0, 0, 0], 'BE');
        console.log(`  解析值: ${zeroParsed}`);
        console.log(`  结果: ${zeroParsed === 0 ? '✓ 通过' : '✗ 失败'}\n`);
        
        console.log('=== Float64 测试完成 ===');
        
    } catch (err) {
        console.error('测试失败:', err);
    } finally {
        client.close(() => {
            console.log('连接已关闭');
        });
    }
}

testFloat64();
