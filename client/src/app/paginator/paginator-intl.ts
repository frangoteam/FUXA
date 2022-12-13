import { TranslateService } from '@ngx-translate/core';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { Injectable, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Injectable()
export class CustomMatPaginatorIntl extends MatPaginatorIntl implements OnDestroy {
    private ofLabel = 'of';
    private unsubscribe: Subject<void> = new Subject<void>();

    constructor(private translateService: TranslateService) {
        super();

        this.translateService.onLangChange
            .pipe(takeUntil(this.unsubscribe))
            .subscribe(() => {
                this.getAndInitTranslations();
            });

        this.getAndInitTranslations();
    }

    getAndInitTranslations() {
        this.translateService.get([
            'table.property-paginator-items-per-page',
            'table.property-paginator-next-page',
            'table.property-paginator-prev-page',
            'table.property-paginator-of-label'
        ])
            .pipe(takeUntil(this.unsubscribe))
            .subscribe(translation => {
                this.itemsPerPageLabel = translation['table.property-paginator-items-per-page'];
                this.nextPageLabel = translation['table.property-paginator-next-page'];
                this.previousPageLabel = translation['Ptable.property-paginator-prev-page'];
                this.ofLabel = translation['table.property-paginator-of-label'];

                this.changes.next();
            });
    }

    getRangeLabel = (page: number, pageSize: number, length: number) => {
        if (length === 0 || pageSize === 0)
            {return `0 ${this.ofLabel} ${length}`;}

        length = Math.max(length, 0);
        const startIndex = page * pageSize;
        const endIndex = startIndex < length ? Math.min(startIndex + pageSize, length) : startIndex + pageSize;
        return `${startIndex + 1} - ${endIndex} ${this.ofLabel} ${length}`;
    };

    ngOnDestroy() {
        this.unsubscribe.next();
        this.unsubscribe.complete();
    }
}
