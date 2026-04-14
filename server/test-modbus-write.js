const ModbusRTU = require('modbus-serial');

// 创建一个Modbus客户端实例
const client = new ModbusRTU();

// 配置串口参数
const serialPort = 'COM20';
const baudRate = 9600;

async function testWrite() {
    try {
        // 连接到串口
        await client.connectRTU(serialPort, {
            baudRate: baudRate,
            dataBits: 8,
            stopBits: 1,
            parity: 'none'
        });
        
        console.log('Connected to', serialPort);
        
        // 测试写入值到不同的从站
        for (let slaveId = 1; slaveId <= 5; slaveId++) {
            try {
                // 设置从站ID
                client.setID(slaveId);
                console.log(`Setting slave ID to: ${slaveId}`);
                
                // 写入值到地址1（偏移量0）
                const value = slaveId * 10; // 写入10, 20, 30, 40, 50到从站1-5
                await client.writeRegister(0, value);
                console.log(`Successfully wrote ${value} to slave ${slaveId}, address 1`);
                
                // 验证写入是否成功
                const readRes = await client.readHoldingRegisters(0, 1);
                console.log(`Verified: slave ${slaveId}, address 1 = ${readRes.data[0]}`);
                
                // 等待一段时间，确保前一个操作完成
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (err) {
                console.error(`Error writing to slave ${slaveId}:`, err);
            }
        }
        
        // 关闭连接
        client.close();
        console.log('Connection closed');
    } catch (err) {
        console.error('Error connecting to serial port:', err);
        client.close();
    }
}

// 运行测试
testWrite();