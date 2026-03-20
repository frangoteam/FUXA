import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
    selector: 'app-onboarding-wizard',
    templateUrl: './onboarding-wizard.component.html',
    styleUrls: ['./onboarding-wizard.component.scss']
})
export class OnboardingWizardComponent implements OnInit {

    formGroup: UntypedFormGroup;

    constructor(
        public dialogRef: MatDialogRef<OnboardingWizardComponent>,
        private fb: UntypedFormBuilder,
    ) { }

    ngOnInit() {
        console.log('onboarding wizard init');
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.dialogRef.close();
    }
}
