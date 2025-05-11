import { Injectable } from '@angular/core';
import { ProjectService } from '../_services/project.service';
import { Device, DeviceType, Tag } from '../_models/device';
import { DeviceAdapter } from './device-adapter';
import { Utils } from '../_helpers/utils';

@Injectable({
    providedIn: 'root'
})
export class DeviceAdapterService {

    private adapterMapping: Record<string, DeviceAdapter> = {};
    private mappingIdsAdapterToDevice: Record<string, string> = {};     // Adapter Tag Id -> Device Tag Id, of Alls Adapters
    private mappingIdsDeviceToAdapter: Record<string, string[]> = {};   // Devices Tags Id -> Adapter Tags Id

    constructor(
        private projectService: ProjectService,
    ) {

        this.projectService.onLoadHmi.subscribe(() => {
            this.loadDevices();
        });
    }

    loadDevices() {
        this.adapterMapping = {};
        this.mappingIdsAdapterToDevice = {};
        const devices = this.projectService.getDeviceList().filter(device => device.type === DeviceType.internal);
        devices.forEach((device) => {
            this.adapterMapping[device.name] = new DeviceAdapter(device);
            const tagsIds = Object.keys(device.tags);
            for (const id of tagsIds) {
                this.mappingIdsAdapterToDevice[id] = null;
            }
        });
    }

    setTargetDevice(adapterName: string, deviceName: string, onInitValue?: (adapterIds: Record<string, string>) => void) {
        const device = this.projectService.getDeviceList().find(device => device.name === deviceName);
        const adapter = this.adapterMapping[adapterName];
        if (!adapter) {
            console.error(`Adapter not found: ${adapterName}`);
            return;
        }
        const adapterIds = Object.keys(adapter.tags);
        const tagsIdOfDeviceRemoved = this.clearMappedDevice(adapterIds);
        this.removeMappedAdapterIdsFromDevice(tagsIdOfDeviceRemoved);
        if (device) {
            const adapterIdsThatMatch = this.setMatchIdsAdapterDevice(device, Object.values(adapter.tags));
            this.mapAdapterIdsWithDevice(adapterIdsThatMatch);
            onInitValue?.(adapterIdsThatMatch);
            // onClearValue?.(Object.keys(adapterIdsThatMatch));
        } else if (deviceName) {
            console.error(`Device not found: ${deviceName}`);
        }
    }

    resolveAdapterTagsId(ids: string[]): string[] {
        const resolved = [...ids];
        for (let i = 0; i < ids.length; i++) {
            if (!this.mappingIdsAdapterToDevice[ids[i]]) {
                continue;
            }
            resolved[i] = this.mappingIdsAdapterToDevice[ids[i]];
        }
        return resolved;
    }

    resolveDeviceTagIdForAdapter(id: string): string[] {
        return this.mappingIdsDeviceToAdapter[id];
    }

    /**
     * Map the Adapter Tags id in the Device Tag id
     * @param adapterIds
     */
    private mapAdapterIdsWithDevice(adapterIds: Record<string, string>) {
        for (const [adapterId, deviceId] of Object.entries(adapterIds)) {
            (this.mappingIdsDeviceToAdapter[deviceId] ??= []).push(adapterId);
        }
    }

    /**
     * Remove the mapped adapter ids from the mapping of Device to Adapter
     * @param tagsIdToRemove
     */
    private removeMappedAdapterIdsFromDevice(tagsIdToRemove: Record<string, string>) {
        for (const [adapterId, deviceId] of Object.entries(tagsIdToRemove)) {
            const adapterList = this.mappingIdsDeviceToAdapter[deviceId];
            if (adapterList) {
                this.mappingIdsDeviceToAdapter[deviceId] = adapterList.filter(id => id !== adapterId);
            }
        }
    }

    /**
     * Clear the mapping of the adapter ids if found a tagid of device
     * @param adapterIds
     * @returns Record list, Tag Id of Device -> Tag Id of Adapter
     */
    private clearMappedDevice(adapterIds: string[]): Record<string, string> {
        let tagsIdDevice: Record<string, string> = {};
        for (const id of adapterIds) {
            const tagIdOfDevice = this.mappingIdsAdapterToDevice[id];
            if (!Utils.isNullOrUndefined(tagIdOfDevice)) {
                tagsIdDevice[id] = tagIdOfDevice;
                this.mappingIdsAdapterToDevice[id] = null;
            }
        }
        return tagsIdDevice;
    }

    /**
     * Search and set the tags of the device that match the adapter with the tag name
     * @param device
     * @param adapterTags
     * @returns Record list, Tag Id of Adapter -> TagId of Device
     */
    private setMatchIdsAdapterDevice(device: Device, adapterTags: Tag[]): Record<string, string> {
        let result: Record<string, string> = {};
        const targetTags = Object.values(device.tags);
        Object.values(adapterTags)?.forEach((tag) => {
            const targetTag = targetTags.find((t) => t.name === tag.name);
            if (targetTag) {
                result[tag.id] = targetTag?.id;
                this.mappingIdsAdapterToDevice[tag.id] = targetTag?.id;
            }
        });
        return result;
    }
}

