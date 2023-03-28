import {
    AfterViewInit,
    ChangeDetectionStrategy, ChangeDetectorRef,
    Component, ElementRef, EventEmitter, forwardRef, Inject, Input, OnDestroy, OnInit, QueryList,
    ViewChild
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatSelect } from '@angular/material/select';
import { MatOption } from '@angular/material/core';
import { Subject } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';

/**
 * Component providing an input field for searching MatSelect options.
 *
 * Example usage:
 *
 * interface Bank {
 *  id: string;
 *  name: string;
 * }
 *
 * @Component({
 *   selector: 'my-app-data-selection',
 *   template: `
 *     <mat-form-field>
 *       <mat-select [formControl]="bankCtrl" placeholder="Bank">
 *         <mat-select-search [formControl]="bankFilterCtrl"></mat-select-search>
 *         <mat-option *ngFor="let bank of filteredBanks | async" [value]="bank.id">
 *           {{bank.name}}
 *         </mat-option>
 *       </mat-select>
 *     </mat-form-field>
 *   `
 * })
 * export class DataSelectionComponent implements OnInit, OnDestroy {
 *
 *   // control for the selected bank
 *   public bankCtrl: FormControl = new FormControl();
 *   // control for the MatSelect filter keyword
 *   public bankFilterCtrl: FormControl = new FormControl();
 *
 *   // list of banks
 *   private banks: Bank[] = [{name: 'Bank A', id: 'A'}, {name: 'Bank B', id: 'B'}, {name: 'Bank C', id: 'C'}];
 *   // list of banks filtered by search keyword
 *   public filteredBanks: ReplaySubject<Bank[]> = new ReplaySubject<Bank[]>(1);
 *
 *   // Subject that emits when the component has been destroyed.
 *   private _onDestroy = new Subject<void>();
 *
 *
 *   ngOnInit() {
 *     // load the initial bank list
 *     this.filteredBanks.next(this.banks.slice());
 *     // listen for search field value changes
 *     this.bankFilterCtrl.valueChanges
 *       .pipe(takeUntil(this._onDestroy))
 *       .subscribe(() => {
 *         this.filterBanks();
 *       });
 *   }
 *
 *   ngOnDestroy() {
 *     this._onDestroy.next();
 *     this._onDestroy.complete();
 *   }
 *
 *   private filterBanks() {
 *     if (!this.banks) {
 *       return;
 *     }
 *
 *     // get the search keyword
 *     let search = this.bankFilterCtrl.value;
 *     if (!search) {
 *       this.filteredBanks.next(this.banks.slice());
 *       return;
 *     } else {
 *       search = search.toLowerCase();
 *     }
 *
 *     // filter the banks
 *     this.filteredBanks.next(
 *       this.banks.filter(bank => bank.name.toLowerCase().indexOf(search) > -1)
 *     );
 *   }
 * }
 */
