/**
 * 多从站 Modbus RTU 服务端
 * 模拟 5 个从站，每个从站有不同的数据值
 */

const ModbusRTU = require('modbus-serial');
const { SerialPort } = require('serialport');

const PORT = 'COM21';
const BAUDRATE = 9600;

// 为每个从站创建数据存储
const slaveData = {};
for (let slaveId = 1; slaveId <= 5; slaveId++) {
    slaveData[slaveId] = {
        coils: [true, false, true, false, true],  // 地址 1-5
        discreteInputs: [false, true, false, true, false],  // 地址 1-5
        inputRegisters: [slaveId * 1000 + 1, slaveId * 1000 + 2, slaveId * 1000 + 3, slaveId * 1000 + 4, slaveId * 1000 + 5],  // 地址 1-5
        holdingRegisters: [
            slaveId * 10 + 1,   // 地址 1: Int16
            slaveId * 10 + 2,   // 地址 2: Int16
            slaveId * 10 + 3,   // 地址 3: Int16
            slaveId * 10 + 4,   // 地址 4: Int16
            slaveId * 10 + 5,   // 地址 5: Int16
            0, 0,               // 地址 6-7: Int32
            0, 0, 0, 0,         // 地址 8-11: Float64 (初始为0)
            0, 0,               // 地址 12-13: UInt32
            0, 0,               // 地址 14-15: Float32
            0, 0, 0, 0,         // 地址 16-19: Int64
            0, 0,               // 地址 20-21: Int16LE
            0, 0,               // 地址 22-23: UInt32LE
            0, 0,               // 地址 24-25: Float32LE
            0, 0, 0, 0,         // 地址 26-29: Float64LE
            0, 0, 0, 0,         // 地址 30-33: Int64LE
            0, 0, 0, 0,         // 地址 34-37: Float64MLE
            0, 0,               // 地址 38-39: Int32MLE
            0, 0,               // 地址 40-41: Float32MLE
            0, 0                // 地址 42-43: UInt32MLE
        ]
    };
}

// 创建串口服务器
const serialPort = new SerialPort({
    path: PORT,
    baudRate: BAUDRATE,
    dataBits: 8,
    stopBits: 1,
    parity: 'none'
});

const server = new ModbusRTU();

