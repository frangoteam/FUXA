import { NgModule } from '@angular/core';
import { MatSelectSearchComponent } from './mat-select-search.component';
import { MatLegacyButtonModule as MatButtonModule } from '@angular/material/legacy-button';
import { MatLegacyInputModule as MatInputModule } from '@angular/material/legacy-input';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';

@NgModule({
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatInputModule
    ],
    declarations: [
        MatSelectSearchComponent
    ],
    exports: [
        MatButtonModule,
        MatInputModule,
        MatSelectSearchComponent
    ]
})
export class MatSelectSearchModule { }
