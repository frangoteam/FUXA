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

    async function insertRecipe(id, name, typeId, entries = []) {
        const data = { id, name, typeId: typeId || undefined, entries };
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

    it('returns all recipe instances ordered by name case-insensitive', async () => {
        await insertRecipe('r_b', 'Beta', 'r_type');
        await insertRecipe('r_a', 'alpha', 'r_type');
        await insertRecipe('r_c', 'Charlie', 'r_type');

        const result = await recipeStorage.getAllRecipes();
        expect(result.map(r => r.data.name)).to.deep.equal(['alpha', 'Beta', 'Charlie']);
    });

    it('stores only instance values for template-backed recipes', async () => {
        await insertRecipe('r_instance', 'Instance', 'r_type', [
            { id: 'e_a', tagId: 'tag-a', tagName: 'Tag A', tagType: 'int', value: 42 }
        ]);

        const result = await recipeStorage.getRecipeData('r_instance');
        expect(result.entries).to.deep.equal([{ tagId: 'tag-a', value: 42 }]);
        expect(result.entries[0].tagName).to.equal(undefined);
        expect(result.entries[0].tagType).to.equal(undefined);
        expect(result.entries[0].value).to.equal(42);
    });
});
