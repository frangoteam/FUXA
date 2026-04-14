const ModbusRTU = require('modbus-serial');

// 创建一个Modbus客户端实例
const client = new ModbusRTU();

// 配置串口参数
const serialPort = 'COM20';
const baudRate = 9600;

// 测试数据类型
const dataTypes = [
    { name: 'Int16', value: 12345 },
    { name: 'Int32', value: 123456789 },
    { name: 'Uint32', value: 4294967295 },
    { name: 'Float32', value: 123.456 },
    { name: 'Float64', value: 123456.789012345 },
    { name: 'Int64', value: 9223372036854775807 }
];

async function testDataType(slaveId, dataType, value, address) {
    try {
        // 设置从站ID
        client.setID(slaveId);
        console.log(`Testing ${dataType.name} on slave ${slaveId}, address ${address}`);
        
        // 写入值
        if (dataType.name === 'Int16') {
            await client.writeRegister(address, value);
        } else if (dataType.name === 'Int32' || dataType.name === 'Uint32' || dataType.name === 'Float32') {
            // 这些类型需要两个寄存器
            const buffer = Buffer.alloc(4);
            if (dataType.name === 'Int32') {
                buffer.writeInt32BE(value, 0);
            } else if (dataType.name === 'Uint32') {
                buffer.writeUInt32BE(value, 0);
            } else if (dataType.name === 'Float32') {
                buffer.writeFloatBE(value, 0);
            }
            const register1 = buffer.readUInt16BE(0);
            const register2 = buffer.readUInt16BE(2);
            await client.writeRegisters(address, [register1, register2]);
        } else if (dataType.name === 'Float64' || dataType.name === 'Int64') {
            // 这些类型需要四个寄存器
            const buffer = Buffer.alloc(8);
            if (dataType.name === 'Float64') {
                buffer.writeDoubleBE(value, 0);
            } else if (dataType.name === 'Int64') {
                buffer.writeBigInt64BE(BigInt(value), 0);
            }
            const registers = [
                buffer.readUInt16BE(0),
                buffer.readUInt16BE(2),
                buffer.readUInt16BE(4),
                buffer.readUInt16BE(6)
            ];
            await client.writeRegisters(address, registers);
        }
        
        console.log(`Successfully wrote ${value} (${dataType.name}) to slave ${slaveId}, address ${address}`);
        
        // 读取值
        let readValue;
        if (dataType.name === 'Int16') {
            const res = await client.readHoldingRegisters(address, 1);
            readValue = res.data[0];
        } else if (dataType.name === 'Int32' || dataType.name === 'Uint32' || dataType.name === 'Float32') {
            const res = await client.readHoldingRegisters(address, 2);
            const buffer = Buffer.alloc(4);
            buffer.writeUInt16BE(res.data[0], 0);
            buffer.writeUInt16BE(res.data[1], 2);
            if (dataType.name === 'Int32') {
                readValue = buffer.readInt32BE(0);
            } else if (dataType.name === 'Uint32') {
                readValue = buffer.readUInt32BE(0);
            } else if (dataType.name === 'Float32') {
                readValue = buffer.readFloatBE(0);
            }
        } else if (dataType.name === 'Float64' || dataType.name === 'Int64') {
            const res = await client.readHoldingRegisters(address, 4);
            const buffer = Buffer.alloc(8);
            buffer.writeUInt16BE(res.data[0], 0);
            buffer.writeUInt16BE(res.data[1], 2);
            buffer.writeUInt16BE(res.data[2], 4);
            buffer.writeUInt16BE(res.data[3], 6);
            if (dataType.name === 'Float64') {
                readValue = buffer.readDoubleBE(0);
            } else if (dataType.name === 'Int64') {
                readValue = buffer.readBigInt64BE(0).toString();
            }
        }
        
        console.log(`Verified: ${readValue} (${dataType.name}) from slave ${slaveId}, address ${address}`);
        
        // 等待一段时间，确保前一个操作完成
        await new Promise(resolve => setTimeout(resolve, 100));
        
        return true;
    } catch (err) {
        console.error(`Error testing ${dataType.name} on slave ${slaveId}:`, err);
        return false;
    }
}

async function testAllDataTypes() {
    try {
        // 连接到串口
        await client.connectRTU(serialPort, {
            baudRate: baudRate,
            dataBits: 8,
            stopBits: 1,
            parity: 'none'
        });
        
        console.log('Connected to', serialPort);
        
        // 测试每个从站的不同数据类型
        for (let slaveId = 1; slaveId <= 5; slaveId++) {
            console.log(`\nTesting slave ${slaveId}:`);
            
            let address = 0; // 从地址0开始
            for (const dataType of dataTypes) {
                // 为每种数据类型测试10个变量
                for (let i = 0; i < 10; i++) {
                    const value = dataType.value + i; // 每个变量使用不同的值
                    await testDataType(slaveId, dataType, value, address);
                    
                    // 根据数据类型增加地址
                    if (dataType.name === 'Int16') {
                        address += 1;
                    } else if (dataType.name === 'Int32' || dataType.name === 'Uint32' || dataType.name === 'Float32') {
                        address += 2;
                    } else if (dataType.name === 'Float64' || dataType.name === 'Int64') {
                        address += 4;
                    }
                }
            }
        }
        
        // 关闭连接
        client.close();
        console.log('\nConnection closed');
    } catch (err) {
        console.error('Error connecting to serial port:', err);
        client.close();
    }
}

// 运行测试
testAllDataTypes();