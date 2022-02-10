import { Component, OnInit, AfterViewInit, Inject, ViewChild } from '@angular/core';
import { MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material';
import { CodemirrorComponent } from '@ctrl/ngx-codemirror';

import { EditNameComponent } from '../../gui-helpers/edit-name/edit-name.component';
import { TranslateService } from '@ngx-translate/core';
import { Utils } from '../../_helpers/utils';
import { DeviceTagDialog } from '../../device/device.component';
import { ScriptParamType, Script, SCRIPT_PREFIX } from '../../_models/script';

@Component({
    selector: 'app-script-editor',
    templateUrl: './script-editor.component.html',
    styleUrls: ['./script-editor.component.css']
})
export class ScriptEditorComponent implements OnInit, AfterViewInit {
    @ViewChild(CodemirrorComponent) codemirrorComponent: CodemirrorComponent;
    codeMirror;

    parameters = [];
    script: Script;
    msgRemoveScript = '';

    constructor(public dialogRef: MatDialogRef<ScriptEditorComponent>,
        public dialog: MatDialog,
        private translateService: TranslateService,
        @Inject(MAT_DIALOG_DATA) public data: any) {
            this.script = data.script;
        }

    ngOnInit() {
        if (!this.script) {
            this.script = new Script(Utils.getGUID(SCRIPT_PREFIX));
        }
    }

    ngAfterViewInit() {
        this.translateService.get('msg.script-remove', { value: this.script.name }).subscribe((txt: string) => { this.msgRemoveScript = txt });
        // this.codemirrorComponent.codeMirror.setSize(null, '80%');
    }
    
    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.dialogRef.close(this.script);
    }

    getParameters() {
        return '';
        // return 'adfasd asdf asasdfasd asdf asdf asdfasdf asdf asdf df asdf asdf asdfdasf asdfasd fasdf df asdf asdf asdf asdfffffffffffffffffffffff asdfasdfasdf asdfasdfasf asfasfaf';
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
        this.translateService.get(title).subscribe((txt: string) => { title = txt });
        this.translateService.get(label).subscribe((txt: string) => { label = txt });
        let dialogRef = this.dialog.open(EditNameComponent, {
            position: { top: '60px' },
            data: { name: this.script.name, title: title, label: label }
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
            data: { name: this.script.name, exist: exist }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result && result.name && result.type) {
                this.parameters.push(result);
            }
        });
    }

    onRemoveParameter(index) {
        this.parameters.splice(index, 1);
    }

    // onAddFunctionTag() {
    //     let dialogRef = this.dialog.open(DeviceTagDialog, {
    //         position: { top: '60px' },
    //         data: { variableId: null, devices: this.data.devices, multiSelection: true }
    //     });

    //     dialogRef.afterClosed().subscribe((result) => {
    //         if (result) {
    //             let tagsId = [];
    //             if (result.variablesId) {
    //                 tagsId = result.variablesId;
    //             } else if (result.variableId) {
    //                 tagsId.push(result.variableId);
    //             }
    //             tagsId.forEach(id => {
    //                 let device = DevicesUtils.getDeviceFromTagId(this.data.devices, id);
    //                 let tag = DevicesUtils.getTagFromTagId([device], id);
    //                 if (tag) {
    //                     let exist = chart.lines.find(line => line.id === tag.id)
    //                     if (!exist) {
    //                         const myCopiedObject: ChartLine = {id: tag.id, name: this.getTagLabel(tag), device: device.name, color: this.getNextColor(), 
    //                             label: this.getTagLabel(tag), yaxis: 1 };
    //                         chart.lines.push(myCopiedObject);
    //                     }
    //                 }
    //             });
    //         }
    //     });
    // }
}

@Component({
    selector: 'dlg-sript-param',
    templateUrl: 'param.dialog.html',
})
export class DialogScriptParam {
    paramType = ScriptParamType;
    constructor(public dialogRef: MatDialogRef<DialogScriptParam>,
        private translateService: TranslateService,
        @Inject(MAT_DIALOG_DATA) public data: any) { 
        Object.keys(this.paramType).forEach(key => {
            this.translateService.get(this.paramType[key]).subscribe((txt: string) => {this.paramType[key] = txt});
        });
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    isValid(name): boolean {
        if (!this.data.type) return false;
        if (!this.data.name) return false;
        return (this.data.exist.find((n) => n === name)) ? false : true;
    }
}