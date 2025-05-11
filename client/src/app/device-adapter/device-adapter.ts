import { Device } from '../_models/device';

export class DeviceAdapter extends Device {
    constructor(device: Device) {
        super(device.id);
        this.tags = device.tags;
        this.name = device.name;
    }
}
