import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';

@Injectable({
    providedIn: 'root'
})
export class ToastNotifierService {

    constructor(
        private translateService: TranslateService,
        private toastr: ToastrService) {

    }

    notifyError(msgKey: string, err = '', closeButton = true, disableTimeOut = true) {
        this.translateService.get(msgKey).subscribe((txt: string) => {
            this.toastr.error(`${txt} ${err}`, '', {
                timeOut: 3000,
                closeButton: closeButton,
                disableTimeOut: disableTimeOut
            });
        });
    }

    notifySuccess(msgKey: string, closeButton = false, disableTimeOut = false) {
        this.translateService.get(msgKey).subscribe((txt: string) => {
            this.toastr.success(`${txt}`, '', {
                timeOut: 3000,
                closeButton: closeButton,
                disableTimeOut: disableTimeOut
            });
        });
    }

    toastrRef(): ToastrService {
        return this.toastr;
    }
}
