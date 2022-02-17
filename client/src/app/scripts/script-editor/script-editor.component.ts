import { Component, OnInit, AfterViewInit, Inject, ViewChild } from '@angular/core';
import { MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material';
import { CodemirrorComponent } from '@ctrl/ngx-codemirror';
import { ChangeDetectorRef } from '@angular/core';

import { ProjectService } from '../../_services/project.service';
import { ScriptService } from '../../_services/script.service';
import { EditNameComponent } from '../../gui-helpers/edit-name/edit-name.component';
import { TranslateService } from '@ngx-translate/core';
import { Utils } from '../../_helpers/utils';
import { DeviceTagDialog } from '../../device/device.component';
import { ScriptParamType, Script, ScriptTest, SCRIPT_PREFIX, SystemFunctions, SystemFunction, ScriptParam } from '../../_models/script';
import { DevicesUtils, Tag } from '../../_models/device';

@Component({
    selector: 'app-script-editor',
    templateUrl: './script-editor.component.html',
    styleUrls: ['./script-editor.component.css']
})
export class ScriptEditorComponent implements OnInit, AfterViewInit {
    @ViewChild(CodemirrorComponent) CodeMirror: CodemirrorComponent;
    codeMirrorContent: string;
    codeMirrorOptions = { 
        lineNumbers: true, 
        theme: 'material', 
        mode: 'javascript',
        // lineWrapping: true,
        // foldGutter: true,
        // gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter', 'CodeMirror-lint-markers'],
        // gutters: ["CodeMirror-lint-markers"],
        // lint: {options: {esversion: 2021}},
        lint: true,
    };
    systemFunctions = new SystemFunctions();
    checkSystemFnc = this.systemFunctions.functions.map(sf => sf.name);
    parameters: ScriptParam[] = [];
    testParameters: ScriptParam[] = [];
    tagParamType = Utils.getEnumKey(ScriptParamType, ScriptParamType.tagid);

    console: string[] = [];
    script: Script;
    msgRemoveScript = '';
    ready = false;

    constructor(public dialogRef: MatDialogRef<ScriptEditorComponent>,
        public dialog: MatDialog,
        private changeDetector: ChangeDetectorRef,
        private translateService: TranslateService,
        private projectService: ProjectService,
        private scriptService: ScriptService,
        @Inject(MAT_DIALOG_DATA) public data: any) {
            this.script = data.script;
            this.dialogRef.afterOpened().subscribe(() => setTimeout(() => {this.ready = true; this.setCM()}, 0));
        }

    ngOnInit() {
        if (!this.script) {
            this.script = new Script(Utils.getGUID(SCRIPT_PREFIX));
        }
        this.parameters = this.script.parameters;
        this.codeMirrorContent = this.script.code;
        this.translateService.get('msg.script-remove', { value: this.script.name }).subscribe((txt: string) => { this.msgRemoveScript = txt });
        this.systemFunctions.functions.forEach(fnc => {
            this.translateService.get(fnc.text).subscribe((txt: string) => { fnc.text = txt });
            this.translateService.get(fnc.tooltip).subscribe((txt: string) => { fnc.tooltip = txt });
        });
        this.loadTestParameter();
    }

    ngAfterViewInit() {
    }
    
    setCM() {
        this.changeDetector.detectChanges();
        this.CodeMirror.codeMirror.refresh();
        let spellCheckOverlay = {
            token: (stream) => {
                for (let i = 0; i < this.checkSystemFnc.length; i++) {
                    if (stream.match(this.checkSystemFnc[i])) {
                        return "system-function";
                    }
                }
                while (stream.next() != null && this.checkSystemFnc.indexOf(stream) !== -1) {}
                return null;
            }
        }
        this.CodeMirror.codeMirror.addOverlay(spellCheckOverlay);
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.dialogRef.close(this.script);
    }

    getParameters() {
        return '';
    }

    isValid() {
        if (this.script && this.script.name) {
            return true;
        }
        return false;
    }

    onEditScriptName() {
        let title = 'dlg.item-title';
        let label = 'dlg.item-name';
        let error = 'dlg.item-name-error';
        let exist = this.data.scripts.map((s) => { return s.name });
        this.translateService.get(title).subscribe((txt: string) => { title = txt });
        this.translateService.get(label).subscribe((txt: string) => { label = txt });
        this.translateService.get(error).subscribe((txt: string) => { error = txt });
        let dialogRef = this.dialog.open(EditNameComponent, {
            position: { top: '60px' },
            data: { name: this.script.name, title: title, label: label, exist: exist, error: error }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result && result.name && result.name.length > 0) {
                this.script.name = result.name;
            }
        });
    }

    onAddFunctionParam() {
        let exist = this.parameters.map(p => { return p.name });
        let dialogRef = this.dialog.open(DialogScriptParam, {
            position: { top: '60px' },
            data: { name: '', exist: exist }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result && result.name && result.type) {
                this.parameters.push(new ScriptParam(result.name, result.type));
                this.loadTestParameter();
            }
        });
    }

    onRemoveParameter(index) {
        this.parameters.splice(index, 1);
        this.loadTestParameter();
    }

    onEditorContent(event) {
        this.script.code = this.codeMirrorContent;
    }

    onAddSystemFunction(sysfnc: SystemFunction) {
        if (sysfnc.params.filter((value) => value).length === 1) {
            this.onAddSystemFunctionTag(sysfnc);
        }
    }

    onAddSystemFunctionTag(sysfnc: SystemFunction) {
        let dialogRef = this.dialog.open(DeviceTagDialog, {
            position: { top: '60px' },
            data: { variableId: null, devices: this.data.devices, multiSelection: false }
        });

        dialogRef.afterClosed().subscribe((result) => {
            if (result && result.variableId) {
                let tag = { id: result.variableId, comment: DevicesUtils.getDeviceTagText(this.data.devices, result.variableId) };
                let text = this.getFunctionText(sysfnc, [tag]);
                this.insertText(text);
            }
        });
    }

    onSetTestTagParam(param: ScriptParam) {
        let dialogRef = this.dialog.open(DeviceTagDialog, {
            position: { top: '60px' },
            data: { variableId: null, devices: this.data.devices, multiSelection: false }
        });

        dialogRef.afterClosed().subscribe((result) => {
            if (result && result.variableId) {
                param.value = result.variableId;
            }
        });
    }

    onRunTest() {
        this.projectService.setScript(this.script, null).subscribe(() => {
            let torun = new ScriptTest(this.script.id, this.script.name);
            torun.parameters = this.testParameters;
            torun.outputId = this.script.id;
            delete torun.code;
            this.scriptService.runScript(torun).subscribe(result => {

            }, err => {
                this.console.push((err.message) ? err.message : err);
            });
        });
    }
    
    private insertText(text: string) {
        let doc = this.CodeMirror.codeMirror.getDoc();
        var cursor = doc.getCursor(); // gets the line number in the cursor position
        doc.replaceRange(text, cursor);
    }

    private getFunctionText(sysfnc: SystemFunction, params: any[]): string {
        let paramText = '';
        for (let i = 0; i < sysfnc.params.length; i++) {
            if (sysfnc.params[i]) {         // tag ID
                if (paramText.length) {     // parameters separator
                    paramText += ', ';
                }
                if (params[i]) {
                    paramText += `'${params[i].id}' /* ${params[i].comment} */`;
                } else {
                    paramText += '';
                }
            }
        }
        return `${sysfnc.name}(${paramText})`;
    }

    private loadTestParameter() {
        let params = [];
        for (let i = 0; i < this.parameters.length; i++) {
            let p = new ScriptParam(this.parameters[i].name, this.parameters[i].type);
            if (this.testParameters[i]) {
                p.value = this.testParameters[i].value;
            }
            params.push(p);
        }
        this.testParameters = params;
    }
}

@Component({
    selector: 'dlg-sript-param',
    templateUrl: 'param.dialog.html',
})
export class DialogScriptParam {
    error = '';
    existError = 'script.param-name-exist';
    paramType = ScriptParamType;
    constructor(public dialogRef: MatDialogRef<DialogScriptParam>,
        private translateService: TranslateService,
        @Inject(MAT_DIALOG_DATA) public data: any) { 
        Object.keys(this.paramType).forEach(key => {
            this.translateService.get(this.paramType[key]).subscribe((txt: string) => {this.paramType[key] = txt});
        });
        this.translateService.get(this.existError).subscribe((txt: string) => {this.existError = txt});
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    isValid(name): boolean {
        if (!this.data.type) return false;
        if (!this.data.name) return false;
        return (this.data.exist.find((n) => n === name)) ? false : true;
    }

    onCheckValue(input: any) {
        if (this.data.exist && this.data.exist.length && input.target.value) {
            if (this.data.exist.find((n) => n === input.target.value)) {
                this.error = this.existError;
                return;
            }
        }
        this.error = '';
    }
}