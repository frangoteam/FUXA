/**
 * 模拟 FUXA 实际运行 - 测试 Coil 和 Float64 类型
 */

const ModbusRTU = require('modbus-serial');
const client = new ModbusRTU();

const PORT = 'COM20';
const BAUDRATE = 9600;

// 模拟 datatypes
const datatypes = {
    Bool: {
        bytes: 1,
        parser: (buffer, offset = 0, bit = 0) => +buffer.readUInt8(offset) >> bit & 1 === 1,
        formatter: v => (v === '1' || v === 1 || v === true) ? 1 : 0,
        WordLen: 1
    },
    Float64: {
        bytes: 8,
        parser: (buffer) => buffer.readDoubleBE(0),
        formatter: (v) => {
            const b = Buffer.allocUnsafe(8);
            b.writeDoubleBE(v);
            return b;
        },
        WordLen: 4
    }
};

// 模拟 _readMemory 函数的逻辑
async function readMemoryTest(memoryAddress, start, size, vars, slaveId) {
    console.log(`读取内存: ${memoryAddress}, start: ${start}, size: ${size}, slave: ${slaveId}`);
    
    client.setID(slaveId);
    
    let res;
    if (memoryAddress === 0) { // CoilStatus
        res = await client.readCoils(start, size);
    } else if (memoryAddress === 100000) { // DigitalInputs
        res = await client.readDiscreteInputs(start, size);
    } else if (memoryAddress === 400000) { // HoldingRegisters
        res = await client.readHoldingRegisters(start, size);
    }
    
    console.log('  原始结果:', res);
    
    // 处理结果
    let buffer;
    if (res.buffer) {
        buffer = res.buffer;
    } else if (res.data && res.data.buffer) {
        buffer = Buffer.from(res.data.buffer);
    } else if (res.data) {
        buffer = Buffer.alloc(res.data.length * 2);
        for (let i = 0; i < res.data.length; i++) {
            buffer.writeUInt16BE(res.data[i], i * 2);
        }
    }
    
    console.log('  生成的 buffer:', buffer ? buffer.toString('hex') : 'null');
    
    // 解析每个变量
    vars.forEach(v => {
        try {
            if (memoryAddress === 0 || memoryAddress === 100000) {
                // Coil 或 Digital Inputs
                if (res.data && Array.isArray(res.data) && typeof res.data[0] === 'boolean') {
                    let bitIndex = v.offset - start;
                    console.log(`  变量 ${v.name}: bitIndex=${bitIndex}, data[bitIndex]=${res.data[bitIndex]}`);
                    let value = false;
                    if (bitIndex >= 0 && bitIndex < res.data.length) {
                        value = res.data[bitIndex] || false;
                    }
                    v.rawValue = value;
                    console.log(`  变量 ${v.name}: rawValue=${v.rawValue}`);
                } else {
                    // 使用 buffer 解析
                    let bitoffset = Math.trunc((v.offset - start) / 8);
                    let bit = (v.offset - start) % 8;
                    let value = datatypes.Bool.parser(buffer, bitoffset, bit);
                    v.rawValue = value;
                    console.log(`  变量 ${v.name}: bitoffset=${bitoffset}, bit=${bit}, rawValue=${v.rawValue}`);
                }
            } else {
                // Holding Registers
                let byteoffset = (v.offset - start) * 2;
                let dataBuffer = Buffer.from(buffer.slice(byteoffset, byteoffset + datatypes[v.type].bytes));
                let value = datatypes[v.type].parser(dataBuffer);
                v.rawValue = value;
                console.log(`  变量 ${v.name}: byteoffset=${byteoffset}, bytes=${datatypes[v.type].bytes}, buffer=${dataBuffer.toString('hex')}, rawValue=${v.rawValue}`);
            }
        } catch (err) {
            console.error(`  解析变量 ${v.name} 出错:`, err);
        }
    });
    
    return vars;
}

async function testSimulation() {
    try {
        console.log('=== FUXA 模拟测试 ===\n');
        
        // 连接串口
        await client.connectRTU(PORT, {
            baudRate: BAUDRATE,
            dataBits: 8,
            stopBits: 1,
            parity: 'none'
        });
        console.log(`已连接到 ${PORT}\n`);
        
        const slaveId = 1;
        
        // 测试 1: Coil Status
        console.log('--- 测试 Coil Status ---');
        const coilVars = [
            { name: 'Coil_1.1', offset: 0, type: 'Bool', rawValue: null },
            { name: 'Coil_1.2', offset: 1, type: 'Bool', rawValue: null },
            { name: 'Coil_1.3', offset: 2, type: 'Bool', rawValue: null }
        ];
        await readMemoryTest(0, 0, 5, coilVars, slaveId);
        console.log();
        
        // 测试 2: Digital Inputs
        console.log('--- 测试 Digital Inputs ---');
        const inputVars = [
            { name: 'Input_1.1', offset: 0, type: 'Bool', rawValue: null },
            { name: 'Input_1.2', offset: 1, type: 'Bool', rawValue: null }
        ];
        await readMemoryTest(100000, 0, 5, inputVars, slaveId);
        console.log();
        
        // 测试 3: Float64 (地址 8)
        console.log('--- 测试 Float64 (地址 8) ---');
        const float64Vars = [
            { name: 'Float64_1.8', offset: 7, type: 'Float64', rawValue: null }  // 地址 8 = offset 7
        ];
        await readMemoryTest(400000, 0, 40, float64Vars, slaveId);
        console.log();
        
        // 测试 4: 写入 Float64 并读取
        console.log('--- 写入并验证 Float64 ---');
        const testValue = 3.141592653589793;
        const writeBuffer = Buffer.allocUnsafe(8);
        writeBuffer.writeDoubleBE(testValue, 0);
        const registers = [];
        for (let i = 0; i < 8; i += 2) {
            registers.push(writeBuffer.readUInt16BE(i));
        }
        console.log(`写入值: ${testValue}`);
        console.log(`寄存器值: ${JSON.stringify(registers)}`);
        
        client.setID(slaveId);
        await client.writeRegisters(7, registers);
        console.log('写入成功');
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const verifyVars = [
            { name: 'Float64_1.8', offset: 7, type: 'Float64', rawValue: null }
        ];
        await readMemoryTest(400000, 0, 40, verifyVars, slaveId);
        console.log();
        
        console.log('=== 测试完成 ===');
        
    } catch (err) {
        console.error('测试失败:', err);
    } finally {
        client.close(() => {
            console.log('连接已关闭');
        });
    }
}

testSimulation();
