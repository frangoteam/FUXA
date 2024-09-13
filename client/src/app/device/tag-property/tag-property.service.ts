import { Injectable } from '@angular/core';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { Device, TAG_PREFIX, Tag } from '../../_models/device';
import { Utils } from '../../_helpers/utils';
import { TagPropertyEditS7Component } from './tag-property-edit-s7/tag-property-edit-s7.component';
import { Observable, map } from 'rxjs';
import { ProjectService } from '../../_services/project.service';
import { TagPropertyEditServerComponent } from './tag-property-edit-server/tag-property-edit-server.component';
import { TagPropertyEditModbusComponent } from './tag-property-edit-modbus/tag-property-edit-modbus.component';
import { TagPropertyEditInternalComponent, TagPropertyInternalData } from './tag-property-edit-internal/tag-property-edit-internal.component';
import { TagPropertyEditOpcuaComponent, TagPropertyOpcUaData } from './tag-property-edit-opcua/tag-property-edit-opcua.component';
import { Node, NodeType } from '../../gui-helpers/treetable/treetable.component';
import { TagPropertyBacNetData, TagPropertyEditBacnetComponent } from './tag-property-edit-bacnet/tag-property-edit-bacnet.component';
import { TagPropertyEditWebapiComponent, TagPropertyWebApiData } from './tag-property-edit-webapi/tag-property-edit-webapi.component';
import { TagPropertyEditEthernetipComponent, TagPropertyEthernetIpData } from './tag-property-edit-ethernetip/tag-property-edit-ethernetip.component';
import { TopicPropertyComponent, TopicPropertyData } from '../topic-property/topic-property.component';
import { TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';

@Injectable({
    providedIn: 'root'
})
export class TagPropertyService {

    constructor(private dialog: MatDialog,
        private translateService: TranslateService,
        private toastService: ToastrService,
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

    public editTagPropertyEthernetIp(device: Device, tag: Tag, checkToAdd: boolean): Observable<any> {
        let oldTagId = tag.id;
        let tagToEdit: Tag = Utils.clone(tag);
        let dialogRef = this.dialog.open(TagPropertyEditEthernetipComponent, {
            disableClose: true,
            data: <TagPropertyEthernetIpData> {
                device: device,
                tag: tagToEdit
            },
            position: { top: '60px' }
        });

        return dialogRef.componentInstance.result.pipe(
            map(result => {
                if (result) {
                    tag.name = result.tagName;
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

    public addTagsOpcUa(device: Device, tagsMap?: any): Observable<any> {
        let dialogRef = this.dialog.open(TagPropertyEditOpcuaComponent, {
            disableClose: true,
            position: { top: '60px' },
            data: <TagPropertyOpcUaData> {
                device: device,
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
                    if (tagsMap) {
                        tagsMap[tag.id] = tag;
                    }
                });
                this.projectService.setDeviceTags(device);
                dialogRef.close();
                return result;
            })
        );
    }

    public editTagPropertyOpcUa(device: Device, tag: Tag, checkToAdd: boolean): Observable<any> {
        let oldTagId = tag.id;
        let tagToEdit: Tag = Utils.clone(tag);
        let dialogRef = this.dialog.open(TagPropertyEditOpcuaComponent, {
            disableClose: true,
            position: { top: '60px' },
            data: <TagPropertyOpcUaData> {
                device: device,
                tag: tagToEdit
            },
        });

        return dialogRef.componentInstance.result.pipe(
            map(result => {
                if (result) {
                    tag.type = result.tagType;
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

    public editTagPropertyBacnet(device: Device, tagsMap?: any): Observable<any> {
        let dialogRef = this.dialog.open(TagPropertyEditBacnetComponent, {
            disableClose: true,
            position: { top: '60px' },
            data: <TagPropertyBacNetData> {
                device: device,
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
                    if (tagsMap) {
                        tagsMap[tag.id] = tag;
                    }
                });
                this.projectService.setDeviceTags(device);
                dialogRef.close();
                return result;
            })
        );
    }

    public editTagPropertyWebapi(device: Device, tagsMap?: any): Observable<any> {
        let dialogRef = this.dialog.open(TagPropertyEditWebapiComponent, {
            disableClose: true,
            position: { top: '60px' },
            data: <TagPropertyWebApiData> {
                device: device,
            },
        });

        return dialogRef.componentInstance.result.pipe(
            map((result: TagPropertyWebApiData) => {
                result?.nodes.forEach((n: Node) => {
                    let tag = new Tag(Utils.getGUID(TAG_PREFIX));
                    tag.name = n.text;
                    tag.label = n.text;
                    tag.type = n.type;
                    tag.label = n.text;
                    if (n.class === NodeType.Reference) {
                        tag.memaddress = n.property;        // in memaddress save the address of the value
                        tag.options = n.todefine;           // save the id and value in text to set by select list
                        tag.type = n.type;
                    }
                    tag.address = n.id;
                    this.checkToAdd(tag, result.device);
                    if (tagsMap) {
                        tagsMap[tag.id] = tag;
                    }
                });
                this.projectService.setDeviceTags(device);
                dialogRef.close();
                return result;
            })
        );
    }

    editTagPropertyMqtt(device: Device, topic: Tag, tagsMap: {}, callbackModify: () => void) {
        let dialogRef = this.dialog.open(TopicPropertyComponent, {
            disableClose: true,
            panelClass: 'dialog-property',
            data: <TopicPropertyData>{
                device: device,
                topic: topic,
                devices: this.projectService.getServerDevices()
            },
            position: { top: '60px' }
        });
        dialogRef.componentInstance.invokeSubscribe = (oldtopic, newtopics) => this.addTopicSubscription(device, oldtopic, newtopics, tagsMap, callbackModify);
        dialogRef.componentInstance.invokePublish = (oldtopic, newtopic) => this.addTopicToPublish(device, oldtopic, newtopic, tagsMap, callbackModify);
        dialogRef.afterClosed().subscribe();
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

    formatAddress(adr: string, mem: string): string {
        let result = adr;
        if (mem) {
            result += '[' + mem + ']';
        }
        return result;
    }

    private addTopicSubscription(device: Device, oldTopic: Tag, topics: Tag[], tagsMap: {}, callbackModify: () => void) {
        if (topics) {
            let existNames = Object.values(device.tags).filter((t: Tag) => { if (!oldTopic || t.id !== oldTopic.id) {return t.name;} }).map((t: Tag) => t.name);
            topics.forEach((topic: Tag) => {
                // check if name exist
                if (existNames.indexOf(topic.name) !== -1) {
                    const msg = this.translateService.instant('device.topic-name-exist', { value: topic.name });
                    this.notifyError(msg);
                } else {
                    // check if subscriptions address exist for new topic
                    let exist = null;
                    if (!oldTopic) {
                        Object.keys(device.tags).forEach((key) => {
                            if (device.tags[key].address === topic.address && device.tags[key].memaddress === topic.memaddress &&
                                device.tags[key].id != topic.id && device.tags[key].options.subs) {
                                exist = this.formatAddress(topic.address, topic.memaddress);
                            }
                        });
                    }
                    if (exist) {
                        const msg = this.translateService.instant('device.topic-subs-address-exist', { value: exist });
                        this.notifyError(msg);
                    } else {
                        device.tags[topic.id] = topic;
                        tagsMap[topic.id] = topic;
                    }
                }
            });
            this.projectService.setDeviceTags(device);
            if (callbackModify) {
                callbackModify();
            }
        }
    }

    private addTopicToPublish(device: Device, oldTopic: Tag, topic: Tag, tagsMap: {}, callbackModify: () => void) {
        if (topic) {
            let existNames = Object.values(device.tags).filter((t: Tag) => { if (!oldTopic || t.id !== oldTopic.id) {return t.name;} }).map((t: Tag) => t.name);
            // check if name exist
            if (existNames.indexOf(topic.name) !== -1) {
                const msg = this.translateService.instant('device.topic-name-exist', { value: topic.name });
                this.notifyError(msg);
            } else {
                // check if publish address exist
                let exist = null;
                Object.keys(device.tags).forEach((key) => {
                    if (device.tags[key].address === topic.address && device.tags[key].id != topic.id) {
                        exist = topic.address;
                    }
                });
                if (exist) {
                    const msg = this.translateService.instant('device.topic-pubs-address-exist', { value: exist });
                    this.notifyError(msg);
                } else {
                    device.tags[topic.id] = topic;
                    tagsMap[topic.id] = topic;
                }
                this.projectService.setDeviceTags(device);
                if (callbackModify) {
                    callbackModify();
                }
            }
        }
    }

    private notifyError(error: string) {
        this.toastService.error(error, '', {
            timeOut: 3000,
            closeButton: true
            // disableTimeOut: true
        });
    }
}
