import { Utils } from '../_helpers/utils';

export interface Recipe {
    id: string;              // "r_" + 12 hex chars
    typeId?: string;         // if set, this recipe is an INSTANCE of the recipe type with this id
    name: string;            // required, max 128
    description: string;     // optional, max 512
    entries: RecipeEntry[];  // 1..1000
    createdAt?: string;
    updatedAt?: string;
}

export interface RecipeEntry {
    id: string;              // "e_" + 8 hex chars
    tagId: string;
    tagName: string;
    tagType: string;         // bool, int, real, etc.
    value: any;
}

export interface RecipeProgressEvent {
    recipeId: string;
    entryId?: string;
    tagId?: string;
    tagName?: string;
    index: number;
    total: number;
    status: 'pending' | 'writing' | 'reading' | 'success' | 'error' | 'skipped';
    value?: any;
    error?: string;
}

export interface RecipeCompleteEvent {
    recipeId: string;
    successCount: number;
    errorCount: number;
    errors: { entryId: string; tagId: string; error: string }[];
}

export interface RecipeCancelledEvent {
    recipeId: string;
    completedCount: number;
}
