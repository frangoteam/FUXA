import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Device, TAG_PREFIX, Tag } from '../../_models/device';
import { Utils } from '../../_helpers/utils';
import { TagPropertyEditS7Component } from './tag-property-edit-s7/tag-property-edit-s7.component';
import { Observable, map } from 'rxjs';
import { ProjectService } from '../../_services/project.service';
import { TagPropertyEditServerComponent } from './tag-property-edit-server/tag-property-edit-server.component';
import { TagPropertyEditModbusComponent } from './tag-property-edit-modbus/tag-property-edit-modbus.component';
import { TagPropertyEditInternalComponent, TagPropertyInternalData } from './tag-property-edit-internal/tag-property-edit-internal.component';
import { TagPropertyEditOpcuaComponent, TagPropertyOpcUaData } from './tag-property-edit-opcua/tag-property-edit-opcua.component';
import { Node } from '../../gui-helpers/treetable/treetable.component';
import { TagPropertyEditBacnetComponent } from './tag-property-edit-bacnet/tag-property-edit-bacnet.component';

@Injectable({
    providedIn: 'root'
})
export class TagPropertyService {

    constructor(private dialog: MatDialog,
        private projectService: ProjectService) { }

    public editTagPropertyS7(device: Device, tag: Tag, checkToAdd: boolean): Observable<any> {
        let oldTagId = tag.id;
        let tagToEdit: Tag = Utils.clone(tag);
        let dialogRef = this.dialog.open(TagPropertyEditS7Component, {
            disableClose: true,
            data: {
                device: device,
                tag: tagToEdit
            },
            position: { top: '60px' }
        });

        return dialogRef.componentInstance.result.pipe(
            map(result => {
                if (result) {
                    tag.name = result.tagName;
                    tag.type = result.tagType;
                    tag.address = result.tagAddress;
                    tag.description = result.tagDescription;
                    if (checkToAdd) {
                        this.checkToAdd(tag, device);
                    } else if (tag.id !== oldTagId) {
                        //remove old tag device reference
                        delete device.tags[oldTagId];
                        this.checkToAdd(tag, device);
                    }
                    this.projectService.setDeviceTags(device);
                }
                dialogRef.close();
                return result;
            })
        );
    }

    public editTagPropertyServer(device: Device, tag: Tag, checkToAdd: boolean): Observable<any> {
        let oldTagId = tag.id;
        let tagToEdit: Tag = Utils.clone(tag);
        let dialogRef = this.dialog.open(TagPropertyEditServerComponent, {
            disableClose: true,
            data: {
                device: device,
                tag: tagToEdit
            },
            position: { top: '60px' }
        });

        return dialogRef.componentInstance.result.pipe(
            map(result => {
                if (result) {
                    tag.name = result.tagName;
                    tag.type = result.tagType;
                    tag.init = result.tagInit;
                    tag.value = result.tagInit;
                    tag.description = result.tagDescription;
                    if (checkToAdd) {
                        this.checkToAdd(tag, device);
                    } else if (tag.id !== oldTagId) {
                        //remove old tag device reference
                        delete device.tags[oldTagId];
                        this.checkToAdd(tag, device);
                    }
                    this.projectService.setDeviceTags(device);
                }
                dialogRef.close();
                return result;
            })
        );
    }

    public editTagPropertyModbus(device: Device, tag: Tag, checkToAdd: boolean): Observable<any> {
        let oldTagId = tag.id;
        let tagToEdit: Tag = Utils.clone(tag);
        let dialogRef = this.dialog.open(TagPropertyEditModbusComponent, {
            disableClose: true,
            data: {
                device: device,
                tag: tagToEdit
            },
            position: { top: '60px' }
        });

        return dialogRef.componentInstance.result.pipe(
            map(result => {
                if (result) {
                    tag.name = result.tagName;
                    tag.type = result.tagType;
                    tag.address = result.tagAddress;
                    tag.memaddress = result.tagMemoryAddress;
                    tag.divisor = result.tagDivisor;
                    tag.description = result.tagDescription;
                    if (checkToAdd) {
                        this.checkToAdd(tag, device);
                    } else if (tag.id !== oldTagId) {
                        //remove old tag device reference
                        delete device.tags[oldTagId];
                        this.checkToAdd(tag, device);
                    }
                    this.projectService.setDeviceTags(device);
                }
                dialogRef.close();
                return result;
            })
        );
    }

    public editTagPropertyInternal(device: Device, tag: Tag, checkToAdd: boolean): Observable<any> {
        let oldTagId = tag.id;
        let tagToEdit: Tag = Utils.clone(tag);
        let dialogRef = this.dialog.open(TagPropertyEditInternalComponent, {
            disableClose: true,
            data: <TagPropertyInternalData> {
                device: device,
                tag: tagToEdit
            },
            position: { top: '60px' }
        });

        return dialogRef.componentInstance.result.pipe(
            map(result => {
                if (result) {
                    tag.name = result.tagName;
                    tag.type = result.tagType;
                    tag.init = result.tagInit;
                    tag.value = result.tagInit;
                    tag.description = result.tagDescription;
                    if (checkToAdd) {
                        this.checkToAdd(tag, device);
                    } else if (tag.id !== oldTagId) {
                        //remove old tag device reference
                        delete device.tags[oldTagId];
                        this.checkToAdd(tag, device);
                    }
                    this.projectService.setDeviceTags(device);
                }
                dialogRef.close();
                return result;
            })
        );
    }

    public editTagPropertyOpcUa(device: Device, tag: Tag, tagsMap: any): Observable<any> {
        let dialogRef = this.dialog.open(TagPropertyEditOpcuaComponent, {
            disableClose: true,
            position: { top: '60px' },
            data: <TagPropertyOpcUaData> {
                device: device,
                tag: tag
            },
        });

        return dialogRef.componentInstance.result.pipe(
            map(result => {
                result?.nodes.forEach((n: Node) => {
                    let tag = new Tag(Utils.getGUID(TAG_PREFIX));
                    tag.name = n.text;
                    tag.label = n.text;
                    tag.type = n.type;
                    tag.address = n.id;
                    this.checkToAdd(tag, result.device);
                    tagsMap[tag.id] = tag;
                });
                this.projectService.setDeviceTags(device);
                dialogRef.close();
                return result;
            })
        );
    }

    public editTagPropertyBacnet(device: Device, tag: Tag, tagsMap: any): Observable<any> {
        let dialogRef = this.dialog.open(TagPropertyEditBacnetComponent, {
            disableClose: true,
            position: { top: '60px' },
            data: <TagPropertyOpcUaData> {
                device: device,
                tag: tag
            },
        });

        return dialogRef.componentInstance.result.pipe(
            map(result => {
                result?.nodes.forEach((n: Node) => {
                    let tag = new Tag(Utils.getGUID(TAG_PREFIX));
                    tag.name = n.text;
                    tag.label = n.text;
                    tag.type = n.type;
                    tag.address = n.id;
                    tag.label = n.text;
                    tag.memaddress = n.parent?.id;
                    this.checkToAdd(tag, result.device);
                    tagsMap[tag.id] = tag;
                });
                this.projectService.setDeviceTags(device);
                dialogRef.close();
                return result;
            })
        );
    }

    checkToAdd(tag: Tag, device: Device, overwrite: boolean = false) {
        let exist = false;
        Object.keys(device.tags).forEach((key) => {
            if (device.tags[key].id) {
                if (device.tags[key].id === tag.id) {
                    exist = true;
                }
            } else if (device.tags[key].name === tag.name) {
                exist = true;
            }
        });
        if (!exist) {
            device.tags[tag.id] = tag;
        }
    }
}
