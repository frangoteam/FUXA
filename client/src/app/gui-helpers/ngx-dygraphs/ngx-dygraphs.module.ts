import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxDygraphsComponent } from './ngx-dygraphs.component';

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [NgxDygraphsComponent],
  exports: [
    NgxDygraphsComponent
  ]
})
export class NgxDygraphsModule {
    public static forRoot(): ModuleWithProviders {
        return {
            ngModule: NgxDygraphsModule
        };
    }
 }
