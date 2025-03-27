import { Component, OnInit } from '@angular/core';
import { Language, Languages } from '../../_models/language';
import { AbstractControl, FormArray, FormGroup, UntypedFormBuilder, UntypedFormGroup, ValidationErrors, Validators } from '@angular/forms';
import { MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';
import { ProjectService } from '../../_services/project.service';

@Component({
    selector: 'app-language-type-property',
    templateUrl: './language-type-property.component.html',
    styleUrls: ['./language-type-property.component.scss']
})
export class LanguageTypePropertyComponent implements OnInit {

    languagesForm: UntypedFormGroup;

    constructor(
        public dialogRef: MatDialogRef<LanguageTypePropertyComponent>,
        private fb: UntypedFormBuilder,
        private projectService: ProjectService) {
    }

    ngOnInit(): void {
        const languages = this.projectService.getLanguages();
        this.languagesForm = this.fb.group({
            languages: this.fb.array([], this.uniqueLanguageIdValidator),
            defaultId: [languages.default?.id || 'EN', [Validators.required, Validators.pattern('^[A-Za-z]{2}$')]],
            defaultName: [languages.default?.name || 'English', Validators.required]
        });

        this.setLanguages(languages.options);
    }

    get languages(): FormArray {
        return this.languagesForm?.get('languages') as FormArray || new FormArray([]);
    }

    setLanguages(langs: Language[]): void {
        const languagesArray = this.languagesForm.get('languages') as FormArray;
        langs.forEach(lang => {
            languagesArray.push(this.createLanguageForm(lang));
        });
    }

    createLanguageForm(lang?: Language): FormGroup {
        return this.fb.group({
            id: [lang?.id || '', [Validators.required, Validators.pattern('^[A-Za-z]{2}$')]],
            name: [lang?.name || '', Validators.required]
        });
    }

    uniqueLanguageIdValidator(control: AbstractControl): ValidationErrors | null {
        const formArray = control as FormArray;
        const ids = formArray.controls.map(group => group.get('id')?.value?.toLowerCase());
        const hasDuplicates = ids.some((id, index) => id && ids.indexOf(id) !== index);
        return hasDuplicates ? { duplicateId: true } : null;
    }

    onAddLanguage(): void {
        this.languages.push(this.createLanguageForm());
    }

    onRemoveLanguage(index: number): void {
        this.languages.removeAt(index);
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.dialogRef.close(<Languages> {
            options: <Language[]>this.languagesForm.getRawValue().languages,
            default: {
                id: this.languagesForm.get('defaultId').value,
                name: this.languagesForm.get('defaultName').value
            }
        });
    }
}
