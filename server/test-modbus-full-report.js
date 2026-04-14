const ModbusRTU = require('modbus-serial');

// 创建一个Modbus客户端实例
const client = new ModbusRTU();

// 配置串口参数
const serialPort = 'COM20';
const baudRate = 9600;

// 测试数据类型 - 使用合适的测试值，避免超出范围
const dataTypes = [
    { name: 'Int16',    bytes: 2, testValue: 12345, min: -32768, max: 32767 },
    { name: 'Int32',    bytes: 4, testValue: 123456789, min: -2147483648, max: 2147483647 },
    { name: 'UInt32',   bytes: 4, testValue: 4000000000, min: 0, max: 4294967295 },
    { name: 'Float32',  bytes: 4, testValue: 123.456 },
    { name: 'Float64',  bytes: 8, testValue: 123456.789012345 },
    { name: 'Int64',    bytes: 8, testValue: 1000000000000n },
    { name: 'Int16LE',  bytes: 2, testValue: 12345, min: -32768, max: 32767 },
    { name: 'UInt32LE', bytes: 4, testValue: 4000000000, min: 0, max: 4294967295 },
    { name: 'Float32LE',bytes: 4, testValue: 123.456 },
    { name: 'Float64LE',bytes: 8, testValue: 123456.789012345 },
    { name: 'Int64LE',  bytes: 8, testValue: 1000000000000n },
    { name: 'Float64MLE',bytes: 8, testValue: 123456.789012345 },
    { name: 'Int32MLE', bytes: 4, testValue: 123456789, min: -2147483648, max: 2147483647 },
    { name: 'Float32MLE',bytes: 4, testValue: 123.456 },
    { name: 'UInt32MLE',bytes: 4, testValue: 4000000000, min: 0, max: 4294967295 }
];

// 测试结果统计
const testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    details: []
};

function getSafeTestValue(dataType, address) {
    // 根据地址生成不同的测试值，但要确保在有效范围内
    let baseValue = dataType.testValue;
    
    if (dataType.name === 'Int64' || dataType.name === 'Int64LE') {
        // Int64 使用 BigInt
        return baseValue + BigInt(address * 100);
    } else if (dataType.name.includes('Float')) {
        // 浮点数添加地址偏移
        return baseValue + address;
    } else {
        // 整数类型，确保在范围内
        let offset = address * 100;
        let result = baseValue + offset;
        
        // 检查范围
        if (dataType.min !== undefined && dataType.max !== undefined) {
            if (result > dataType.max) {
                result = dataType.max - 1000 + address;
            } else if (result < dataType.min) {
                result = dataType.min + 1000 + address;
            }
        }
        
        return result;
    }
}

function writeValueToBuffer(buffer, value, dataType, offset = 0) {
    switch(dataType) {
        case 'Int16':    buffer.writeInt16BE(value, offset); break;
        case 'Int32':    buffer.writeInt32BE(value, offset); break;
        case 'UInt32':   buffer.writeUInt32BE(value, offset); break;
        case 'Float32':  buffer.writeFloatBE(value, offset); break;
        case 'Float64':  buffer.writeDoubleBE(value, offset); break;
        case 'Int64':    buffer.writeBigInt64BE(BigInt(value), offset); break;
        case 'Int16LE':  buffer.writeInt16LE(value, offset); break;
        case 'UInt32LE': buffer.writeUInt32LE(value, offset); break;
        case 'Float32LE':buffer.writeFloatLE(value, offset); break;
        case 'Float64LE':buffer.writeDoubleLE(value, offset); break;
        case 'Int64LE':  buffer.writeBigInt64LE(BigInt(value), offset); break;
        // MLE (Mid-Little Endian) - Modbus特殊字节序
        case 'Float64MLE':
        case 'Int32MLE':
        case 'Float32MLE':
        case 'UInt32MLE':
            // MLE: 寄存器内大端，寄存器间小端
            const tempBuf = Buffer.alloc(dataType === 'Float64MLE' ? 8 : 4);
            if (dataType === 'Float64MLE') tempBuf.writeDoubleBE(value, 0);
            else if (dataType === 'Int32MLE') tempBuf.writeInt32BE(value, 0);
            else if (dataType === 'Float32MLE') tempBuf.writeFloatBE(value, 0);
            else if (dataType === 'UInt32MLE') tempBuf.writeUInt32BE(value, 0);
            // 交换寄存器顺序
            if (dataType === 'Float64MLE') {
                buffer[offset] = tempBuf[6]; buffer[offset+1] = tempBuf[7];
                buffer[offset+2] = tempBuf[4]; buffer[offset+3] = tempBuf[5];
                buffer[offset+4] = tempBuf[2]; buffer[offset+5] = tempBuf[3];
                buffer[offset+6] = tempBuf[0]; buffer[offset+7] = tempBuf[1];
            } else {
                buffer[offset] = tempBuf[2]; buffer[offset+1] = tempBuf[3];
                buffer[offset+2] = tempBuf[0]; buffer[offset+3] = tempBuf[1];
            }
            break;
        default: throw new Error(`Unknown data type: ${dataType}`);
    }
}

