import { Injectable } from '@angular/core';

@Injectable()
export class EventUtils {

    static getEventClientPosition(event: MouseEvent | TouchEvent | PointerEvent): { x: number; y: number } | null {
        if ('clientX' in event && 'clientY' in event) {
            return { x: event.clientX, y: event.clientY };
        } else if ('touches' in event && event.touches.length > 0) {
            return {
                x: event.touches[0].clientX,
                y: event.touches[0].clientY
            };
        } else if ('changedTouches' in event && event.changedTouches.length > 0) {
            return {
                x: event.changedTouches[0].clientX,
                y: event.changedTouches[0].clientY
            };
        }
        return null;
    }
}
