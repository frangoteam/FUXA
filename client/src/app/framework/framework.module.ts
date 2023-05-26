import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxTouchKeyboardModule } from './ngx-touch-keyboard/ngx-touch-keyboard.module';
import { JsonTooltipDirective } from './directives/json-tooltip';
import { MatTooltipModule } from '@angular/material/tooltip';

@NgModule({
  declarations: [
    JsonTooltipDirective
  ],
  imports: [
    CommonModule,
    NgxTouchKeyboardModule,
    MatTooltipModule
  ],
  exports: [
    NgxTouchKeyboardModule,
    JsonTooltipDirective
  ],

})
export class FrameworkModule { }
