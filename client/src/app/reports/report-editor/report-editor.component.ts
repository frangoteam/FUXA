import { AfterViewInit, Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { TranslateService } from '@ngx-translate/core';
import { Report, ReportSchedulingType } from '../../_models/report';

import { PDFDocument } from 'pdfkit';
@Component({
    selector: 'app-report-editor',
    templateUrl: './report-editor.component.html',
    styleUrls: ['./report-editor.component.css']
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
            name: [this.report.name, Validators.required],
            receiver: [this.report.receiver, Validators.email],
            scheduling: [this.report.scheduling]
        });
    }

    ngOnInit() {
        Object.keys(this.schedulingType).forEach(key => {
            this.translateService.get(this.schedulingType[key]).subscribe((txt: string) => { this.schedulingType[key] = txt });
        });
    }

    ngAfterViewInit() {
        var iframe = document.querySelector('iframe');
        let blob = new Blob([''], { type: 'application/pdf' });
        this.makePDF(PDFDocument, blob, 'asdf', iframe);
    }
    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.report = this.myForm.value;
        if (this.data.editmode < 0) {
            this.dialogRef.close(this.report);
        } else if (this.checkValid()) {
            this.dialogRef.close(this.report);
        }
    }

    checkValid() {
        return this.myForm.valid;
    }

    makePDF(PDFDocument, blobStream, lorem, iframe) {
        // create a document and pipe to a blob
        var doc = new PDFDocument();
        var stream = doc.pipe(blobStream());

        // draw some text
        doc.fontSize(25).text('Here is some vector graphics...', 100, 80);

        // some vector graphics
        doc
            .save()
            .moveTo(100, 150)
            .lineTo(100, 250)
            .lineTo(200, 250)
            .fill('#FF3300');

        doc.circle(280, 200, 50).fill('#6600FF');

        // an SVG path
        doc
            .scale(0.6)
            .translate(470, 130)
            .path('M 250,75 L 323,301 131,161 369,161 177,301 z')
            .fill('red', 'even-odd')
            .restore();

        doc.save();
        // a gradient fill
        var gradient = doc
            .linearGradient(100, 300, 200, 300)
            .stop(0, 'green')
            .stop(0.5, 'red')
            .stop(1, 'green');
        doc.rect(100, 300, 100, 100).fill(gradient);

        // stroke & fill uncolored tiling pattern

        var stripe45d = doc.pattern(
            [1, 1, 4, 4],
            3,
            3,
            '1 w 0 1 m 4 5 l s 2 0 m 5 3 l s'
        );
        doc.circle(280, 350, 50).fill([stripe45d, 'blue']);

        doc
            .rect(380, 300, 100, 100)
            .fillColor('lime')
            .strokeColor([stripe45d, 'orange'])
            .lineWidth(5)
            .fillAndStroke();
        doc.restore();

        // and some justified text wrapped into columns
        doc
            .text('And here is some wrapped text...', 100, 450)
            .font('Times-Roman', 13)
            .moveDown()
            .text(lorem, {
                width: 412,
                align: 'justify',
                indent: 30,
                columns: 2,
                height: 300,
                ellipsis: true
            });

        // end and display the document in the iframe to the right
        doc.end();
        stream.on('finish', function () {
            iframe.src = stream.toBlobURL('application/pdf');
        });
    }
}
