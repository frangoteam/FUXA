import { AfterViewInit, ChangeDetectorRef, Component, Input } from '@angular/core';

@Component({
    selector: 'app-maps-fab-button-menu',
    templateUrl: './maps-fab-button-menu.component.html',
    styleUrls: ['./maps-fab-button-menu.component.scss']
})
export class MapsFabButtonMenuComponent implements AfterViewInit {

    @Input() buttons: { icon: string, action: () => void }[] = [];
    isOpen = false;
    buttonStyles: any[] = [];

    constructor(
        private changeDetector: ChangeDetectorRef,
    ) { }

    ngAfterViewInit() {
        this.toggleMenu();
        this.changeDetector.detectChanges();
    }

    toggleMenu() {
        this.isOpen = !this.isOpen;
        if (this.isOpen) {
            this.calculateButtonPositions();
        }
    }

    calculateButtonPositions() {
        const totalButtons = this.buttons.length;
        let angles = [];
        if (totalButtons === 1) {
            angles = [0];
        } else if (totalButtons === 2) {
            angles = [-30, 30];
        } else {    // 3 bottons
            const angleStep = 120 / (totalButtons - 1);
            angles = Array.from({ length: totalButtons }, (_, i) => -60 + i * angleStep);
        }
        const topPosition = 30;
        const radius = 55;
        this.buttonStyles = angles.map(angle => {
            const radian = angle * (Math.PI / 180);
            const x = Math.sin(radian) * radius;
            const y = -Math.cos(radian) * radius;
            return {
                transform: `translate(${x}px, ${y - topPosition}px)`
            };
        });
    }
}
