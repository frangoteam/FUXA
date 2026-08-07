import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { RecipeService } from '../../../../_services/recipe.service';
import { Recipe } from '../../../../_models/recipe';
import { FlexAuthValues } from '../../../gauge-property/flex-auth/flex-auth.component';

/**
 * Property panel for the HTML recipe widget used inside the SVG editor.
 * Allows the designer to select a default recipe, toggle read-only mode,
 * and configure colours.
 */
@Component({
    selector: 'app-recipe-property',
    templateUrl: './recipe-property.component.html',
    styleUrls: ['./recipe-property.component.scss']
})
export class RecipePropertyComponent implements OnInit {
    @Input() data: any;
    @Output() onPropChanged = new EventEmitter<any>();
    @Input('reload') set reload(b: any) {
        this._reload();
    }

    recipes: { id: string; data: Recipe }[] = [];
    property: any = {};
    loading = false;

    constructor(private recipeService: RecipeService) { }

    ngOnInit(): void {
        this._reload();
    }

    private _reload() {
        this.loadRecipes();
        if (!this.data.settings.name) {
            this.data.settings.name = 'recipe_1';
        }
        this.property = this.data.settings.property || {};
        this.property.backgroundColor ??= '#f0f0f0';
        this.property.textColor ??= '#505050';
        this.property.borderColor ??= '#cccccc';
        this.property.accentColor ??= '#2196f3';
        this.property.readonly ??= false;
        // Additive visibility defaults — saved views without them stay valid (FR-31)
        this.property.visibleActions ??= {};
        this.property.visibleActions.new ??= true;
        this.property.visibleActions.delete ??= true;
        this.property.visibleActions.save ??= true;
        this.property.visibleActions.download ??= true;
        this.property.visibleActions.upload ??= true;
    }

    private loadRecipes() {
        this.loading = true;
        this.recipeService.getRecipeTypes().subscribe({
            next: (result) => {
                this.recipes = result.recipes || [];
                this.loading = false;
            },
            error: (err) => {
                console.error('Failed to load recipe types:', err);
                this.recipes = [];
                this.loading = false;
            }
        });
    }

    onPropertyChanged(): void {
        this.data.settings.property = this.property;
        this.onPropChanged.emit(this.data.settings);
    }

    /** Authorization saved in the flex-auth dialog → permission fields (FR-28) */
    onFlexAuthChanged(flexAuth: FlexAuthValues): void {
        this.property.permission = flexAuth.permission;
        this.property.permissionRoles = flexAuth.permissionRoles;
        this.onPropertyChanged();
    }
}
