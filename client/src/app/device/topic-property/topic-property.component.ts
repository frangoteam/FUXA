import { Component, OnInit, OnDestroy, Inject, ViewChild } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTabGroup, MatTab } from '@angular/material/tabs';
import { Subscription } from 'rxjs';

import { HmiService } from '../../_services/hmi.service';
import { TranslateService } from '@ngx-translate/core';
import { Utils } from '../../_helpers/utils';
import { Tag, TAG_PREFIX } from '../../_models/device';

@Component({
    selector: 'app-topic-property',
    templateUrl: './topic-property.component.html',
    styleUrls: ['./topic-property.component.scss']
})
export class TopicPropertyComponent implements OnInit, OnDestroy {

    @ViewChild('grptabs', {static: true}) grptabs: MatTabGroup;
    @ViewChild('tabsub', {static: true}) tabsub: MatTab;
    @ViewChild('tabpub', {static: true}) tabpub: MatTab;

    private subscriptionBrowse: Subscription;

    editMode = false;
    topicSource = '#';
    topicsList = {};
    topicContent = [];
    topicSelectedSubType = 'raw';
    discoveryError = '';
    discoveryWait = false;
    discoveryTimer = null;
    selectedTopic = { name: '', key: '', value: null, subs: null };
    topicToAdd = {};
    invokeSubscribe = null;

    invokePublish = null;
    topicSelectedPubType = 'raw';
    publishTopicName: string;
    publishTopicPath: string;
    pubPayload = new MqttPayload();
    pubPayloadResult = '';
    itemType = MqttItemType;
    itemTag = Utils.getEnumKey(MqttItemType, MqttItemType.tag);
    itemTimestamp = Utils.getEnumKey(MqttItemType, MqttItemType.timestamp);
    itemValue = Utils.getEnumKey(MqttItemType, MqttItemType.value);
    itemStatic = Utils.getEnumKey(MqttItemType, MqttItemType.static);

    constructor(
        private hmiService: HmiService,
        private translateService: TranslateService,
        public dialogRef: MatDialogRef<TopicPropertyComponent>,
        @Inject(MAT_DIALOG_DATA) public data: any) {
    }

    ngOnInit() {
        this.subscriptionBrowse = this.hmiService.onDeviceBrowse.subscribe(value => {
            if (value.result === 'error') {
                this.discoveryError = value.result;
            } else if (value.topic) {
                if (this.topicsList[value.topic]) {
                    this.topicsList[value.topic].value = value.msg;
                } else {
                    let checked = false;
                    let enabled = true;
                    if (this.data.device.tags[value.topic]) {
                        checked = true;
                        enabled = false;
                    }
                    // key => value
                    this.topicsList[value.topic] = { name: value.topic, content: value.msg, checked: checked, enabled: enabled };
                }
            }
        });

        Object.keys(this.itemType).forEach(key => {
            this.translateService.get(this.itemType[key]).subscribe((txt: string) => { this.itemType[key] = txt; });
        });

        // check if edit the topic
        if (this.data.topic) {
            let tag = <Tag>this.data.topic;
            if (tag.options) {
                if (tag.options.subs) {
                    // sure a subscription
                    this.grptabs.selectedIndex = 0;
                    this.tabpub.disabled = true;
                    this.topicSelectedSubType = tag.type;
                    this.editMode = true;
                    this.selectTopic({ name: tag.name, key: tag.address, value: { content: tag.value }, subs: tag.options.subs });
                } else {
                    // publish topic
                    this.grptabs.selectedIndex = 1;
                    this.tabsub.disabled = true;
                    this.publishTopicPath = tag.address;
                    this.publishTopicName = tag.name;
                    this.topicSelectedPubType = tag.type;
                    if (tag.options.pubs) {
                        // sure publish
                        this.pubPayload.items = tag.options.pubs;
                    }
                }
            }
        }
        this.loadSelectedSubTopic();
        this.stringifyPublishItem();
    }

    ngOnDestroy() {
        // this.checkToSave();
        try {
            if (this.subscriptionBrowse) {
                this.subscriptionBrowse.unsubscribe();
            }
        } catch (e) {
        }
        if (this.discoveryTimer) {
            clearInterval(this.discoveryTimer);
        }
		this.discoveryTimer = null;
    }

