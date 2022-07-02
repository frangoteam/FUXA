import { AfterViewInit, Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { TranslateService } from '@ngx-translate/core';
import { Report, ReportSchedulingType } from '../../_models/report';
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";  
pdfMake.vfs = pdfFonts.pdfMake.vfs;   

@Component({
    selector: 'app-report-editor',
    templateUrl: './report-editor.component.html',
    styleUrls: ['./report-editor.component.scss']
})
export class ReportEditorComponent implements OnInit, AfterViewInit {

    myForm: FormGroup;

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
        // this.makePDF(PDFDocument, blob, 'asdf', iframe);
        this.onReportChanged();
    }
    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.report = {...this.report, ...this.myForm.value};

        if (this.data.editmode < 0) {
            this.dialogRef.close(this.report);
        } else if (this.checkValid()) {
            this.dialogRef.close(this.report);
        }
    }

    checkValid() {
        return this.myForm.valid;
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
        docDefinition['content'] = 'Sample PDF generated with Angular and PDFMake';
        return docDefinition;
    }
}