// 处理请求
serialPort.on('data', (data) => {
    console.log(`[RX] ${data.toString('hex').match(/.{1,2}/g).join(' ')}`);
    
    // 解析请求
    if (data.length < 4) return;
    
    const slaveId = data[0];
    const functionCode = data[1];
    
    if (!slaveData[slaveId]) {
        console.log(`  从站 ${slaveId} 不存在`);
        return;
    }
    
    const slave = slaveData[slaveId];
    let response;
    
    switch (functionCode) {
        case 0x01: // Read Coils
            {
                const startAddr = data.readUInt16BE(2);
                const quantity = data.readUInt16BE(4);
                console.log(`  从站 ${slaveId} 读取 Coil 地址 ${startAddr+1}-${startAddr+quantity}`);
                
                const values = [];
                for (let i = 0; i < quantity; i++) {
                    values.push(slave.coils[startAddr + i] || false);
                }
                
                const byteCount = Math.ceil(quantity / 8);
                const coilData = Buffer.alloc(byteCount);
                for (let i = 0; i < quantity; i++) {
                    if (values[i]) {
                        coilData[Math.floor(i / 8)] |= (1 << (i % 8));
                    }
                }
                
                response = Buffer.concat([
                    Buffer.from([slaveId, functionCode, byteCount]),
                    coilData
                ]);
            }
            break;
            
        case 0x02: // Read Discrete Inputs
            {
                const startAddr = data.readUInt16BE(2);
                const quantity = data.readUInt16BE(4);
                console.log(`  从站 ${slaveId} 读取 Input 地址 ${startAddr+1}-${startAddr+quantity}`);
                
                const values = [];
                for (let i = 0; i < quantity; i++) {
                    values.push(slave.discreteInputs[startAddr + i] || false);
                }
                
                const byteCount = Math.ceil(quantity / 8);
                const inputData = Buffer.alloc(byteCount);
                for (let i = 0; i < quantity; i++) {
                    if (values[i]) {
                        inputData[Math.floor(i / 8)] |= (1 << (i % 8));
                    }
                }
                
                response = Buffer.concat([
                    Buffer.from([slaveId, functionCode, byteCount]),
                    inputData
                ]);
            }
            break;
            
        case 0x03: // Read Holding Registers
            {
                const startAddr = data.readUInt16BE(2);
                const quantity = data.readUInt16BE(4);
                console.log(`  从站 ${slaveId} 读取 Holding Register 地址 ${startAddr+1}-${startAddr+quantity}`);
                
                const registerData = Buffer.alloc(quantity * 2);
                for (let i = 0; i < quantity; i++) {
                    registerData.writeUInt16BE(slave.holdingRegisters[startAddr + i] || 0, i * 2);
                }
                
                response = Buffer.concat([
                    Buffer.from([slaveId, functionCode, quantity * 2]),
                    registerData
                ]);
            }
            break;
            
        case 0x04: // Read Input Registers
            {
                const startAddr = data.readUInt16BE(2);
                const quantity = data.readUInt16BE(4);
                console.log(`  从站 ${slaveId} 读取 Input Register 地址 ${startAddr+1}-${startAddr+quantity}`);
                
                const registerData = Buffer.alloc(quantity * 2);
                for (let i = 0; i < quantity; i++) {
                    registerData.writeUInt16BE(slave.inputRegisters[startAddr + i] || 0, i * 2);
                }
                
                response = Buffer.concat([
                    Buffer.from([slaveId, functionCode, quantity * 2]),
                    registerData
                ]);
            }
            break;
            
        case 0x05: // Write Single Coil
            {
                const addr = data.readUInt16BE(2);
                const value = data.readUInt16BE(4);
                console.log(`  从站 ${slaveId} 写入 Coil 地址 ${addr+1} = ${value === 0xFF00}`);
                slave.coils[addr] = (value === 0xFF00);
                response = data; // Echo back
            }
            break;
            
        case 0x06: // Write Single Register
            {
                const addr = data.readUInt16BE(2);
                const value = data.readUInt16BE(4);
                console.log(`  从站 ${slaveId} 写入 Holding Register 地址 ${addr+1} = ${value}`);
                slave.holdingRegisters[addr] = value;
                response = data; // Echo back
            }
            break;
            
        case 0x0F: // Write Multiple Coils
            {
                const startAddr = data.readUInt16BE(2);
                const quantity = data.readUInt16BE(4);
                const byteCount = data[6];
                console.log(`  从站 ${slaveId} 写入多个 Coil 地址 ${startAddr+1}-${startAddr+quantity}`);
                
                for (let i = 0; i < quantity; i++) {
                    const byteIndex = Math.floor(i / 8);
                    const bitIndex = i % 8;
                    slave.coils[startAddr + i] = (data[7 + byteIndex] & (1 << bitIndex)) !== 0;
                }
                
                response = Buffer.concat([
                    Buffer.from([slaveId, functionCode]),
                    data.slice(2, 6)
                ]);
            }
            break;
            
        case 0x10: // Write Multiple Registers
            {
                const startAddr = data.readUInt16BE(2);
                const quantity = data.readUInt16BE(4);
                console.log(`  从站 ${slaveId} 写入多个 Holding Register 地址 ${startAddr+1}-${startAddr+quantity}`);
                
                for (let i = 0; i < quantity; i++) {
                    slave.holdingRegisters[startAddr + i] = data.readUInt16BE(7 + i * 2);
                }
                
                response = Buffer.concat([
                    Buffer.from([slaveId, functionCode]),
                    data.slice(2, 6)
                ]);
            }
            break;
            
        default:
            console.log(`  从站 ${slaveId} 未知功能码: ${functionCode}`);
            return;
    }
    
    // 计算 CRC
    const crc = calculateCRC(response);
    const responseWithCRC = Buffer.concat([response, crc]);
    
    console.log(`[TX] ${responseWithCRC.toString('hex').match(/.{1,2}/g).join(' ')}\n`);
    serialPort.write(responseWithCRC);
});

// CRC 计算
function calculateCRC(buffer) {
    let crc = 0xFFFF;
    for (let i = 0; i < buffer.length; i++) {
        crc ^= buffer[i];
        for (let j = 0; j < 8; j++) {
            if (crc & 0x0001) {
                crc = (crc >> 1) ^ 0xA001;
            } else {
                crc = crc >> 1;
            }
        }
    }
    return Buffer.from([crc & 0xFF, (crc >> 8) & 0xFF]);
}

console.log(`╔════════════════════════════════════════════════════════════╗`);
console.log(`║     多从站 Modbus RTU 服务端                               ║`);
console.log(`║     端口: ${PORT}                                          ║`);
console.log(`║     从站: 1-5                                              ║`);
console.log(`╚════════════════════════════════════════════════════════════╝\n`);

console.log('等待连接...\n');

// 优雅退出
process.on('SIGINT', () => {
    console.log('\n关闭服务器...');
    serialPort.close();
    process.exit(0);
});
