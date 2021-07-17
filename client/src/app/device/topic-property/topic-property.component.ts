import { Component, OnInit, OnDestroy, Inject, ViewChild } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { Subscription } from "rxjs";

import { HmiService } from '../../_services/hmi.service';
import { TranslateService } from '@ngx-translate/core';
import { Utils } from '../../_helpers/utils';
import { Tag, TAG_PREFIX } from '../../_models/device';

@Component({
    selector: 'app-topic-property',
    templateUrl: './topic-property.component.html',
    styleUrls: ['./topic-property.component.css']
})
export class TopicPropertyComponent implements OnInit, OnDestroy {

    private subscriptionBrowse: Subscription;

    topicSource = '#';
    topicsList = {};
    topicContent = [];
    topicSelectedType = 'raw';
    discoveryError = '';
    discoveryWait = false;
    discoveryTimer = null;
    selectedTopic = { key: '', value: null };
    topicToAdd = {};

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
                    this.topicsList[value.topic] = { name: value.topic, value: value.msg, checked: checked, enabled: enabled };
                }
            }
        });
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

    onNoClick(): void {
        this.dialogRef.close();
    }

    onDiscoveryTopics(source) {
        this.discoveryError = '';
        this.discoveryWait = true;
		this.discoveryTimer = setTimeout(() => {
            this.discoveryWait = false;
		}, 10000);        
        this.hmiService.askDeviceBrowse(this.data.device.name, source);
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
        this.selectedTopic = topic;
        this.loadSelectedTopic();
    }

    loadSelectedTopic() {
        this.topicContent =  [];
        if (this.topicSelectedType === 'json') {//Utils.isJson(this.selectedTopic.value.value)) {
            let obj = JSON.parse(this.selectedTopic.value.value);
            Object.keys(obj).forEach(key => {
                this.topicContent.push({ key: key, value: obj[key], checked: true, type: this.topicSelectedType });
            });
        } else {
            this.topicContent =  [{ key: this.selectedTopic.key, value: this.selectedTopic.value.value, checked: true, type: this.topicSelectedType }];
        }
    }

    onSubTopicValChange(topicSelType) {
        this.loadSelectedTopic();
    }

    isTopicSelected(topic) {
        return (this.selectedTopic === topic.key) ? true : false;
    }

    isSubscriptionValid() {
        return (this.topicContent && this.topicContent.length) ? true : false;
    }

    onAddToSubscribe() {
        if (this.topicContent && this.topicContent.length && this.invokeSubscribe) {
            let topics = this.topicContent.filter(t => t.checked);
            let tags = topics.map(t => {
                let tag = new Tag(Utils.getGUID(TAG_PREFIX));
                tag.name = t.key;
                tag.type = t.type;
                tag.address = this.selectedTopic.key;
                return tag;
            })
            this.invokeSubscribe(tags);
        }
    }
    invokeSubscribe = null;
}
