import { AfterViewInit, Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { TranslateService } from '@ngx-translate/core';
import { Report, ReportItem, ReportItemTable, ReportItemText, ReportItemType, ReportSchedulingType } from '../../_models/report';
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";  
import { Utils } from '../../_helpers/utils';
import { ReportItemTextComponent } from './report-item-text/report-item-text.component';
import { ReportItemTableComponent } from './report-item-table/report-item-table.component';
pdfMake.vfs = pdfFonts.pdfMake.vfs;   

@Component({
    selector: 'app-report-editor',
    templateUrl: './report-editor.component.html',
    styleUrls: ['./report-editor.component.scss']
})
export class ReportEditorComponent implements OnInit, AfterViewInit {

    myForm: FormGroup;

    itemTextType = Utils.getEnumKey(ReportItemType, ReportItemType.text);
    itemTableType = Utils.getEnumKey(ReportItemType, ReportItemType.table);
    report: Report;
    schedulingType = ReportSchedulingType;

    constructor(public dialogRef: MatDialogRef<ReportEditorComponent>,
        public dialog: MatDialog,
        private fb: FormBuilder,
        private translateService: TranslateService,
        @Inject(MAT_DIALOG_DATA) public data: any) {

        this.report = data.report;
        this.myForm = this.fb.group({
            id: [this.report.id, Validators.required],
            name: [this.report.name, Validators.required],
            receiver: [this.report.receiver],
            scheduling: [this.report.scheduling]
        });
    }

    ngOnInit() {
        Object.keys(this.schedulingType).forEach(key => {
            this.translateService.get(this.schedulingType[key]).subscribe((txt: string) => { this.schedulingType[key] = txt });
        });
    }

    ngAfterViewInit() {
        this.onReportChanged();
        this.myForm.markAsPristine();
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.report = {...this.report, ...this.myForm.value};

        if (this.data.editmode < 0) {
            this.dialogRef.close(this.report);
        } else if (this.myForm.valid) {
            this.dialogRef.close(this.report);
        }
    }

    onReportChanged() {
        const pdfDocGenerator = pdfMake.createPdf(this.getPdfContent(this.report));
        pdfDocGenerator.getDataUrl((dataUrl) => {
            const targetIframe = document.querySelector('iframe');
            targetIframe.src = dataUrl;
            targetIframe.style.width = '100%';
            targetIframe.style.height = '100%';
        });
    }

    getPdfContent(report: Report)  {
        let docDefinition = {...report.docproperty };
        docDefinition['header'] = 'FUXA by frangoteam';
        docDefinition['content'] = [];
        report.content.items.forEach((item: ReportItem) => {
            if (item.type === this.itemTextType) {
                const itemText = <ReportItemText>item;
                docDefinition['content'].push({ text: itemText.text });
            }
        });
        return docDefinition;
    }

    onAddItem(type: ReportItemType, index: number, edit: boolean) {
        let item = <ReportItem>{ type: type };
        if (type === this.itemTextType) {
            item = {...item, ...<ReportItemText> { text: '' }};
        } else if (type === this.itemTableType) {
            item = {...item, ...<ReportItemTable> {
                tags: []
            }};
        }
        this.onEditItem(item, index, edit);
    }

    onEditItem(item: ReportItem, index: number, edit: boolean) {
        let dialogRef = null;
        const dlgconfig = {
            data: JSON.parse(JSON.stringify(item)),
            position: { top: '60px' }
        };

        if (item.type === this.itemTableType) {
            dialogRef = this.dialog.open(ReportItemTableComponent, dlgconfig);
        } else  {
            dialogRef = this.dialog.open(ReportItemTextComponent, dlgconfig);
        }


        dialogRef.afterClosed().subscribe(result => {    
            if (result) {
                if (index <= this.report.content.items.length) {
                    if (edit) {
                        this.report.content.items.splice(index, 1, result);
                    } else {
                        this.report.content.items.splice(index, 0, result);
                    }
                } else {
                    this.report.content.items.push(result);
                }
                this.onReportChanged();
            }
        });
    }

    onDeleteItem(index: number) {
        this.report.content.items.splice(index, 1);
        this.onReportChanged();
    }
}
