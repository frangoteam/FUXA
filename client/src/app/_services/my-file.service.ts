import { Injectable } from '@angular/core';
import { UploadFile } from '../_models/project';
import { RcgiService } from './rcgi/rcgi.service';
import { Observable, of } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class MyFileService {

    constructor(private rciService: RcgiService) {

    }

    upload(file: File, destination: string): Observable<TransferResult> {
        if (file) {
            let filename = file.name;
            let fileToUpload = { type: filename.split('.').pop().toLowerCase(), name: filename.split('/').pop(), data: null };
            let reader = new FileReader();

            return new Observable<TransferResult>(observer => {
                reader.onload = () => {
                    try {
                        fileToUpload.data = reader.result;
                        this.rciService.uploadFile(fileToUpload, destination).subscribe((result: UploadFile) => {
                                observer.next({ result: result, error: null });
                                observer.complete();
                            }, (error) => {
                                observer.next({ result: false, error: error.error?.error || error.message });
                                observer.complete();
                            }
                        );
                    } catch (err) {
                        observer.next({ result: false, error: err });
                        observer.complete();
                    }
                };

                reader.readAsDataURL(file);
            });
        } else {
            return of({ result: false, error: null });
        }
    }
}

export interface TransferResult {
    result: any;
    error: any;
}