    //#region Subscription
    onNoClick(): void {
        this.dialogRef.close();
    }

    onDiscoveryTopics(source) {
        this.discoveryError = '';
        this.discoveryWait = true;
		this.discoveryTimer = setTimeout(() => {
            this.discoveryWait = false;
		}, 10000);
        this.hmiService.askDeviceBrowse(this.data.device.id, source);
    }

    onClearDiscovery() {
        this.topicsList = {};
        this.discoveryError = '';
        this.discoveryWait = false;
        try {
            if (this.discoveryTimer) {
			    clearInterval(this.discoveryTimer);
            }
		} catch { }
    }

    selectTopic(topic) {
        this.selectedTopic = JSON.parse(JSON.stringify(topic));
        this.loadSelectedSubTopic();
    }

    private loadSelectedSubTopic() {
        this.topicContent =  [];
        if (this.selectedTopic.value) {
            if (this.topicSelectedSubType === 'json') {
                let obj = JSON.parse(this.selectedTopic.value?.content);
                Object.keys(obj).forEach(key => {
                    let checked = (this.selectedTopic.subs) ? false : true;
                    if (this.selectedTopic.subs && this.selectedTopic.subs.indexOf(key) !== -1) {
                        checked = true;
                    }
                    this.topicContent.push({ key: key, value: obj[key], checked: checked, type: this.topicSelectedSubType });
                });
            } else if (this.selectedTopic.value?.content) {
                this.topicContent =  [{ name: this.selectedTopic.name, key: this.selectedTopic.key, value: this.selectedTopic.value?.content, checked: true, type: this.topicSelectedSubType }];
            }
        }
    }

    onSubTopicValChange(topicSelType) {
        this.loadSelectedSubTopic();
    }

    isTopicSelected(topic) {
        return (this.selectedTopic === topic.key) ? true : false;
    }

    isSubscriptionEdit() {
        return this.editMode;
    }

    isSubscriptionValid() {
        if (this.topicContent && this.topicContent.length) {
            let onechecked = false;
            for (let i = 0; i < this.topicContent.length; i++) {
                if (this.topicContent[i].checked) {
                    onechecked = true;
                }
            }
            return onechecked;
        }
        return false;
    }

    onAddSubscribeAttribute() {
        if (this.selectedTopic.key && !this.topicContent.length || this.topicSelectedSubType === 'json') {
            this.topicContent.push({
                name: this.selectedTopic.name,
                key: this.selectedTopic.key,
                value: this.selectedTopic.value?.content,
                checked: true, type: this.topicSelectedSubType
            });
        }
    }

    onSelectedChanged() {
        if (this.topicSelectedSubType === 'raw' && this.topicContent.length) {
            this.topicContent[0].key = this.selectedTopic.key;
        }
    }

    onAddToSubscribe() {
        if (this.topicContent && this.topicContent.length && this.invokeSubscribe) {
            let topicsToAdd = [];
            for (let i = 0; i < this.topicContent.length; i++) {
                if (this.topicContent[i].checked) {
                    let topic = new Tag(Utils.getGUID(TAG_PREFIX));
                    if (this.data.topic) {
                        topic = new Tag(this.data.topic.id);
                    }
                    topic.type = this.topicSelectedSubType;
                    topic.address = this.selectedTopic.key;
                    topic.memaddress = this.topicContent[i].key;
                    topic.options = { subs: this.topicContent.map((tcnt) => tcnt.key) };
                    if (this.topicContent[i].name) {
                        topic.name = this.topicContent[i].name;
                    } else {
                        topic.name = this.selectedTopic.key;
                        if (topic.type === 'json') {
                            topic.name += '[' + topic.memaddress + ']';
                        }
                    }
                    topicsToAdd.push(topic);
                }
            }
            this.invokeSubscribe(this.data.topic, topicsToAdd);
        } else if (this.selectedTopic.key?.length) {
            let topic = new Tag(Utils.getGUID(TAG_PREFIX));
            topic.name = this.selectedTopic.key;
            topic.type = 'raw';
            topic.address = this.selectedTopic.key;
            topic.memaddress = this.selectedTopic.key;
            topic.options = { subs: this.selectedTopic.key };
            this.invokeSubscribe(this.data.topic, [topic]);
        }
    }
    //#endregion

