import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxTouchKeyboardModule } from './ngx-touch-keyboard/ngx-touch-keyboard.module';
import { JsonTooltipDirective } from './directives/json-tooltip';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FileUploadComponent } from './file-upload/file-upload.component';
import { MatIconModule } from '@angular/material/icon';

@NgModule({
  declarations: [
    JsonTooltipDirective,
    FileUploadComponent
  ],
  imports: [
    CommonModule,
    NgxTouchKeyboardModule,
    MatTooltipModule,
    MatIconModule
  ],
  exports: [
    NgxTouchKeyboardModule,
    JsonTooltipDirective,
    FileUploadComponent
  ],

})
export class FrameworkModule { }
