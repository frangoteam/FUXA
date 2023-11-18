export class Recipe {
    recipeId: string;
    recipeName: string;
    description: string;
    dbblockAddress: string;
    creationTime: number;
    version: number;
    isActive: number;
    detail: RecipeDetail[];
}

export class RecipeDetail {
    address: string;
    type: RecipeDetailType;
    value: string | number | boolean;
}

export enum RecipeDetailType {
    BOOL = 'BOOL',
    BYTE = 'BYTE',
    CHAR = 'CHAR',
    INT = 'INT',
    WORD = 'WORD',
    DINT = 'DINT',
    DWORD = 'DWORD',
    REAL = 'REAL'
}
