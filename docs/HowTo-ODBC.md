To get started with ODBC it is recommended to use the Docker version as the ODBC drivers are pre installed and ready to go. 

**Installing ODBC Drivers**

The available drivers that can be used and there defined name can be found here: [ODBC Driver ini](https://github.com/frangoteam/FUXA/blob/master/odbc/odbcinst.ini)

If you install via NPM on a Debian based Linux system you can try manually install ODBC drivers for your system with the following steps:


**1:** `sudo apt-get update && sudo apt-get install -y unixodbc unixodbc-dev` 

**2:** copy both files from here onto your system [ODBC Driver Files](https://github.com/frangoteam/FUXA/tree/master/odbc)

**3:** Go to the directory of the downloaded files and make script executable and install and most ini file
```
sudo chmod +x install_odbc_drivers.sh
sudo ./install_odbc_drivers.sh
sudo cp odbcinst.ini /etc/odbcinst.ini
```
**4:** Test the installed drivers and you can connect using unixODBC change the connection string to suit your DB

`sudo myodbc-installer -s -a -c2 -n "test" -t "DRIVER=MySQL;SERVER=YourIP;PORT=3306;DATABASE=testDB;UID=User;PWD=MyPass"`

`sudo isql test`

**How to use ODBC**

First you need to create a connection to your DB by adding a Device in Fuxa and select ODBC

If you are using a defined DSN you can enter that, or just add the complete connection string in the same field as seen below

![image](https://github.com/user-attachments/assets/aacaae07-eb2f-4e78-878e-eaa9fa66bb43)

Here are some connection strings for different DBs

`DRIVER=PostgreSQL;SERVER=Your_DB_IP;PORT=5432;DATABASE=testDB`

`DRIVER=MySQL;SERVER=Your_DB_IP;PORT=3306;DATABASE=testDB;SSLMODE=DISABLED`

MySQL can cause connection issues due to SSLMODE, so please try with out SSLMODE in the connection string and try enabled and disabled.
`SSLMODE=ENABLE`
`SSLMODE=DISABLED`

Replace testDB with your actual DB name

Create a Server Side Script to test, you can use the test tab and console there to display the result

First you need to get ODBC connection via devices, in the example it's named postgreSQL as you can see in the above pic
```
// Initialize the device, sane name as connection
let myDevice = await $getDevice('postgreSQL', true);
```
Read data from the DB
```
let result = await myDevice.pool.query(`SELECT * FROM "testTable"`);
console.log(JSON.stringify(result));
```

**Some important notes:** 

Depending on your database you may need to remove the quotes `"testTable"` to `testTable` or add the schema `"DB_Schema"."testTable"`

If you need to use ODBC in another script you cannot use the same connection name: 

Script 1 `let myDevice1 = await $getDevice('postgreSQL', true);`

Script 2 `let myDevice2 = await $getDevice('postgreSQL', true);`

**Full Example**

This example also polls Tags every 100ms and uses a trigger to execute the SQL Query, please be carful you do not overload your system using this method, in the future the ideal solution would be creating an event listener for the tags and we can use a simple addEventListener method and no need to poll

There is also a 1sec loop that updates values from the DB and pushes them to the Table in Fuxa UI 

There is a function called query manager and this handles the trigger and the one shot of the execution 

Note: you may have to restart Fuxa for this to work correctly and each time you modify the script, sometimes it's fine if you modify the script other times it requires a restart, so if you have any weird issues try a restart before creating an issue

Create a Server Side Script and set it to on startup

```
// Query Manager, function to provide one shot based on trigger event
async function createQueryManager(device) {
    let lastTriggerState = false;
    return async function(trigger, sqlQuery) {
        if (trigger && trigger !== lastTriggerState) {
            try {
                const result = await device.pool.query(sqlQuery);
                lastTriggerState = trigger;
                return result;
            } catch (error) {
                return 'Error executing query';
            }
        }
        lastTriggerState = trigger;
    };
}

// Initialize the device, sane nane as connection
let myDevice = await $getDevice('postgreSQL', true);

// Create query Manager for each query type, retains query data
let executeInsertQuery = await createQueryManager(myDevice); // Instance Insert
let executeSelectQuery = await createQueryManager(myDevice); // Instance Select

// Global Variables to retain Data
let selResult;

// 100ms loop catch Tag Events
let myLoop100ms = setInterval(loop100ms, 100);

async function loop100ms() {
  
    let customerName     = $getTag($getTagId('customerName'));
    let customerPhone    = $getTag($getTagId('customerPhone'));
    let customerEmail    = $getTag($getTagId('customerEmail'));
    let customerAge   	 = $getTag($getTagId('customerAge'));
    let execSaveCustomer = $getTag($getTagId('execSaveCustomer'));
  
	// Call Query Manager Instance Function Every 100ms, first parameter is the trigger to execute the query once with a one shot
    await executeInsertQuery(
        execSaveCustomer,
        `INSERT INTO "testData"."Customer" ("Name", "Phone", "Email", "Age") VALUES ('${customerName}', '${customerPhone}', '${customerEmail}', ${customerAge})`
    );
  
    // Testing second instance calling same function type
    //selResult = await executeSelectQuery(
    //    execSaveCustomer,
    //    'SELECT * FROM "testData"."Customer"'
    //);
	//
    //$setTag($getTagId('customerDataArray'), JSON.stringify(selResult));
}

// 1 sec loop update data from DB
let myLoop1sec = setInterval(loop1sec, 1000);

async function loop1sec() {
  // No Need to use query manager here as we are reading from DB every 1 sec to update Data for the Table
  selResult = await myDevice.pool.query('SELECT * FROM "testData"."Customer"');
  $setTag($getTagId('customerDataArray'), JSON.stringify(selResult));
}
```

Create a Client Side Script with an interval of 1 sec this script will put the data into the Table 

```
let customerData = JSON.parse($getTag($getTagId('customerDataArray'  ,)));

// Column ID's must match DB column
var tableData = {
  columns: [{
    id: 'Name',
    label: 'Name'
    }, {
    id: 'Phone',    
    label: 'Phone'
    }, {
    id: 'Email',    
    label: 'Email'
    }, {
    id: 'Age',    
    label: 'Age'
  }],
  rows: customerData
};

// Name of table used in Fuxa
$invokeObject('customerTable', 'setTableAndData', tableData);
```

