import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxTouchKeyboardModule } from './ngx-touch-keyboard/ngx-touch-keyboard.module';

@NgModule({
  imports: [
    CommonModule,
    NgxTouchKeyboardModule
  ],
  exports: [
    NgxTouchKeyboardModule
  ],

})
export class FrameworkModule { }
