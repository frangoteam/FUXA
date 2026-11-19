/* eslint-disable @angular-eslint/component-class-suffix */
import { Component, OnInit, Inject } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

import { TranslateService } from '@ngx-translate/core';
import { ProjectService } from '../../_services/project.service';

import { Utils } from '../../_helpers/utils';
import { RepeaterData, RepeaterDataLine, RepeaterDataType, RepeaterSourceType, RepeaterDaqNode, RepeaterUtils } from '../../_models/repeater';
import { ConfirmDialogComponent } from '../../gui-helpers/confirm-dialog/confirm-dialog.component';
import { EditNameComponent } from '../../gui-helpers/edit-name/edit-name.component';

@Component({
  selector: 'app-repeater-config',
  templateUrl: './repeater-config.component.html',
  styleUrls: ['./repeater-config.component.scss']
})
export class RepeaterConfigComponent implements OnInit {

    selectedRepeaterData = <RepeaterData>{ id: null, name: null, lines: [] };
    data = <IDataRepeaterDataConfig>{ repeaters: [] };

    constructor(
        public dialog: MatDialog,
        public dialogRef: MatDialogRef<RepeaterConfigComponent>,
        private translateService: TranslateService,
        private projectService: ProjectService
        ) {
            this.loadData();
    }

    ngOnInit() {
    }

    loadData() {
        this.data.repeaters = JSON.parse(JSON.stringify(this.projectService.getRepeaters()));
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.projectService.setRepeaters(this.data.repeaters);
        this.dialogRef.close(<IDataRepeaterDataResult> { repeaters: this.data.repeaters, selected: this.selectedRepeaterData });
    }

    onRemoveRepeaterData(index: number) {
        let msg = '';
        this.translateService.get('msg.repeater-remove', { value: this.data.repeaters[index].name }).subscribe((txt: string) => { msg = txt; });
        let dialogRef = this.dialog.open(ConfirmDialogComponent, {
            data: { msg: msg },
            position: { top: '60px' }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.data.repeaters.splice(index, 1);
                this.selectedRepeaterData = { id: null, name: null, lines: [] };
            }
        });
    }

    onSelectRepeaterData(item: RepeaterData) {
        this.selectedRepeaterData = item;
    }

    isRepeaterDataSelected(item: RepeaterData) {
        if (item === this.selectedRepeaterData) {
            return 'mychips-selected';
        }
    }

    isCsv(line: RepeaterDataLine): boolean {
        return RepeaterUtils.isCsv(line);
    }

    /** the selected Repeater data has DB lines: the list shows SQL and Type, without the URL columns */
    isDbSelected(): boolean {
        const lines = this.selectedRepeaterData?.lines || [];
        return lines.length > 0 && lines.every(line => RepeaterUtils.isDb(line));
    }

    isDb(line: RepeaterDataLine): boolean {
        return RepeaterUtils.isDb(line);
    }

    hasRepeaterDataLines(item: RepeaterData){
        if (item === this.selectedRepeaterData) {
            if (item.lines) {
                if (item.lines.length > 0) {
                    return true;
                }
            }
        }
        return false;       
    }

    onEditRepeaterData(repeater: RepeaterData) {
        let title = 'dlg.item-title';
        let label = 'dlg.item-name';
        let error = 'dlg.item-name-error';
        let exist = this.data.repeaters.map((r) => { if (!repeater || repeater.name !== r.name) {return r.name;} });
        this.translateService.get(title).subscribe((txt: string) => { title = txt; });
        this.translateService.get(label).subscribe((txt: string) => { label = txt; });
        this.translateService.get(error).subscribe((txt: string) => { error = txt; });
        let dialogRef = this.dialog.open(EditNameComponent, {
            position: { top: '60px' },
            data: { name: (repeater) ? repeater.name : '', title: title, label: label, exist: exist, error: error }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result && result.name && result.name.length > 0) {
                if (repeater) {
                    repeater.name = result.name;
                } else {
                    let repeater = <RepeaterData>{ id: Utils.getShortGUID(), name: result.name, lines: [] };
                    this.data.repeaters.push(repeater);
                    this.onSelectRepeaterData(repeater);
                }
            }
        });
    }

    onAddRepeaterDataLine(repeater: RepeaterData) {
        let dialogRef = this.dialog.open(DialogRepeaterDataLine, {
            position: { top: '60px' },
            data:  <RepeaterDataLine>{ id: Utils.getShortGUID(), name: '', type: RepeaterSourceType.url, daq: null, sql: '', url: '', url_data_type: RepeaterDataType.json, url_data_properties: '', url_data_path: '' }
        });

        dialogRef.afterClosed().subscribe((result) => {
            if (result) {
                this.selectedRepeaterData.lines.push(result);
            }
        });
    }

    editRepeaterDataLine(line: RepeaterDataLine) {
        let dialogRef = this.dialog.open(DialogRepeaterDataLine, {
            position: { top: '60px' },
            data: <RepeaterDataLine>{ id: line.id || Utils.getShortGUID(), name: line.name, type: RepeaterUtils.isDb(line) ? RepeaterSourceType.db : RepeaterSourceType.url,
                daq: line.daq ?? null, sql: line.sql ?? '', url: line.url, url_data_type: RepeaterUtils.isCsv(line) ? RepeaterDataType.csv : RepeaterDataType.json, url_data_properties: line.url_data_properties, url_data_path: line.url_data_path }
        });
        dialogRef.afterClosed().subscribe((result:RepeaterDataLine) => {
            if (result) {
                line.id = result.id;
                line.name = result.name;
                line.type = result.type;
                line.daq = result.type === RepeaterSourceType.db ? result.daq : undefined;
                line.sql = result.type === RepeaterSourceType.db ? result.sql : undefined;
                line.url = result.url;
                line.url_data_type = result.url_data_type;
                line.url_data_properties = result.url_data_properties;
                line.url_data_path = result.url_data_path;
            }
        });
    }

    removeRepeaterDataLine(tag) {
        for (let i = 0; i < this.selectedRepeaterData.lines.length; i++) {
            if (this.selectedRepeaterData.lines[i].id === tag.id) {
                this.selectedRepeaterData.lines.splice(i, 1);
                break;
            }
        }
    }

}

@Component({
    selector: 'dialog-repeater-line',
    templateUrl: './repeater-line.dialog.html',
    styleUrls: ['./repeater-config.component.scss']
})
export class DialogRepeaterDataLine {

    daqNodes: RepeaterDaqNode[] = [];
    daqError = '';

    constructor(
        public dialogRef: MatDialogRef<DialogRepeaterDataLine>,
        @Inject(MAT_DIALOG_DATA) public data: any) {
        RepeaterUtils.getDaqNodes().subscribe({
            next: nodes => this.daqNodes = nodes || [],
            error: err => this.daqError = err?.error?.message || err?.message || 'DAQ list not available'
        });
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.dialogRef.close(this.data);
    }
}


interface IDataRepeaterDataConfig {
    repeaters: RepeaterData[];
}

export interface IDataRepeaterDataResult {
    repeaters: RepeaterData[];
    selected: RepeaterData;
}
