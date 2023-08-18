
class FuxaBridge {
    disposing = false;
    constructor(id) {
        this._id = id;
    }

    get id() {
        return this._id;
    }

    invoke = (func, arg1, arg2) => {
        if (typeof func === "function" && !this.disposing) {
            return func(arg1, arg2);
        }
        return
    }

    // Triggers Fuxa to reload the project. In the (re)load flow Fuxa will invoke the 'onRefreshProject' callback and receives the actual project JSON.
    refreshProject = () => {
        addToLogger(`APP invoke refreshProject to FUXA ${this.id}`);
        return this.invoke(this.onRefreshProject);
    }

    onRefreshProject = function () {
        addToLogger('onRefreshProject NOT supported!');
        console.log("onRefreshProject NOT supported!");
    }

    // This callback gets invoked when Fuxa loads the project
    loadProject = () => {
        addToLogger(`FUXA ${this.id} invoke loadProject`);
        return this.invoke(this.onLoadProject);
    }

    onLoadProject = function () {
        addToLogger('onLoadProject NOT supported!');
        console.log("onLoadProject NOT supported!");
    };

    saveProject = (project, refresh) => {
        addToLogger(`FUXA ${this.id} invoke saveProject`);
        return this.invoke(this.onSaveProject, project, refresh);
    }

    // This callback gets invoked when Fuxa saves the project
    onSaveProject = function () {
        addToLogger('onSaveProject NOT supported!');
        console.log("onSaveProject NOT supported!");
    }

    // call from FUXA to notify a device change to WebStudio
    deviceChange = (device) => {
        addToLogger(`FUXA ${this.id} invoke deviceChange`);
        return this.invoke(this.onDeviceChange, device);
    }

    // This callback gets invoked when Fuxa saves device and tags (add tag, remove tag)
    // device contain the list of tags
    onDeviceChange = function (device) {
        addToLogger('onDeviceChange NOT supported!');
        console.log("onDeviceChange NOT supported!");
    }

    // Device communications

    // call from WebStudio subscrptions callback
    emitDeviceValues = (tags) => {
        // addToLogger(`=> APP invoke onDeviceValues`);
        return this.invoke(this.onDeviceValues, tags);
    }

    // to define in FUXA
    // tags: array of DeviceValue
    onDeviceValues = function (tags) {
        addToLogger('=> onDeviceValues NOT supported!');
        console.error("=> onDeviceValues NOT supported!");
    }

    // call from FUXA to set value in WebStudio
    setDeviceValue = (tag) => {
        addToLogger(`=> FUXA invoke setDeviceValue`);
        return this.invoke(this.onSetDeviceValue, tag);
    }

    // to define in WebStudio
    // tag: DeviceValue
    onSetDeviceValue = function (tag) {
        addToLogger('=> onSetDeviceValue NOT supported!');
        console.error("=> onSetDeviceValue NOT supported!");
    }

    // call from FUXA to get values from WebStudio
    getDeviceValues = (tags) => {
        addToLogger(`=> FUXA invoke setDeviceValue`);
        return this.invoke(this.onGetDeviceValues, tags);
    }

    // to define in WebStudio
    // tags: DeviceValue, if null then return all devices tags value
    onGetDeviceValues = function (tags) {
        addToLogger('=> onGetDeviceValues NOT supported!');
        console.error("=> onGetDeviceValues NOT supported!");
    }

    /**
     * call from WebStudio to set command to FUXA.
     * @param {*} type: CommandType
     * @param {*} params Command parameters
     * @returns 
     */
    setCommand = (type, params) => {
        addToLogger(`APP invoke setCommand to FUXA ${this.id}`);
        return this.invoke(this.onSetCommand, type, params);
    }

    onSetCommand = function (type, params) {
        addToLogger('onSetCommand NOT supported!');
        console.log("onSetCommand NOT supported!");
    }

    /**
     * call from WebStudio to notify Message/Error to FUXA.
     * @param {*} type: MessageType
     * @param {*} message Message Object
     * @returns 
     */
    notifyMessage = (type, message) => {
        addToLogger(`APP invoke notifyMessage to FUXA ${this.id}`);
        return this.invoke(this.onNotifyMessage, type, message);
    }

    onNotifyMessage = function (type, message) {
        addToLogger('onNotifyMessage NOT supported!');
        console.log("onNotifyMessage NOT supported!");
    }
}

