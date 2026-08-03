'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const recipeStorage = require('../../runtime/recipes/recipe-storage');

function makeLogger() {
    return {
        info: () => {},
        warn: () => {},
        error: () => {}
    };
}

describe('Recipe storage ordering', () => {
    let expect;
    let workDir;

    before(async () => {
        const chai = await import('chai');
        expect = chai.expect;
    });

    beforeEach(async () => {
        workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fuxa-recipe-storage-'));
        await recipeStorage.init({ workDir }, makeLogger());
    });

    afterEach(() => {
        recipeStorage.close();
    });

    async function insertRecipe(id, name, typeId) {
        const data = { id, name, typeId: typeId || undefined, entries: [] };
        if (!typeId) {
            delete data.typeId;
        }
        await recipeStorage.setRecipeData(id, data);
    }

    it('returns instances ordered by name case-insensitive', async () => {
        await insertRecipe('r_b', 'Beta', 'r_type');
        await insertRecipe('r_a', 'alpha', 'r_type');
        await insertRecipe('r_c', 'Charlie', 'r_type');
        await insertRecipe('r_other', 'Other Type Recipe', 'r_other_type');

        const result = await recipeStorage.getAllRecipesByType('r_type');
        expect(result.map(r => r.data.name)).to.deep.equal(['alpha', 'Beta', 'Charlie']);
    });

    it('returns recipe types ordered by name case-insensitive', async () => {
        await insertRecipe('r_t2', 'Zulu Type');
        await insertRecipe('r_t1', 'alpha Type');
        await insertRecipe('r_t3', 'Mango Type');

        const result = await recipeStorage.getRecipeTypes();
        expect(result.map(r => r.data.name)).to.deep.equal(['alpha Type', 'Mango Type', 'Zulu Type']);
    });

    it('returns all recipes ordered by name case-insensitive', async () => {
        await insertRecipe('r_b', 'Beta');
        await insertRecipe('r_a', 'alpha');
        await insertRecipe('r_c', 'Charlie');

        const result = await recipeStorage.getAllRecipes();
        expect(result.map(r => r.data.name)).to.deep.equal(['alpha', 'Beta', 'Charlie']);
    });
});
