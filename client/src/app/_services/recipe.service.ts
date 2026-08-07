import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

import { EndPointApi } from '../_helpers/endpointapi';
import { environment } from '../../environments/environment';
import { Recipe, RecipeEntry } from '../_models/recipe';

@Injectable({
    providedIn: 'root'
})
export class RecipeService {

    private endPointConfig: string = EndPointApi.getURL();

    constructor(private http: HttpClient) {
    }

    /**
     * Cache-busting param: the server sends ETags, so the browser revalidates
     * with If-None-Match and Express answers 304 Not Modified. Angular's
     * HttpClient treats 304 as an error (ok = 200 <= status < 300), so the
     * widget would show a failure on every load after the first one.
     * A unique query param forces a fresh 200 every time.
     */
    private _ts() {
        return { _ts: Date.now().toString() };
    }

    getRecipes(): Observable<{ recipes: { id: string; data: Recipe }[] }> {
        return this.http.get<{ recipes: { id: string; data: Recipe }[] }>(this.endPointConfig + '/api/recipes', {
            params: this._ts()
        });
    }

    getRecipeTypes(): Observable<{ recipes: { id: string; data: Recipe }[] }> {
        return this.http.get<{ recipes: { id: string; data: Recipe }[] }>(this.endPointConfig + '/api/recipes/types', {
            params: this._ts()
        });
    }

    getRecipeInstances(typeId: string): Observable<{ recipes: { id: string; data: Recipe }[] }> {
        return this.http.get<{ recipes: { id: string; data: Recipe }[] }>(this.endPointConfig + '/api/recipes', {
            params: { typeId, ...this._ts() }
        });
    }

    getRecipe(id: string): Observable<Recipe> {
        return this.http.get<Recipe>(this.endPointConfig + '/api/recipes/' + id, {
            params: this._ts()
        });
    }

    saveRecipe(recipe: { id?: string; typeId?: string; name: string; description?: string; entries: RecipeEntry[] }): Observable<{ id: string }> {
        let header = new HttpHeaders({ 'Content-Type': 'application/json' });
        return this.http.post<{ id: string }>(this.endPointConfig + '/api/recipes', recipe, { headers: header });
    }

    deleteRecipe(id: string): Observable<{ result: string; deleted: number }> {
        return this.http.delete<{ result: string; deleted: number }>(this.endPointConfig + '/api/recipes?id=' + id);
    }

    downloadRecipe(id: string): Observable<{ result: string; recipeId: string; totalEntries: number }> {
        let header = new HttpHeaders({ 'Content-Type': 'application/json' });
        return this.http.post<{ result: string; recipeId: string; totalEntries: number }>(
            this.endPointConfig + '/api/recipes/download', { id }, { headers: header });
    }

    uploadRecipe(id: string): Observable<{ result: string; recipeId: string; totalEntries: number }> {
        let header = new HttpHeaders({ 'Content-Type': 'application/json' });
        return this.http.post<{ result: string; recipeId: string; totalEntries: number }>(
            this.endPointConfig + '/api/recipes/upload', { id }, { headers: header });
    }

    exportRecipe(id: string, format: 'json' | 'csv'): Observable<Blob> {
        let header = new HttpHeaders({ 'Content-Type': 'application/json' });
        return this.http.post(this.endPointConfig + '/api/recipes/export', { id, format }, {
            headers: header,
            responseType: 'blob'
        });
    }

    importRecipe(data: { file: string; format?: string; name?: string; description?: string }): Observable<{ id: string; name: string; entriesCount: number }> {
        let header = new HttpHeaders({ 'Content-Type': 'application/json' });
        return this.http.post<{ id: string; name: string; entriesCount: number }>(
            this.endPointConfig + '/api/recipes/import', data, { headers: header });
    }
}