function readValueFromBuffer(buffer, dataType, offset = 0) {
    switch(dataType) {
        case 'Int16':    return buffer.readInt16BE(offset);
        case 'Int32':    return buffer.readInt32BE(offset);
        case 'UInt32':   return buffer.readUInt32BE(offset);
        case 'Float32':  return buffer.readFloatBE(offset);
        case 'Float64':  return buffer.readDoubleBE(offset);
        case 'Int64':    return buffer.readBigInt64BE(offset);
        case 'Int16LE':  return buffer.readInt16LE(offset);
        case 'UInt32LE': return buffer.readUInt32LE(offset);
        case 'Float32LE':return buffer.readFloatLE(offset);
        case 'Float64LE':return buffer.readDoubleLE(offset);
        case 'Int64LE':  return buffer.readBigInt64LE(offset);
        case 'Float64MLE':
        case 'Int32MLE':
        case 'Float32MLE':
        case 'UInt32MLE':
            const tempBuf = Buffer.alloc(dataType === 'Float64MLE' ? 8 : 4);
            if (dataType === 'Float64MLE') {
                tempBuf[6] = buffer[offset]; tempBuf[7] = buffer[offset+1];
                tempBuf[4] = buffer[offset+2]; tempBuf[5] = buffer[offset+3];
                tempBuf[2] = buffer[offset+4]; tempBuf[3] = buffer[offset+5];
                tempBuf[0] = buffer[offset+6]; tempBuf[1] = buffer[offset+7];
                return tempBuf.readDoubleBE(0);
            } else {
                tempBuf[2] = buffer[offset]; tempBuf[3] = buffer[offset+1];
                tempBuf[0] = buffer[offset+2]; tempBuf[1] = buffer[offset+3];
                if (dataType === 'Int32MLE') return tempBuf.readInt32BE(0);
                if (dataType === 'Float32MLE') return tempBuf.readFloatBE(0);
                if (dataType === 'UInt32MLE') return tempBuf.readUInt32BE(0);
            }
        default: throw new Error(`Unknown data type: ${dataType}`);
    }
}

async function testDataType(slaveId, dataType, address) {
    const testId = `Slave${slaveId}_${dataType.name}_Addr${address}`;
    const result = {
        testId: testId,
        slaveId: slaveId,
        dataType: dataType.name,
        address: address,
        writeValue: null,
        readValue: null,
        writeSuccess: false,
        readSuccess: false,
        valueMatch: false,
        error: null
    };
    
    try {
        // 设置从站ID
        client.setID(slaveId);
        
        // 生成安全的测试值
        let testValue = getSafeTestValue(dataType, address);
        result.writeValue = testValue.toString();
        
        console.log(`[${testId}] Writing: ${testValue} (${dataType.name})`);
        
        // 写入值
        if (dataType.bytes === 2) {
            // Int16, Int16LE
            const buffer = Buffer.alloc(2);
            writeValueToBuffer(buffer, testValue, dataType.name);
            await client.writeRegister(address, buffer.readUInt16BE(0));
        } else if (dataType.bytes === 4) {
            // Int32, UInt32, Float32, Int32LE, UInt32LE, Float32LE, Int32MLE, Float32MLE, UInt32MLE
            const buffer = Buffer.alloc(4);
            writeValueToBuffer(buffer, testValue, dataType.name);
            const reg1 = buffer.readUInt16BE(0);
            const reg2 = buffer.readUInt16BE(2);
            await client.writeRegisters(address, [reg1, reg2]);
        } else if (dataType.bytes === 8) {
            // Float64, Int64, Float64LE, Int64LE, Float64MLE
            const buffer = Buffer.alloc(8);
            writeValueToBuffer(buffer, testValue, dataType.name);
            const regs = [
                buffer.readUInt16BE(0),
                buffer.readUInt16BE(2),
                buffer.readUInt16BE(4),
                buffer.readUInt16BE(6)
            ];
            await client.writeRegisters(address, regs);
        }
        
        result.writeSuccess = true;
        console.log(`[${testId}] Write: SUCCESS`);
        
        // 等待一小段时间
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 读取值
        const registerCount = dataType.bytes / 2;
        const res = await client.readHoldingRegisters(address, registerCount);
        
        // 将读取的寄存器值转换为Buffer
        const readBuffer = Buffer.alloc(dataType.bytes);
        for (let i = 0; i < registerCount; i++) {
            readBuffer.writeUInt16BE(res.data[i], i * 2);
        }
        
        // 解析读取的值
        const readValue = readValueFromBuffer(readBuffer, dataType.name);
        result.readValue = readValue.toString();
        result.readSuccess = true;
        
        // 比较写入值和读取值
        let valuesMatch = false;
        if (typeof testValue === 'bigint') {
            valuesMatch = BigInt(readValue) === testValue;
        } else if (dataType.name.includes('Float')) {
            // 浮点数使用近似比较
            valuesMatch = Math.abs(parseFloat(readValue) - Number(testValue)) < 0.001;
        } else {
            valuesMatch = parseInt(readValue) === Number(testValue);
        }
        result.valueMatch = valuesMatch;
        
        if (valuesMatch) {
            console.log(`[${testId}] Read: SUCCESS (Value: ${readValue})`);
        } else {
            console.log(`[${testId}] Read: MISMATCH (Expected: ${testValue}, Got: ${readValue})`);
        }
        
        testResults.passed++;
        
    } catch (err) {
        result.error = err.message;
        console.log(`[${testId}] FAILED: ${err.message}`);
        testResults.failed++;
    }
    
    testResults.total++;
    testResults.details.push(result);
    
    // 等待一小段时间，确保前一个操作完成
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return result;
}

