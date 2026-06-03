import { Injectable } from '@angular/core';
import { forkJoin, map, Observable, of, switchMap } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { WidgetsResource, WidgetsResourceType } from '../../_models/resources';
import { MyFileService, TransferResult } from '../../_services/my-file.service';

@Injectable({
    providedIn: 'root'
})
export class KioskWidgetsService {

    repoOwner = 'frangoteam';
    repoName = 'FUXA-SVG-Widgets';
    repoBranch = 'main';
    githubApiBaseUrl = `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents`;
    resourceWidgets$: Observable<WidgetsResource[]>;
    widgetAssetBaseUrl = `https://raw.githubusercontent.com/${this.repoOwner}/${this.repoName}/${this.repoBranch}/`;

    constructor(
        private http: HttpClient,
        private fileService: MyFileService
    ) {
        this.resourceWidgets$ = this.getWidgetsResource();
    }

    getWidgetsResource(): Observable<WidgetsResource[]> {
        return this.getWidgetsFromRepo('', true);
    }

    getWidgetsGroupContent(path: string): Observable<WidgetsResource[]> {
        return this.getWidgetsFilesRecursive(path);
    }

    uploadWidgetFromUrl(fullUrl: string, filePath: string, filename?: string): Observable<TransferResult> {
        return new Observable<TransferResult>(observer => {
            fetch(fullUrl)
                .then(res => {
                    if (!res.ok) {
                        throw new Error('Download failed');
                    }
                    return res.text();
                })
                .then(svgText => {
                    const name = filename || filePath.split('/').pop() || fullUrl.split('/').pop() || 'widget.svg';
                    const blob = new Blob([svgText], { type: 'image/svg+xml' });
                    const file = new File([blob], name, { type: 'image/svg+xml' });
                    this.fileService.upload(file, 'widgets', filePath).subscribe({
                        next: result => observer.next(result),
                        error: err => observer.error(err),
                        complete: () => observer.complete()
                    });
                })
                .catch(err => observer.error(err));
        });
    }

    private getWidgetsFromRepo(path: string, onlyDirs = false): Observable<WidgetsResource[]> {
        const headers = new HttpHeaders({
            'Skip-Auth': 'true',
            'Accept': 'application/vnd.github+json'
        });
        const safePath = path
            ? path.split('/').map(segment => encodeURIComponent(segment)).join('/')
            : '';
        const url = safePath ? `${this.githubApiBaseUrl}/${safePath}` : this.githubApiBaseUrl;
        return this.http.get<any[]>(url, { headers }).pipe(
            map(items => (items || [])
                .filter(item => !onlyDirs || item.type === 'dir')
                .map(item => ({
                    name: item.name,
                    type: item.type === 'dir' ? WidgetsResourceType.dir : WidgetsResourceType.file,
                    path: item.path
                } as WidgetsResource)))
        );
    }

    private getWidgetsFilesRecursive(path: string): Observable<WidgetsResource[]> {
        return this.getWidgetsFromRepo(path).pipe(
            switchMap(items => {
                const files = items.filter(item => item.type === WidgetsResourceType.file);
                const dirs = items.filter(item => item.type === WidgetsResourceType.dir);
                if (dirs.length === 0) {
                    return of(files);
                }
                return forkJoin(dirs.map(dir => this.getWidgetsFilesRecursive(dir.path))).pipe(
                    map(children => files.concat(...children))
                );
            })
        );
    }
}
