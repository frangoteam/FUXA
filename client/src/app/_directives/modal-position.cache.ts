import { Injectable, Type } from '@angular/core';

export interface Position {
  x: number;
  y: number;
}


@Injectable()
export class ModalPositionCache {
  private _cache = new Map<Type<any>, Position>();

  set(dialog: Type<any>, position: Position) {
    this._cache.set(dialog, position);
  }

  get(dialog: Type<any>): Position|null {
    return this._cache.get(dialog);
  }
}
