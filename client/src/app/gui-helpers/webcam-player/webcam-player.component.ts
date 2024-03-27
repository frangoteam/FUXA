import {Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild} from '@angular/core';
import Player from 'xgplayer';
import LivePreset from 'xgplayer/es/presets/live';
import FlvJsPlugin from 'xgplayer-flv.js';
import { WebcamPlayerDialogData } from './webcam-player-dialog/webcam-player-dialog.component';
import { Utils } from '../../_helpers/utils';
import { HmiService } from '../../_services/hmi.service';

@Component({
    selector: 'app-webcam-player',
    templateUrl: './webcam-player.component.html',
    styleUrls: ['./webcam-player.component.css']
})
export class WebcamPlayerComponent implements OnInit {

    @ViewChild('xgplayer', {static: true}) xgplayerRef: ElementRef;
    @Input() data: WebcamPlayerDialogData;
    @Output() onclose = new EventEmitter();
    player: Player;


    constructor(private hmiService: HmiService) {
    }

    ngOnInit(): void {
        let url = this.data.ga.property.variableValue;
        if (this.data.ga.property.variableId){
            let variable = this.hmiService.getMappedVariable(this.data.ga.property.variableId, false);
            if (!Utils.isNullOrUndefined(variable?.value)) {
                url = '' + variable.value;
            }
        }
        let plugins: any = [];
        //add http-flv support
        if (new URL(url).pathname.endsWith('flv')) {
            plugins.push(FlvJsPlugin);
        }
        this.player = new Player({
            el: this.xgplayerRef.nativeElement,
            url,
            autoplay: true,
            presets: [LivePreset],
            plugins
        });
    }

    private onClose($event) {
        if (this.onclose) {
            this.onclose.emit($event);
        }
    }
}
