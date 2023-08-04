import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MyFileService, TransferResult } from '../../_services/my-file.service';
import { ToastNotifierService } from '../../_services/toast-notifier.service';

@Component({
  selector: 'app-file-upload',
  templateUrl: './file-upload.component.html',
  styleUrls: ['./file-upload.component.scss']
})
export class FileUploadComponent {

  @Input() fileName: string;
  @Input() destination: string;
  @Output() onFileChange: EventEmitter<File> = new EventEmitter<File>();

  selectedFile: File;

  constructor(private fileService: MyFileService,
              private toastNotifier: ToastNotifierService) {
  }

  onChange(event: any) {
    this.selectedFile = event.target.files[0];
    this.fileService.upload(this.selectedFile, this.destination).subscribe((result: TransferResult) => {
      if (!result.result) {
        this.toastNotifier.notifyError('msg.file-upload-failed', result.error);
      } else {
        this.onFileChange.emit(this.selectedFile);
        this.fileName = this.selectedFile.name;
      }
    });
  }

  removeFile() {
    this.selectedFile = null;
    this.onFileChange.emit(this.selectedFile);
    this.fileName = null;
  }
}
