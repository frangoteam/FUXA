import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxTouchKeyboardModule } from './ngx-touch-keyboard/ngx-touch-keyboard.module';
import { JsonTooltipDirective } from './directives/json-tooltip';
import { MatTooltipModule as MatTooltipModule } from '@angular/material/tooltip';
import { FileUploadComponent } from './file-upload/file-upload.component';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { IconSelectorComponent } from './icon-selector/icon-selector.component';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  declarations: [
    JsonTooltipDirective,
    FileUploadComponent,
    IconSelectorComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    NgxTouchKeyboardModule,
    MatTooltipModule,
    MatIconModule,
    MatSelectModule,
    MatInputModule,
    TranslateModule
  ],
  exports: [
    NgxTouchKeyboardModule,
    JsonTooltipDirective,
    FileUploadComponent,
    IconSelectorComponent
  ],

})
export class FrameworkModule { }
