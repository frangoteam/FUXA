import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { BrowserAnimationsModule, NoopAnimationsModule } from '@angular/platform-browser/animations';
import {
  MatButtonModule, MatFormFieldModule, MatInputModule, MatSelect,
  MatSelectModule
} from '@angular/material';
import { ReplaySubject } from 'rxjs/ReplaySubject';
import { Subject } from 'rxjs/Subject';
import { take, takeUntil } from 'rxjs/operators';

import { MatSelectSearchComponent } from './mat-select-search.component';


interface Bank {
  id: string;
  name: string;
}

@Component({
  selector: 'mat-select-search-test',
  template: `
    <mat-form-field>
      <mat-select [formControl]="bankCtrl">
        <mat-select-search [formControl]="bankFilterCtrl"></mat-select-search>
        <mat-option *ngFor="let bank of filteredBanks | async" [value]="bank.id">
          {{bank.name}}
        </mat-option>
      </mat-select>
    </mat-form-field>
  `,
})
export class MatSelectSearchTestComponent implements OnInit, OnDestroy {

  @ViewChild(MatSelect) matSelect: MatSelect;
  @ViewChild(MatSelectSearchComponent) matSelectSearch: MatSelectSearchComponent;

  // control for the selected bank
  public bankCtrl: FormControl = new FormControl();
  // control for the MatSelect filter keyword
  public bankFilterCtrl: FormControl = new FormControl();

  // list of banks
  private banks: Bank[] = [{name: 'Bank A', id: 'A'}, {name: 'Bank B', id: 'B'}, {name: 'Bank C', id: 'C'}, {name: 'Bank DC', id: 'DC'}];

  public filteredBanks: ReplaySubject<Bank[]> = new ReplaySubject<Bank[]>(1);

  // Subject that emits when the component has been destroyed.
  private _onDestroy = new Subject<void>();

  ngOnInit() {
    // load the initial bank list
    this.filteredBanks.next(this.banks.slice());
    // listen for search field value changes
    this.bankFilterCtrl.valueChanges
      .pipe(takeUntil(this._onDestroy))
      .subscribe(() => {
        this.filterBanks();
      });
  }

  ngOnDestroy() {
    this._onDestroy.next();
    this._onDestroy.complete();
  }

  private filterBanks() {
    if (!this.banks) {
      return;
    }

    // get the search keyword
    let search = this.bankFilterCtrl.value;
    if (!search) {
      this.filteredBanks.next(this.banks.slice());
      return;
    } else {
      search = search.toLowerCase();
    }

    // filter the banks
    this.filteredBanks.next(
      this.banks.filter(bank => bank.name.toLowerCase().indexOf(search) > -1)
    );
  }
}

describe('MatSelectSearchComponent', () => {
  let component: MatSelectSearchTestComponent;
  let fixture: ComponentFixture<MatSelectSearchTestComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        CommonModule,
        NoopAnimationsModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatSelectModule,
        MatButtonModule,
        MatInputModule
      ],
      declarations: [MatSelectSearchComponent, MatSelectSearchTestComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MatSelectSearchTestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show a search field and focus it when opening the select', (done) => {

    component.filteredBanks
      .pipe(take(1))
      .subscribe(() => {
        // when the filtered banks are initialized
        fixture.detectChanges();

        component.matSelect.open();
        fixture.detectChanges();

        component.matSelect.openedChange
          .pipe(take(1))
          .subscribe((opened) => {
            expect(opened).toBe(true);
            const searchField = document.querySelector('.cdk-overlay-pane-select-search .mat-select-search-inner .mat-select-search-input');
            const searchInner = document.querySelector('.cdk-overlay-pane-select-search .mat-select-search-inner');
            expect(searchInner).toBeTruthy();
            expect(searchField).toBeTruthy();
            // check focus
            expect(searchField).toBe(document.activeElement);

            const optionElements = document.querySelectorAll('.cdk-overlay-pane-select-search mat-option');
            expect(component.matSelect.options.length).toBe(4);
            expect(optionElements.length).toBe(4);

            done();
          });

      });

  });

  it('should filter the options available and hightlight the first option in the list, filter the options by input "c" and reset the list', (done) => {

    component.filteredBanks
      .pipe(take(1))
      .subscribe(() => {
        // when the filtered banks are initialized
        fixture.detectChanges();

        component.matSelect.open();
        fixture.detectChanges();

        component.matSelect.openedChange
          .pipe(take(1))
          .subscribe((opened) => {
            expect(opened).toBe(true);
            const searchField = document.querySelector('.cdk-overlay-pane-select-search .mat-select-search-inner .mat-select-search-input');
            expect(searchField).toBeTruthy();

            expect(component.matSelect.options.length).toBe(4);

            // search for "c"
            component.matSelectSearch.onInputChange('c');
            fixture.detectChanges();

            expect(component.bankFilterCtrl.value).toBe('c');
            expect(component.matSelect.panelOpen).toBe(true);

            component.filteredBanks
              .pipe(take(1))
              .subscribe(() => {
                fixture.detectChanges();

                setTimeout(() => {
                  expect(component.matSelect.options.length).toBe(2);
                  expect(component.matSelect.options.first.value).toBe('C');
                  expect(component.matSelect.options.first.active).toBe(true, 'first active');

                  component.matSelectSearch._reset(true);
                  fixture.detectChanges();

                  // check focus
                  expect(searchField).toBe(document.activeElement);
                  expect(component.matSelect.panelOpen).toBe(true);

                  component.filteredBanks
                    .pipe(take(1))
                    .subscribe(() => {
                      fixture.detectChanges();
                      expect(component.matSelect.options.length).toBe(4);

                      done();
                    });
                });

              });

          });

      });

  });

});
