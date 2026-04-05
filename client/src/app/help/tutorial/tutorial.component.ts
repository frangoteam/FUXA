import { Component } from '@angular/core';

interface TutorialShortcut {
    combo: string;
    description: string;
}

@Component({
    selector: 'app-tutorial',
    templateUrl: './tutorial.component.html',
    styleUrls: ['./tutorial.component.css']
})
export class TutorialComponent {

    show = false;
    shortcuts: TutorialShortcut[] = this.buildShortcuts();

    constructor() { }

    close() {
        this.show = false;
    }

    private buildShortcuts(): TutorialShortcut[] {
        const shortcuts: TutorialShortcut[] = [
            { combo: 'Ctrl / ⌘ + Left / Right', description: 'rotate selected item' },
            { combo: 'Ctrl / ⌘ + Shift + Left / Right', description: 'rotate the selected item in big step' },
            { combo: 'Shift + O / P', description: 'select the previous / next item' },
            { combo: 'Tab / Shift + Tab', description: 'select the previous / next item' },
            { combo: 'Ctrl / ⌘ + Up / Down', description: 'central zoom in / out' },
            { combo: 'Ctrl / ⌘ + Z / Y', description: 'undo / redo' },
            { combo: `Shift + resize the selected item with the mouse`, description: 'lock width and height' },
            { combo: 'Shift + Up / Down / Left / Right', description: 'move the selected item' },
            { combo: 'Shift + Mouse Wheel', description: 'zoom by mouse position' },
            { combo: 'Ctrl / ⌘ + A', description: 'select all items' },
            { combo: 'Ctrl / ⌘ + G', description: 'group or ungroup selected items' },
            { combo: 'Ctrl / ⌘ + D', description: 'duplicate selected item' },
            { combo: 'Shift + Draw line', description: 'constrain line gradient to horizontal, vertical, or 45° diagonal' },
            { combo: 'Ctrl / ⌘ + X', description: 'cut selected item' },
            { combo: 'Ctrl / ⌘ + C / V', description: 'copy / paste selected item' }
        ];

        return shortcuts;
    }
}
