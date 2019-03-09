// var snap7 = require('node-snap7');


function OpcUAclient(_property, _logger, _events) {

    var active = false;

    this.connect = function() {
        active = true;
    }

    this.disconnect = function() {
        active = false;
    }

    this.polling = function () {
        console.log(data.name + ': polling');
    }

    // var s7client = new snap7.S7Client();
    // s7client.ConnectTo('192.168.1.158', 0, 0, function(err) {
    //     if(err)
    //         return console.log(' >> Connection failed. Code #' + err + ' - ' + s7client.ErrorText(err));

    //     // Read the first byte from PLC process outputs...
    //     s7client.ABRead(0, 1, function(err, res) {
    //         if(err)
    //             return console.log(' >> ABRead failed. Code #' + err + ' - ' + s7client.ErrorText(err));

    //         // ... and write it to stdout
    //         console.log(res)
    //     });
    // });


    // var port = process.env.NODE_ENV === 'production' ? 80 : 4000;
    // var server = app.listen(port, function () {
    //     console.log('Server listening on port ' + port);
    // });
}

module.exports = {
    init: function (settings) {
        // deviceCloseTimeout = settings.deviceCloseTimeout || 15000;
    },
    create: function (property) {
        return new OpcUAclient(property);
    }
}