// class used to pass device value
class DeviceValue {
    constructor(deviceId, tagId, value) {
        this.source = deviceId;
        this.id = tagId;
        this.value = value;
        this.error = 0;
    }
}

class FuxaBridgeManager {
    bridges = {};

    createBridge = (widgetId) => {
        let bridge = this.bridges[widgetId];
        if (!bridge) {
            bridge = new FuxaBridge(widgetId);
            this.bridges[widgetId] = bridge;
            // this.bridge.onRefreshProject = () => {
            //     console.log("onLoad Project is running")
            //     return this.workModel.project// return the project from the work model
            // }
        }
        return bridge;
    }

    getBridge = (widgetId) => {
        return this.bridges[widgetId];
    }

    removeBridge = (widgetId) => {
        const bridge = this.bridges[widgetId];
        if (bridge) bridge.disposing = true
        delete this.bridges[widgetId];
    }
}

const fuxaBridgeManager = new FuxaBridgeManager();

function addToLogger(msg) {
    var logger = document.getElementById("logger");
    document.querySelector('#logger').innerHTML += '<span style="font-size: 10px;display:block;">' + msg + '</span>';
}

function refresh(id) {
    const bridge = fuxaBridgeManager.getBridge('fuxa' + id);
    if (bridge) {
        let r = bridge.refreshProject();
        addToLogger(`APP command refresh FUXA ${bridge.id}`);
        console.log(`APP command refresh FUXA ${bridge.id}`);
    }
}

function send(id) {
    var seltag = JSON.parse(document.getElementById("tags").value);
    var value = document.getElementById("tvalue").value;
    seltag.value = value;
    const bridge = fuxaBridgeManager.getBridge('fuxa' + id);
    if (bridge) {
        bridge.emitDeviceValues([seltag]);
    }
}

function command(id, selectedObject) {
    const bridge = fuxaBridgeManager.getBridge('fuxa' + id);
    if (bridge) {
        bridge.setCommand('view', [selectedObject.value]);
    }
}

function closeWidget(id) {
    var el = document.getElementById('mydiv' + id);
    el.remove();
    const bridge = fuxaBridgeManager.getBridge('fuxa' + id);
    if (bridge['fuxa']) {
        bridge['fuxa'].stopSimulator();
    }
    fuxaBridgeManager.removeBridge('fuxa' + id);
}

function create(id) {
    const tbridge = fuxaBridgeManager.getBridge('fuxa' + id);
    if (tbridge) {
        dragElement(document.getElementById("mydiv" + id));
        return;
    }
    const bridge = fuxaBridgeManager.createBridge('fuxa' + id);
    var instance = new FuxaInstance(id, bridge);
    bridge['fuxa'] = instance;
}

class FuxaInstance {
    simulator;
    bridge;
    height = 900;
    constructor(id, bridge) {
        if (id === '2') {
            this.height = 400;
        }

        this.bridge = bridge;
        // const tbridge = fuxaBridgeManager.getBridge('fuxa' + id);
        // if (tbridge) {
        //     dragElement(document.getElementById("mydiv" + id));
        //     return;
        // }
        // const bridge = fuxaBridgeManager.createBridge('fuxa' + id);
        bridge.onLoadProject = () => {
            addToLogger(`FUXA ${bridge.id} query project to load`);
            console.log(`FUXA ${bridge.id} query project to load`);
            let prj = JSON.parse(localStorage.getItem(bridge.id));
            if (prj) {
                this.checkProjectDevices(prj.devices);
                this.checkProjectViews(prj.hmi.views);
            }
            return prj;
            // return 'prj: ' + bridge._id;
        }

        bridge.onSaveProject = (project, refresh) => {
            if (project) {
                addToLogger(`FUXA ${bridge.id} ask to save project ${refresh}`);
                console.log(`FUXA ${bridge.id} ask to save project ${refresh}`);
                localStorage.setItem(bridge.id, JSON.stringify(project));
                this.checkProjectDevices(project.devices);
                this.checkProjectViews(project.hmi.views);
                if (refresh) {
                    this.bridge.refreshProject();
                }
                return true;// return if it's saved
            }
            return false;
        }

        var elem = document.createElement('div');
        elem.innerHTML +=
            // document.body.innerHTML += `
            elem.innerHTML = `
            <div id="mydiv${id}" style="position: absolute; z-index: 9; background-color: #f1f1f1; border: 1px solid #d3d3d3;">
                <div id="mydiv${id}header" style="padding: 10px; cursor: move; z-index: 10; background-color: #2196F3; color: #fff;">Click here to move
                    <div style="float: right; cursor: pointer;" onclick="closeWidget('${id}')">X</div>
                </div>
                <div style="position: relative; width:1400px; height: ${this.height}px">
                    <app-fuxa id="fuxa${id}">
                        <div style="position: absolute;top: 50%;left: 50%;transform: translate(-50%, -50%);">
                            <div class="logo" style="display: inline-block;width:40px;height:40px;background-size:40px 40px;"></div>
                            <div style="display: inline-block;padding-left:10px">
                                <div style="display:inline-block;font-size: 18px">FUXA Loading...</div>
                                <div style="display: block;font-size: 9px;padding-top: 3px;">
                                    powered by <span><b>frango</b>team</span>
                                </div>
                            </div>
                        </div>
                    </app-fuxa>
                </div>
            </div>`;
        document.body.appendChild(elem);
        dragElement(document.getElementById("mydiv" + id));
        const fuxa = document.querySelector('#fuxa' + id);
        refresh(id);
        fuxa.bridge = bridge; // It works!
        refresh(id);
    }

