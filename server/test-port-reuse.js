const FUXA = require('./main');
const fs = require('fs');

// 测试端口复用功能
async function testPortReuse() {
    try {
        console.log('Starting port reuse test...');
        
        // 读取默认项目配置
        const projectConfig = JSON.parse(fs.readFileSync('./project.default.json', 'utf8'));
        
        // 清除现有的设备
        projectConfig.devices = [];
        
        // 添加两个使用同一个串口的 Modbus RTU 设备
        const device1 = {
            "id": "device1",
            "name": "COM20-RTU01",
            "type": "ModbusRTU",
            "enabled": true,
            "polling": 1000,
            "property": {
                "address": "COM20",
                "baudrate": 9600,
                "databits": 8,
                "stopbits": 1,
                "parity": "None",
                "slaveid": 1,
                "connectionOption": "SerialPort",
                "socketReuse": "ReuseSerial"
            },
            "tags": [
                {
                    "id": "tag1",
                    "name": "Test Tag 1",
                    "memaddress": 40001,
                    "address": 1,
                    "type": "INT16",
                    "enabled": true
                }
            ]
        };
        
        const device2 = {
            "id": "device2",
            "name": "COM20-RTU02",
            "type": "ModbusRTU",
            "enabled": true,
            "polling": 1000,
            "property": {
                "address": "COM20",
                "baudrate": 9600,
                "databits": 8,
                "stopbits": 1,
                "parity": "None",
                "slaveid": 2,
                "connectionOption": "SerialPort",
                "socketReuse": "ReuseSerial"
            },
            "tags": [
                {
                    "id": "tag2",
                    "name": "Test Tag 2",
                    "memaddress": 40001,
                    "address": 1,
                    "type": "INT16",
                    "enabled": true
                }
            ]
        };
        
        projectConfig.devices.push(device1);
        projectConfig.devices.push(device2);
        
        // 保存测试配置
        fs.writeFileSync('./test-port-reuse.json', JSON.stringify(projectConfig, null, 2));
        
        console.log('Test configuration created');
        console.log('Device 1: COM20-RTU01 (slave 1)');
        console.log('Device 2: COM20-RTU02 (slave 2)');
        console.log('Both devices are configured to use COM20 with port reuse enabled');
        
        // 启动 FUXA 服务器
        const fuxa = new FUXA();
        await fuxa.init();
        
        console.log('FUXA server started');
        
        // 等待一段时间，让设备连接
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        console.log('Testing port reuse...');
        
        // 检查设备状态
        const devices = fuxa.runtime.devices.getDevices();
        console.log('Device status:');
        devices.forEach(device => {
            console.log(`${device.name}: ${device.isConnected() ? 'Connected' : 'Disconnected'}`);
        });
        
        // 关闭 FUXA 服务器
        await fuxa.stop();
        
        console.log('Port reuse test completed');
        
    } catch (err) {
        console.error('Error during port reuse test:', err);
    }
}

testPortReuse();