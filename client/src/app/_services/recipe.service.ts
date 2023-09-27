import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

import { EndPointApi } from '../_helpers/endpointapi';
import { Recipe } from '../_models/recipe';
import { environment } from '../../environments/environment';
import { ToastrService } from 'ngx-toastr';
import { TranslateService } from '@ngx-translate/core';

@Injectable()

export class RecipeService{
    private endPointConfig: string = EndPointApi.getURL();

    constructor(private http: HttpClient,
                private translateService: TranslateService,
                private toastr: ToastrService) {

    }
    getRecipes(recipe: any): Observable<any> {
    let header = new HttpHeaders({ 'Content-Type': 'application/json' });
    let params = recipe;
    return this.http.get<any>(this.endPointConfig + '/api/recipes', { headers: header, params: params });
    }

    setRecipe(recipe: Recipe) {
        return new Observable((observer) => {
            if (environment.serverEnabled) {
                let header = new HttpHeaders({ 'Content-Type': 'application/json' });
                this.http.post<any>(this.endPointConfig + '/api/recipe', { headers: header, params: recipe }).subscribe(result => {
                    observer.next();
                }, err => {
                    console.error(err);
                    this.notifySaveError();
                    observer.error(err);
                });
            } else {
                observer.next();
            }
        });
    }


    removeRecipe(recipe: Recipe) {
        return new Observable((observer) => {
            if (environment.serverEnabled) {
                let header = new HttpHeaders({ 'Content-Type': 'application/json' });
                this.http.delete<any>(this.endPointConfig + '/api/recipes', { headers: header, params: {param: recipe.recipeId} }).subscribe(result => {
                    observer.next();
                }, err => {
                    console.error(err);
                    this.notifySaveError();
                    observer.error(err);
                });
            } else {
                observer.next();
            }
        });
    }

    private notifySaveError() {
        let msg = '';
        this.translateService.get('msg.recipe-save-error').subscribe((txt: string) => { msg = txt; });
        this.toastr.error(msg, '', {
            timeOut: 3000,
            closeButton: true,
            disableTimeOut: true
        });
    }
}