    //#region  Publish
    isPublishTypeToEnable(type: string) {
        if (type === 'raw' || (this.pubPayload.items && this.pubPayload.items.length)) {
            return true;
        }
        return false;
    }

    onAddToPuplish() {
        if (this.publishTopicPath && this.invokePublish) {
            let tag = new Tag(Utils.getGUID(TAG_PREFIX));
            if (this.data.topic) {
                tag = new Tag(this.data.topic.id);
            }
            tag.name = this.publishTopicName;
            tag.address = this.publishTopicPath;
            tag.type = this.topicSelectedPubType;
            tag.options = { pubs: this.pubPayload.items };
            this.invokePublish(this.data.topic, tag);
        }
    }

    onPubTopicValChange(topicSelType) {
        this.stringifyPublishItem();
    }

    onAddPublishItem() {
        this.pubPayload.items.push(new MqttPayloadItem());
        this.stringifyPublishItem();
    }

    onRemovePublishItem(index: number) {
        this.pubPayload.items.splice(index, 1);
        this.stringifyPublishItem();
    }

    onSetPublishItemTag(item: MqttPayloadItem, event: any) {
        item.value = event.variableId;
        if (event.variableRaw) {
            item.name = event.variableRaw.address;
        }
        this.stringifyPublishItem();
    }

    onItemTypeChanged(item: MqttPayloadItem) {
        if (item.type === this.itemTimestamp) {
            item.value = new Date().toISOString();
        } else if (item.type === this.itemStatic) {
            item.value = '';
        } else if (item.type === this.itemValue) {
            item.name = this.publishTopicPath;
        }
        this.stringifyPublishItem();
    }

    /**
     * Render the payload content
     */
    stringifyPublishItem() {
        let obj = {};
        let row = '';
        if (this.pubPayload.items.length) {
            for (let i = 0; i < this.pubPayload.items.length; i++) {
                let item: MqttPayloadItem = this.pubPayload.items[i];
                let ivalue = item.value;
                if (item.type === this.itemTimestamp) {
                    ivalue = new Date().toISOString();
                } else if (item.type === this.itemTag) {
                    ivalue = `$(${item.name})`;
                } else if (item.type === this.itemStatic) {
                    ivalue = `${item.value}`;
                } else if (item.type === this.itemValue) {
                    item.value = this.publishTopicPath;
                    ivalue = `$(${item.value})`;
                } else{
                    ivalue = `${item.value}`;
                }
                if (this.topicSelectedPubType === 'json') {
                    let keys = item.key.split('.');
                    let robj = obj;
                    for (let y = 0; y < keys.length; y++) {
                        if (!robj[keys[y]]) {
                            robj[keys[y]] = {};
                        }
                        if (y >= keys.length - 1) {
                            robj[keys[y]] = ivalue;
                        }
                        robj = robj[keys[y]];
                    }
                } else {
                    // payload items in row format
                    if (row) {
                        ivalue = ';' + ivalue;
                    }
                }
                row += ivalue;
            }
        } else {
            row = `$(${this.publishTopicPath})`;
            obj = { '': row };
        }
        if (this.topicSelectedPubType === 'json') {
            this.pubPayloadResult = JSON.stringify(obj, undefined, 2);
        } else {
            this.pubPayloadResult = row;
        }
    }

    isPublishValid() {
        return (this.publishTopicPath && this.publishTopicPath.length) ? true : false;
    }
    //#endregion
}

export enum MqttItemType {
    tag = 'device.topic-type-tag',
    timestamp = 'device.topic-type-timestamp',
    value = 'device.topic-type-value',
    static = 'device.topic-type-static',
}

export class MqttPayload {
    items: MqttPayloadItem[] = [];
}

export class MqttPayloadItem {
    type = Utils.getEnumKey(MqttItemType, MqttItemType.tag);
    key = '';
    value = '';
    name;
}
