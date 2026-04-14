const ModbusRTU = require('modbus-serial');

// 创建一个 Modbus RTU 客户端
const client = new ModbusRTU();

// 连接到 COM20 端口
client.connectRTU('COM20', {
    baudRate: 9600,
    parity: 'none',
    dataBits: 8,
    stopBits: 1
})
.then(() => {
    console.log('Connected to COM20');
    // 测试读取从站 1-5 的地址 1 的值
    testReadMultipleSlaves();
})
.catch((err) => {
    console.error('Error connecting to COM20:', err);
});

// 测试读取多个从站的数据
async function testReadMultipleSlaves() {
    try {
        for (let slaveId = 1; slaveId <= 5; slaveId++) {
            // 设置从站 ID
            client.setID(slaveId);
            
            // 等待从站 ID 设置生效
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // 读取保持寄存器（地址 1）
            const res = await client.readHoldingRegisters(0, 1); // 地址从 0 开始
            console.log(`Slave ${slaveId}: ${res.data[0]}`);
            
            // 等待一段时间，确保通信完成
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // 关闭连接
        client.close();
        console.log('Test completed');
    } catch (err) {
        console.error('Error reading from slaves:', err);
        client.close();
    }
}