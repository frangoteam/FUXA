/* eslint-disable @angular-eslint/component-class-suffix */
import { Component, Inject, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

import { SelOptionsComponent } from '../gui-helpers/sel-options/sel-options.component';

import {RecipeService} from '../_services/recipe.service';

import {Recipe, RecipeDetailType} from '../_models/recipe';

@Component({
  selector: 'app-recipe',
  templateUrl: './recipe.component.html',
  styleUrls: ['./recipe.component.css']
})
export class RecipeComponent implements OnInit, AfterViewInit {

  dataSource = new MatTableDataSource([]);



  recipes: Recipe[];

  @ViewChild(MatTable, {static: false}) table: MatTable<any>;
  @ViewChild(MatSort, {static: false}) sort: MatSort;
    displayedColumns: any;
    readonly: Boolean;
    tableWidth: 1200;


  constructor(private dialog: MatDialog,
              private recipeService: RecipeService) {
  }


  ngOnInit() {
    // this.loadRecipes();
  }

  ngAfterViewInit() {
    this.dataSource.sort = this.sort;
  }

  addRecipe() {
    let recipe = new Recipe();
    this.editRecipe(recipe, recipe);
  }

  onRemoveUser(recipe: Recipe) {
    this.editRecipe(recipe, null);
  }

  private loadRecipes() {
    this.recipes = [];
    this.recipeService.getRecipes(null).subscribe(result => {
      Object.values<Recipe>(result).forEach(r => {
        this.recipes.push(r);
      });
      this.bindToTable(this.recipes);
    }, err => {
      console.error('get Users err: ' + err);
    });
  }


  private editRecipe(recipe: Recipe, current: Recipe) {
    let mrecipe: Recipe = JSON.parse(JSON.stringify(recipe));
    let dialogRef = this.dialog.open(DialogRecipe, {
      position: { top: '60px' },
      data: { recipe: mrecipe, current: current }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
          console.log(JSON.stringify(result, null, 2));
        // Add your logic for saving the recipe either by creating a new one or updating an existing one
        this.loadRecipes();
      }
    });
  }
  private bindToTable(recipes) {
    this.dataSource.data = recipes;
  }
}
@Component({
  selector: 'app-dialog-recipe',
  templateUrl: './recipe.dialog.html',
})

export class DialogRecipe {
  autoIncrement: boolean = true;
  manualAddress: string = '';


  public recipeDetailMateTypes = Object.values(RecipeDetailType);


  description: string = null;
  version: string = '';
  dbBlockAddress: string = '';
  detail = [];
  currentType: string = 'BOOL';
  currentValue: any;

  @ViewChild(SelOptionsComponent, {static: false}) seloptions: SelOptionsComponent;
  isToRemove: boolean = false;
    displayedColumns = ['address', 'type',  'value'];
    tableWidth = 1200;

  constructor(public dialogRef: MatDialogRef<DialogRecipe>,
              @Inject(MAT_DIALOG_DATA) public data: any) {
    // this.selectedGroups = UserGroups.ValueToGroups(this.data.user.groups);
  }

  onNoClick(): void {
    this.dialogRef.close();
  }
  addEntry() {
      if (!this.isValidValue()) {
          alert('Invalid value!');  // 你可以选择其他方式显示错误，比如SnackBar。
          return;
      }
      const address = this.autoIncrement ? this.getNextAddress() : this.manualAddress;

      const entry = {
          address: address,
          type: this.currentType,
          value: this.currentValue
     };
      this.detail.push(entry);
      this.detail = [...this.detail];
  }


    isValidValue(): boolean {
        switch (this.currentType) {
            case 'BOOL':
                return this.currentValue === 'true' || this.currentValue === 'false';

            case 'BYTE':
                return this.currentValue >= 0 && this.currentValue <= 255;

            case 'CHAR':
                return this.currentValue.length === 1;

            case 'INT':
                // 这里你可以加入INT的范围验证
                return !isNaN(Number(this.currentValue));

            case 'WORD':
                return this.currentValue >= 0 && this.currentValue <= 65535;

            case 'DINT':
                // 这里你可以加入DINT的范围验证，如果有
                return !isNaN(Number(this.currentValue));

            case 'DWORD':
                return this.currentValue >= 0 && this.currentValue <= 4294967295;

            case 'REAL':
                return !isNaN(Number(this.currentValue));

            default:
                return false;
        }
    }

  getNextAddress() {
      let byteNumber,lastindex;
      let isfirstRow = this.detail.length == 0;
      if(!isfirstRow){
          const lastEntry = this.detail[this.detail.length - 1];
          const addressSegments = lastEntry.address.split('.');
          lastindex = parseInt(addressSegments[1].substring(3));
      }
      // 根据上一个entry的type来调整byteNumber
      switch (this.currentType) {
          case 'BOOL':
              byteNumber = isfirstRow ?  0 : lastindex += 1;
              return `DB${this.dbBlockAddress}.DBX${byteNumber}.0`;
          case 'BYTE':
          case 'CHAR':
              byteNumber = isfirstRow ?  0 : lastindex += 1;
              return `DB${this.dbBlockAddress}.DBB${byteNumber}`;
          case 'INT':
          case 'WORD':
              byteNumber = isfirstRow ?  0 : lastindex += 2;
              return `DB${this.dbBlockAddress}.DBW${byteNumber}`;
          case 'DINT':
          case 'DWORD':
          case 'REAL':
              byteNumber = isfirstRow ?  0 : lastindex += 4;
              return `DB${this.dbBlockAddress}.DBD${byteNumber}`;
          default:
              return '';  // 如果类型未匹配，返回空字符串
      }
  }


  onDbBlockAddressChange() {
    if (this.dbBlockAddress) {
      // Update the address of all existing entries
      this.detail = this.detail.map(entry => {
        const addressSegments = entry.address.split('.');
        return {
          ...entry,
          address: `DB${this.dbBlockAddress}.${addressSegments[1]}`
        };
      });
    }
  }


    removeRow(index: number) {
        this.data.splice(index, 1);
    }

    onOkClick() {
        this.data.recipe.detail = this.detail;
        this.dialogRef.close(this.data.recipe);
    }
}

