import { ChangeDetectionStrategy, Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';
import { FuxaServer, TagDaq, TagDeadband, TagDeadbandModeType, TagScale, TagScaleModeType } from '../../_models/device';
import { Utils} from '../../_helpers/utils';
import { ProjectService } from '../../_services/project.service';
import { Subscription } from 'rxjs';
import { Script, ScriptMode, ScriptParam, ScriptParamType } from '../../_models/script';

class ScriptAndParam extends ScriptParam {
    scriptId: string;
}
@Component({
    selector: 'app-tag-options',
    templateUrl: './tag-options.component.html',
    styleUrls: ['./tag-options.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TagOptionsComponent implements OnInit, OnDestroy {

    formGroup: UntypedFormGroup;
    scaleModeType = TagScaleModeType;
    scripts: Script[];
    configedReadParams: {[key: string]: ScriptAndParam[]} = {};
    configedWriteParams: {[key: string]: ScriptParam[]} = {};

    private subscriptionLoad: Subscription;

    constructor(
        public dialogRef: MatDialogRef<TagOptionsComponent>,
        private fb: UntypedFormBuilder,
        @Inject(MAT_DIALOG_DATA) public data: any,
        private projectService: ProjectService) {
    }

    ngOnInit() {
        this.loadScripts();
        this.subscriptionLoad = this.projectService.onLoadHmi.subscribe(res => {
            this.loadScripts();
        });
        this.formGroup = this.fb.group({
            interval: [{value: 60, disabled: true}, [Validators.required, Validators.min(0)]],
            changed: [{value: false, disabled: true}],
            enabled: [false],
            restored: [false],
            format: [null, [Validators.min(0)]],
            deadband: null,
            scaleMode: 'undefined',
            rawLow: null,
            rawHigh: null,
            scaledLow: null,
            scaledHigh: null,
            dateTimeFormat: null,
            scaleRead: null,
            scaleReadFunction: null,
            scaleWriteFunction: null,
        });

        this.formGroup.controls.enabled.valueChanges.subscribe(enabled => {
            if (enabled) {
                this.formGroup.controls.interval.enable();
                this.formGroup.controls.changed.enable();
            } else {
                this.formGroup.controls.interval.disable();
                this.formGroup.controls.changed.disable();
            }
        });

        // check if edit a group
        if (this.data.tags.length > 0) {
            let enabled = { value: null, valid: true };
            let changed = { value: null, valid: true };
            let interval = { value: null, valid: true };
            let restored = { value: null, valid: true };
            let format = { value: null, valid: true };
            let deadband = { value: null, valid: true };
            let scaleMode = { value: null, valid: true };
            let rawLow = { value: null, valid: true };
            let rawHigh = { value: null, valid: true };
            let scaledLow = { value: null, valid: true };
            let scaledHigh = { value: null, valid: true };
            let dateTimeFormat = { value: null, valid: true };
            let scaleReadFunction = { value: null, valid: true };
            //let scaleReadParams = { value: [], valid: true };
            let scaleWriteFunction = { value: null, valid: true };
            //let scaleWriteParams = { value: null, valid: true };
            for (let i = 0; i < this.data.tags.length; i++) {
                if (!this.data.tags[i].daq) {
                    continue;
                }
                let daq = <TagDaq>this.data.tags[i].daq;
                if (!enabled.value) {
                    enabled.value = daq.enabled;
                } else if (enabled.value !== daq.enabled) {
                    enabled.valid = false;
                }
                if (!changed.value) {
                    changed.value = daq.changed;
                } else if (changed.value !== daq.changed) {
                    changed.valid = false;
                }
                if (!restored.value) {
                    restored.value = daq.restored;
                } else if (restored.value !== daq.restored) {
                    restored.valid = false;
                }
                if (Utils.isNullOrUndefined(interval.value)) {
                    interval.value = daq.interval;
                } else if (interval.value !== daq.interval) {
                    interval.valid = false;
                }
                if (!format.value) {
                    format.value = this.data.tags[i].format;
                } else if (format.value !== this.data.tags[i].format) {
                    format.valid = false;
                }
                if (!deadband.value) {
                    deadband.value = this.data.tags[i].deadband?.value;
                } else if (deadband.value !== this.data.tags[i].deadband?.value) {
                    deadband.valid = false;
                }
                if (!scaleMode.value) {
                    scaleMode.value = this.data.tags[i].scale?.mode;
                    rawLow.value = this.data.tags[i].scale?.rawLow;
                    rawHigh.value = this.data.tags[i].scale?.rawHigh;
                    scaledLow.value = this.data.tags[i].scale?.scaledLow;
                    scaledHigh.value = this.data.tags[i].scale?.scaledHigh;
                    dateTimeFormat.value = this.data.tags[i].scale?.dateTimeFormat;
                } else if (scaleMode.value !== this.data.tags[i].scale?.mode) {
                    scaleMode.valid = false;
                }
                if (!scaleReadFunction.value) {
                    scaleReadFunction.value = this.data.tags[i].scaleReadFunction;
                }

                let script = this.scripts.find(s => s.id === this.data.tags[i].scaleReadFunction);
                if (this.data.tags[i].scaleReadParams) {
                    const tagParams = JSON.parse(this.data.tags[i].scaleReadParams) as ScriptParam[];
                    const notValid = this.initializeScriptParams(script, tagParams, this.configedReadParams);
                }
                if (!scaleWriteFunction.value) {
                    scaleWriteFunction.value = this.data.tags[i].scaleWriteFunction;
                }

                script = this.scripts.find(s => s.id === this.data.tags[i].scaleWriteFunction);
                if (this.data.tags[i].scaleWriteParams) {
                    const tagParams = JSON.parse(this.data.tags[i].scaleWriteParams) as ScriptParam[];
                    const notValid = this.initializeScriptParams(script, tagParams, this.configedWriteParams);
                }
            }
            let values = {};
            if (enabled.valid && enabled.value !== null) {
                values = {...values, enabled: enabled.value};
            }
            if (changed.valid && changed.value !== null) {
                values = {...values, changed: changed.value};
            }
            if (restored.valid && restored.value !== null) {
                values = {...values, restored: restored.value};
            }
            if (interval.valid && !Utils.isNullOrUndefined(interval.value)) {
                values = {...values, interval: interval.value};
            }
            if (format.valid && format.value) {
                values = {...values, format: format.value};
            }
            if (deadband.valid && deadband.value) {
                values = {...values, deadband: deadband.value };
            }
            if (scaleMode.valid && scaleMode.value) {
                values = {...values,
                    scaleMode: scaleMode.value,
                    rawLow: rawLow.value,
                    rawHigh: rawHigh.value,
                    scaledLow: scaledLow.value,
                    scaledHigh: scaledHigh.value,
                    dateTimeFormat: dateTimeFormat.value
                };
            }
            if (scaleReadFunction.valid && scaleReadFunction.value) {
                values = {...values, scaleReadFunction: scaleReadFunction.value};
            }

            if (scaleWriteFunction.valid && scaleWriteFunction.value) {
                values = {...values, scaleWriteFunction: scaleWriteFunction.value};
            }

            this.formGroup.patchValue(values);
            if (this.data.device?.id === FuxaServer.id) {
                this.formGroup.controls.scaleMode.disable();
            }
            this.formGroup.updateValueAndValidity();
            this.onCheckScaleMode(this.formGroup.value.scaleMode);
        }

        this.formGroup.controls.scaleMode.valueChanges.subscribe(value => {
            this.onCheckScaleMode(value);
        });
    }
    ngOnDestroy() {
        try {
            if (this.subscriptionLoad) {
                this.subscriptionLoad.unsubscribe();
            }
        } catch (e) {
        }
    }
    onCheckScaleMode(value: string) {
        switch (value) {
            case 'linear':
                this.formGroup.controls.rawLow.setValidators(Validators.required);
                this.formGroup.controls.rawHigh.setValidators(Validators.required);
                this.formGroup.controls.scaledLow.setValidators(Validators.required);
                this.formGroup.controls.scaledHigh.setValidators(Validators.required);
                break;
            default:
                this.formGroup.controls.rawLow.clearValidators();
                this.formGroup.controls.rawHigh.clearValidators();
                this.formGroup.controls.scaledLow.clearValidators();
                this.formGroup.controls.scaledHigh.clearValidators();
                break;
        }
        this.formGroup.controls.rawLow.updateValueAndValidity();
        this.formGroup.controls.rawHigh.updateValueAndValidity();
        this.formGroup.controls.scaledLow.updateValueAndValidity();
        this.formGroup.controls.scaledHigh.updateValueAndValidity();
        this.formGroup.updateValueAndValidity();
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        let readParamsStr;
        if (this.configedReadParams[this.formGroup.value.scaleReadFunction]) {
            readParamsStr = JSON.stringify(this.configedReadParams[this.formGroup.value.scaleReadFunction]);
        } else {
            readParamsStr = undefined;
        }
        let writeParamsStr;
        if (this.configedWriteParams[this.formGroup.value.scaleWriteFunction]) {
            writeParamsStr = JSON.stringify(this.configedWriteParams[this.formGroup.value.scaleWriteFunction]);
        } else {
            writeParamsStr = undefined;
        }
        this.dialogRef.close(<TagOptionType>{
            daq: new TagDaq(
                this.formGroup.value.enabled,
                this.formGroup.value.changed,
                this.formGroup.value.interval,
                this.formGroup.value.restored,
            ),
            format: this.formGroup.value.format,
            deadband: this.formGroup.value.deadband ? { value: this.formGroup.value.deadband, mode: TagDeadbandModeType.absolute } : undefined,
            scale: (this.formGroup.value.scaleMode !== 'undefined') ? {
                mode: this.formGroup.value.scaleMode,
                rawLow: this.formGroup.value.rawLow,
                rawHigh: this.formGroup.value.rawHigh,
                scaledLow: this.formGroup.value.scaledLow,
                scaledHigh: this.formGroup.value.scaledHigh,
                dateTimeFormat: this.formGroup.value.dateTimeFormat
            } : null,
            scaleReadFunction: this.formGroup.value.scaleReadFunction,
            scaleReadParams: readParamsStr,
            scaleWriteFunction: this.formGroup.value.scaleWriteFunction,
            scaleWriteParams: writeParamsStr
        });
    }

    disableForm() {
        return this.formGroup.invalid || this.paramsInValid();
    }
    paramsInValid() {
        if (this.formGroup.value.scaleReadFunction) {
            for (const p of this.configedReadParams[this.formGroup.value.scaleReadFunction]) {
                if (!p.value) {
                    return true;
                }
            }
        }
        if (this.formGroup.value.scaleWriteFunction) {
            for (const p of this.configedWriteParams[this.formGroup.value.scaleWriteFunction]) {
                if (!p.value) {
                    return true;
                }
            }
        }
        return false;
    }
    isFuxaServerTag() {
        return this.data.device?.id === FuxaServer.id;
    }

    private loadScripts() {
        //scripts that can be used to scale a tag must have the first parameter named "value" of
        // type value and be
        //run on the server
        //if additional parameters are used they must be of type value and the value to pass
        //must be provided in this form /////
        const filteredScripts = this.projectService.getScripts().filter(script => {
            if (script.parameters.length > 0 && script.mode === ScriptMode.SERVER) {
                if (script.parameters[0].name !== 'value' || script.parameters[0].type !== ScriptParamType.value) {
                    return false;
                }
                for (const param of script.parameters) {
                    if (param.type !== ScriptParamType.value) {
                        return false;
                    }
                }
                return true;
            }
            return false;
        });
        // get default param/value list for each script
        for (const script of filteredScripts) {
            const paramCopy = [];
            //skip the first param, as it is the value to scale
            for (let i = 1; i < script.parameters.length; i++ ) {
                const pc = new ScriptAndParam(script.parameters[i].name, script.parameters[i].type);
                pc.scriptId = script.id;
                pc.value = ('value' in script.parameters[i]) ? script.parameters[i].value : null;
                paramCopy.push(pc);
           }
           this.configedReadParams[script.id] = paramCopy;
           this.configedWriteParams[script.id] = paramCopy;
        }
        this.scripts = filteredScripts;
	}

    /**
     * updates this.configedParams list with the previously saved list of param/values for
     * the script.
     * @param script
     * @param tagParams
     * @returns returns true if the param/value list no longer matches script param/value list,
     * in which case the this.configedParams is not updated (default list will be used)
     */
    private initializeScriptParams(script: Script, tagParams: ScriptParam[], toUpdate: {[key: string]: ScriptParam[]}) {
        if (script) {
            // verify current params list match script params/values list
            let parametersChanged = false;
            if (tagParams.length !== script.parameters.length - 1) {
                parametersChanged = true;
            } else {
                for (const [index, param] of script.parameters.entries()) {
                    if (index === 0) {
                        continue;// skip first param as it is for the tag value
                    }
                    if (!(tagParams.some(p => p.name === param.name))) {
                        parametersChanged = true;
                        break;
                    }
                }
            }
            if (parametersChanged) {
                return true;
            } else {
                // haven't changed, update the working list with the previously saved
                // param/values
                toUpdate[script.id] = tagParams;
                return false;
            }
        }
        return true;
    }
}

export interface TagOptionType {
    daq: TagDaq;
    format: number;
    deadband: TagDeadband;
    scale: TagScale;
    scaleReadFunction?: string;
    scaleReadParams?: string;
    scaleWriteFunction?: string;
    scaleWriteParams?: string;
}