    // to manage the device tags subscription
    checkProjectDevices = (devices) => {
        var selectTags = document.getElementById("tags");
        // remove current device subscriptions
        selectTags.innerHTML = "";
        this.stopSimulator();
        // add devices subscriptions
        if (!devices) {
            return;
        }
        var simTags = [];
        for (var i = 0; i < devices.length; i++) {
            var device = devices[i];
            if (device.tags) {
                for (var x = 0; x < device.tags.length; x++) {
                    console.log(`${device.tags[x].id}: ${device.tags[x].address}`);
                    var opt = document.createElement('option');
                    opt.value = JSON.stringify(new DeviceValue(device.id, device.tags[x].id, null));
                    opt.innerHTML = device.tags[x].name;
                    selectTags.appendChild(opt);
                    if (device.type === 'WebStudio') {
                        var tag = new DeviceValue(device.id, device.tags[x].id, 0);
                        if (x === 1) {
                            tag.error = 'Error subscription';
                        }
                        simTags.push(tag);
                    }
                }
            }
        }
        if (simTags.length) {
            this.startSimulator(simTags);
        }
    }

    checkProjectViews = (views) => {
        var selectViews = document.getElementById("views");
        selectViews.innerHTML = "";
        // add devices subscriptions
        if (!views) {
            return;
        }
        for (var i = 0; i < views.length; i++) {
            var view = views[i];
            console.log(`${view.id}`);
            var opt = document.createElement('option');
            opt.value = view.id;
            opt.innerHTML = view.name;
            selectViews.appendChild(opt);
        }
    }

    startSimulator = (tags) => {
        var count = 0;
        this.simulator = setInterval(() => {
            count++;
            if (tags) {
                for (var i = 0; i < tags.length; i++) {
                    if (count % 10 !== 0 && i >= 3) {
                        break;
                    }
                    tags[i].value++;
                    delete tags[i].source;
                }
                if (this.bridge) {
                    var result = Object.values(tags);
                    this.bridge.emitDeviceValues(result);

                    // for (var x = 0; x < result.length; x++) {
                    //     this.bridge.emitDeviceValues([result[x]]);
                    // }
                }
            }
        }, 100);
    }

    stopSimulator = () => {
        clearInterval(this.simulator);
        this.simulator = null;
    }
}

function dragElement(elmnt) {
    var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    if (document.getElementById(elmnt.id + "header")) {
        // if present, the header is where you move the DIV from:
        document.getElementById(elmnt.id + "header").onmousedown = dragMouseDown;
    } else {
        // otherwise, move the DIV from anywhere inside the DIV:
        elmnt.onmousedown = dragMouseDown;
    }

    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        // get the mouse cursor position at startup:
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        // call a function whenever the cursor moves:
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        // calculate the new cursor position:
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        // set the element's new position:
        elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
        elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        // stop moving when mouse button is released:
        document.onmouseup = null;
        document.onmousemove = null;
    }
}