@Component({
    selector: 'mat-select-search',
    templateUrl: './mat-select-search.component.html',
    styleUrls: ['./mat-select-search.component.scss'],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => MatSelectSearchComponent),
            multi: true
        }
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MatSelectSearchComponent implements OnInit, OnDestroy, AfterViewInit, ControlValueAccessor {

    /** Label of the search placeholder */
    @Input() placeholderLabel = '';

    /** Label to be shown when no entries are found. Set to null if no message should be shown. */
    @Input() noEntriesFoundLabel = '';

    /** Reference to the search input field */
    @ViewChild('searchSelectInput', { read: ElementRef, static: true }) searchSelectInput: ElementRef;

    /** Current search value */
    get value(): string {
        return this._value;
    }
    private _value: string;

    onChange: Function = (_: any) => { };
    onTouched: Function = (_: any) => { };

    /** Reference to the MatSelect options */
    public _options: QueryList<MatOption>;

    /** Previously selected values when using <mat-select [multiple]="true">*/
    private previousSelectedValues: any[];

    /** Whether the backdrop class has been set */
    private overlayClassSet = false;

    /** Event that emits when the current value changes */
    private change = new EventEmitter<string>();

    /** Subject that emits when the component has been destroyed. */
    private _onDestroy = new Subject<void>();


    constructor(@Inject(MatSelect) public matSelect: MatSelect,
        private translateService: TranslateService,
        private changeDetectorRef: ChangeDetectorRef) {
    }

    ngOnInit() {
        // set custom panel class
        const panelClass = 'mat-select-search-panel';
        if (this.matSelect.panelClass) {
            if (Array.isArray(this.matSelect.panelClass)) {
                this.matSelect.panelClass.push(panelClass);
            } else if (typeof this.matSelect.panelClass === 'string') {
                this.matSelect.panelClass = [this.matSelect.panelClass, panelClass];
            } else if (typeof this.matSelect.panelClass === 'object') {
                this.matSelect.panelClass[panelClass] = true;
            }
        } else {
            this.matSelect.panelClass = panelClass;
        }

        // when the select dropdown panel is opened or closed
        this.matSelect.openedChange
            .pipe(takeUntil(this._onDestroy))
            .subscribe((opened) => {
                if (opened) {
                    // focus the search field when opening
                    this._focus();
                } else {
                    // clear it when closing
                    this._reset();
                }
            });

        // set the first item active after the options changed
        this.matSelect.openedChange
            .pipe(take(1))
            .pipe(takeUntil(this._onDestroy))
            .subscribe(() => {
                this._options = this.matSelect.options;
                this._options.changes
                    .pipe(takeUntil(this._onDestroy))
                    .subscribe(() => {
                        const keyManager = this.matSelect._keyManager;
                        if (keyManager && this.matSelect.panelOpen) {
                            // avoid "expression has been changed" error
                            setTimeout(() => {
                                keyManager.setFirstItemActive();
                            });
                        }
                    });
            });

        // detect changes when the input changes
        this.change
            .pipe(takeUntil(this._onDestroy))
            .subscribe(() => {
                this.changeDetectorRef.detectChanges();
            });

        this.initMultipleHandling();
    }

    ngOnDestroy() {
        this._onDestroy.next();
        this._onDestroy.complete();
    }

    ngAfterViewInit() {
        this.setOverlayClass();
        this.translateService.get('general.search').subscribe((txt: string) => { this.placeholderLabel = txt; });
        this.translateService.get('general.search-notfound').subscribe((txt: string) => { this.noEntriesFoundLabel = txt; });
    }

    /**
     * Handles the key down event with MatSelect.
     * Allows e.g. selecting with enter key, navigation with arrow keys, etc.
     * @param {KeyboardEvent} event
     * @private
     */
    _handleKeydown(event: KeyboardEvent) {
        if (event.keyCode === 32) {
            // do not propagate spaces to MatSelect, as this would select the currently active option
            event.stopPropagation();
        }

    }


    writeValue(value: string) {
        const valueChanged = value !== this._value;
        if (valueChanged) {
            this._value = value;
            this.change.emit(value);
        }
    }

    onInputChange(value) {
        const valueChanged = value !== this._value;
        if (valueChanged) {
            this._value = value;
            this.onChange(value);
            this.change.emit(value);
        }
    }

    onBlur(value: string) {
        this.writeValue(value);
        this.onTouched();
    }

    registerOnChange(fn: Function) {
        this.onChange = fn;
    }

    registerOnTouched(fn: Function) {
        this.onTouched = fn;
    }

    /**
     * Focuses the search input field
     * @private
     */
    public _focus() {
        if (!this.searchSelectInput) {
            return;
        }
        // save and restore scrollTop of panel, since it will be reset by focus()
        // note: this is hacky
        const panel = this.matSelect.panel.nativeElement;
        const scrollTop = panel.scrollTop;

        // focus
        this.searchSelectInput.nativeElement.focus();

        panel.scrollTop = scrollTop;
    }

    /**
     * Resets the current search value
     * @param {boolean} focus whether to focus after resetting
     * @private
     */
    public _reset(focus?: boolean) {
        if (!this.searchSelectInput) {
            return;
        }
        this.searchSelectInput.nativeElement.value = '';
        this.onInputChange('');
        if (focus) {
            this._focus();
        }
    }

    /**
     * Sets the overlay class  to correct offsetY
     * so that the selected option is at the position of the select box when opening
     */
    private setOverlayClass() {
        if (this.overlayClassSet) {
            return;
        }

        const overlayClass = 'cdk-overlay-pane-select-search';

        this.matSelect.openedChange
            .pipe(takeUntil(this._onDestroy))
            .subscribe((opened: boolean) => {
                if (opened) {
                // note: this is hacky, but currently there is no better way to do this
                let element: HTMLElement = this.searchSelectInput.nativeElement;
                let overlayElement: HTMLElement;
                while (element = element.parentElement) {
                    if (element.classList.contains('cdk-overlay-pane')) {
                    overlayElement = element;
                    break;
                    }
                }
                if (overlayElement) {
                    overlayElement.classList.add(overlayClass);
                }
                }
            });

        this.overlayClassSet = true;
    }


    /**
     * Initializes handling <mat-select [multiple]="true">
     * Note: to improve this code, mat-select should be extended to allow disabling resetting the selection while filtering.
     */
    private initMultipleHandling() {
        // if <mat-select [multiple]="true">
        // store previously selected values and restore them when they are deselected
        // because the option is not available while we are currently filtering
        this.matSelect.valueChange
            .pipe(takeUntil(this._onDestroy))
            .subscribe((values) => {
                if (this.matSelect.multiple) {
                    let restoreSelectedValues = false;
                    if (this._value && this._value.length
                        && this.previousSelectedValues && Array.isArray(this.previousSelectedValues)) {
                        if (!values || !Array.isArray(values)) {
                            values = [];
                        }
                        const optionValues = this.matSelect.options.map(option => option.value);
                        this.previousSelectedValues.forEach(previousValue => {
                            if (values.indexOf(previousValue) === -1 && optionValues.indexOf(previousValue) === -1) {
                                // if a value that was selected before is deselected and not found in the options, it was deselected
                                // due to the filtering, so we restore it.
                                values.push(previousValue);
                                restoreSelectedValues = true;
                            }
                        });
                    }

                    if (restoreSelectedValues) {
                        this.matSelect._onChange(values);
                    }

                    this.previousSelectedValues = values;
                }
            });
    }

}