async function generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('MODBUS RTU 多从站数据类型测试报告');
    console.log('='.repeat(80));
    console.log(`测试时间: ${new Date().toLocaleString()}`);
    console.log(`串口: ${serialPort}, 波特率: ${baudRate}`);
    console.log('-'.repeat(80));
    
    // 统计信息
    console.log('\n【统计信息】');
    console.log(`总测试数: ${testResults.total}`);
    console.log(`通过: ${testResults.passed}`);
    console.log(`失败: ${testResults.failed}`);
    console.log(`成功率: ${((testResults.passed / testResults.total) * 100).toFixed(2)}%`);
    
    // 按从站统计
    console.log('\n【按从站统计】');
    for (let slaveId = 1; slaveId <= 5; slaveId++) {
        const slaveTests = testResults.details.filter(r => r.slaveId === slaveId);
        const slavePassed = slaveTests.filter(r => r.valueMatch).length;
        console.log(`从站 ${slaveId}: ${slavePassed}/${slaveTests.length} 通过`);
    }
    
    // 按数据类型统计
    console.log('\n【按数据类型统计】');
    const typeStats = {};
    for (const result of testResults.details) {
        if (!typeStats[result.dataType]) {
            typeStats[result.dataType] = { total: 0, passed: 0 };
        }
        typeStats[result.dataType].total++;
        if (result.valueMatch) {
            typeStats[result.dataType].passed++;
        }
    }
    for (const [type, stats] of Object.entries(typeStats)) {
        const status = stats.passed === stats.total ? '✅' : '❌';
        console.log(`${status} ${type}: ${stats.passed}/${stats.total} 通过`);
    }
    
    // 失败详情
    const failedTests = testResults.details.filter(r => !r.valueMatch || r.error);
    if (failedTests.length > 0) {
        console.log('\n【失败详情】');
        for (const test of failedTests) {
            console.log(`\n${test.testId}:`);
            console.log(`  写入值: ${test.writeValue}`);
            console.log(`  读取值: ${test.readValue || 'N/A'}`);
            console.log(`  写入成功: ${test.writeSuccess}`);
            console.log(`  读取成功: ${test.readSuccess}`);
            console.log(`  值匹配: ${test.valueMatch}`);
            if (test.error) console.log(`  错误: ${test.error}`);
        }
    }
    
    console.log('\n' + '='.repeat(80));
}

async function runFullTest() {
    try {
        // 连接到串口
        await client.connectRTU(serialPort, {
            baudRate: baudRate,
            dataBits: 8,
            stopBits: 1,
            parity: 'none'
        });
        
        console.log('Connected to', serialPort);
        console.log('\n开始测试...\n');
        
        // 为每个从站测试所有数据类型
        for (let slaveId = 1; slaveId <= 5; slaveId++) {
            console.log(`\n========== 测试从站 ${slaveId} ==========`);
            
            let address = 0;
            for (const dataType of dataTypes) {
                await testDataType(slaveId, dataType, address);
                address += dataType.bytes / 2;
            }
        }
        
        // 关闭连接
        client.close();
        
        // 生成测试报告
        await generateReport();
        
    } catch (err) {
        console.error('Error:', err);
        client.close();
    }
}

// 运行测试
runFullTest();
