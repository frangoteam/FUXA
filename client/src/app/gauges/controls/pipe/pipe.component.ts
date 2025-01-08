import { Injectable } from '@angular/core';

import { GaugeSettings, GaugeAction, Variable, GaugeStatus, GaugeActionStatus, GaugeActionsType, GaugePropertyColor } from '../../../_models/hmi';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component';
import { GaugeDialogType } from '../../gauge-property/gauge-property.component';
import { Utils } from '../../../_helpers/utils';

declare var SVG: any;
declare var Raphael: any;

export enum PipeActionsType {
    hidecontent = 'pipe.action-hide-content'
}

@Injectable()
export class PipeComponent {

    // TypeId = 'pipe';
    static TypeTag = 'svg-ext-pipe'; // used to identify shapes type, binded with the library svgeditor
    static LabelTag = 'Pipe';
    static prefixB = 'PIE_';
    static prefixC = 'cPIE_';
    static prefixAnimation = 'aPIE_';

    static actionsType = {
        stop: GaugeActionsType.stop, clockwise: GaugeActionsType.clockwise, anticlockwise: GaugeActionsType.anticlockwise,
        hidecontent: PipeActionsType.hidecontent, blink: GaugeActionsType.blink
    };

    static getSignals(pro: any) {
        let res: string[] = [];
        if (pro.variableId) {
            res.push(pro.variableId);
        }
        if (pro.alarmId) {
            res.push(pro.alarmId);
        }
        if (pro.actions) {
            pro.actions.forEach(act => {
                res.push(act.variableId);
            });
        }
        return res;
    }

    static getActions(type: string) {
        return this.actionsType;
    }

    static getDialogType(): GaugeDialogType {
        return GaugeDialogType.Pipe;
    }

    static isBitmaskSupported(): boolean {
        return true;
    }

    static processValue(ga: GaugeSettings, svgele: any, sig: Variable, gaugeStatus: PipeStatus | GaugeStatus) {
        try {
            if (svgele.node) {
                let clr = '';
                let value = parseFloat(sig.value);
                if (Number.isNaN(value)) {
                    // maybe boolean
                    value = Number(sig.value);
                } else {
                    value = parseFloat(value.toFixed(5));
                }
                if (ga.property) {
                    let defaultColor = new GaugePropertyColor();
                    defaultColor.fill = ga.property?.options?.pipe;
                    defaultColor.stroke = ga.property?.options.content;

                    // check actions
                    if (ga.property.actions) {
                        ga.property.actions.forEach(act => {
                            if (act.variableId === sig.id) {
                                PipeComponent.processAction(act, svgele, value, gaugeStatus, defaultColor);
                            }
                        });
                    }
                }
            }
        } catch (err) {
            console.error(err);
        }
    }

    static processAction(act: GaugeAction, svgele: any, value: any, gaugeStatus: PipeStatus | GaugeStatus, defaultColor?: GaugePropertyColor) {
        let actValue = GaugeBaseComponent.checkBitmask(act.bitmask, value);
        if (this.actionsType[act.type] === this.actionsType.blink) {
            let element = SVG.adopt(svgele.node);
            var elePipe = Utils.searchTreeStartWith(element.node, 'p' + this.prefixB);
            var eleContent = Utils.searchTreeStartWith(element.node, 'c' + this.prefixB);
            let inRange = (act.range.min <= actValue && act.range.max >= actValue);
            this.runMyActionBlink(elePipe, eleContent, act, <PipeStatus>gaugeStatus, inRange, defaultColor);
        } else if (act.range.min <= actValue && act.range.max >= actValue) {
            var element = SVG.adopt(svgele.node);
            PipeComponent.runMyAction(element, act.type, gaugeStatus);
        }
    }

    static runMyAction(element, type, gaugeStatus: GaugeStatus) {
        if (PipeComponent.actionsType[type] === PipeComponent.actionsType.stop) {
            if (gaugeStatus.actionRef?.timer) {
                clearTimeout(gaugeStatus.actionRef.timer);
                gaugeStatus.actionRef.timer = null;
            }
        } else {
            if (gaugeStatus.actionRef?.timer) {
                if (gaugeStatus.actionRef.type === type) {
                    return;
                }
                clearTimeout(gaugeStatus.actionRef.timer);
                gaugeStatus.actionRef.timer = null;
            }
            var eletoanim = Utils.searchTreeStartWith(element.node, 'c' + this.prefixB);
            if (eletoanim) {
                let len = 1000;
                if (PipeComponent.actionsType[type] === PipeComponent.actionsType.clockwise) {
                    eletoanim.style.display = 'unset';
                    let timeout = setInterval(() => {
                        if (len < 0) { len = 1000; }
                        eletoanim.style.strokeDashoffset = len;
                        len--;
                    }, 20);
                    gaugeStatus.actionRef = <GaugeActionStatus>{ type: type, timer: timeout };
                } else if (PipeComponent.actionsType[type] === PipeComponent.actionsType.anticlockwise) {
                    eletoanim.style.display = 'unset';
                    let timeout = setInterval(() => {
                        if (len > 1000) { len = 0; }
                        eletoanim.style.strokeDashoffset = len;
                        len++;
                    }, 20);
                    gaugeStatus.actionRef = <GaugeActionStatus>{ type: type, timer: timeout };
                } else if (PipeComponent.actionsType[type] === PipeComponent.actionsType.hidecontent) {
                    eletoanim.style.display = 'none';
                }
            }
        }
    }

    static runMyActionBlink(
        elePipe: SVGPathElement,
        eleContent: SVGPathElement,
        act: GaugeAction,
        gaugeStatus: PipeStatus,
        toEnable: boolean,
        defaultColor?: GaugePropertyColor
    ) {
        if (!gaugeStatus.actionBlinkRef) {
            gaugeStatus.actionBlinkRef = new GaugeActionStatus(act.type);
        }
        gaugeStatus.actionBlinkRef.type = act.type;
        if (toEnable) {
            if (gaugeStatus.actionBlinkRef.timer &&
                (GaugeBaseComponent.getBlinkActionId(act) === gaugeStatus.actionBlinkRef.spool?.actId)) {
                return;
            }
            GaugeBaseComponent.clearAnimationTimer(gaugeStatus.actionBlinkRef);
            var blinkStatus = false;
            // save action (dummy) id and colors to restore on break
            try {
                const actId = GaugeBaseComponent.getBlinkActionId(act);
                //gaugeStatus.actionBlinkRef.spool = { bk: elePipe.style.backgroundColor, clr: eleContent.style.color, actId: actId };
                gaugeStatus.actionBlinkRef.spool = { fill: elePipe.getAttribute('stroke'), stroke: eleContent.getAttribute('stroke'), actId: actId };
            } catch (err) {
                console.error(err);
            }
            gaugeStatus.actionBlinkRef.timer = setInterval(() => {
                blinkStatus = (blinkStatus) ? false : true;
                try {
                    GaugeBaseComponent.walkTreeNodeToSetAttribute(elePipe, 'stroke', blinkStatus ? act.options.fillA : act.options.fillB);
                    GaugeBaseComponent.walkTreeNodeToSetAttribute(eleContent, 'stroke', blinkStatus ? act.options.strokeA : act.options.strokeB);
                } catch (err) {
                    console.error(err);
                }
            }, act.options.interval);
        } else if (!toEnable) {
            try {
                // restore gauge
                if (gaugeStatus.actionBlinkRef?.spool?.actId === GaugeBaseComponent.getBlinkActionId(act)) {
                    if (gaugeStatus.actionBlinkRef.timer) {
                        clearInterval(gaugeStatus.actionBlinkRef.timer);
                        gaugeStatus.actionBlinkRef.timer = null;
                    }
                    // check to overwrite with property color
                    if (defaultColor && gaugeStatus.actionBlinkRef.spool) {
                        if (defaultColor.fill) {
                            gaugeStatus.actionBlinkRef.spool.fill = defaultColor.fill;
                        }
                        if (defaultColor.stroke) {
                            gaugeStatus.actionBlinkRef.spool.stroke = defaultColor.stroke;
                        }
                    }
                    GaugeBaseComponent.walkTreeNodeToSetAttribute(elePipe, 'stroke', gaugeStatus.actionBlinkRef.spool?.fill);
                    GaugeBaseComponent.walkTreeNodeToSetAttribute(eleContent, 'stroke', gaugeStatus.actionBlinkRef.spool?.stroke);
                }
            } catch (err) {
                console.error(err);
            }
        }
    }

    static initElement(gaugeSettings: GaugeSettings, isView: boolean) {
        let ele = document.getElementById(gaugeSettings.id);
        if (ele) {
            // clear all children
            let imageInPathForAnimation = Utils.searchTreeStartWith(ele, PipeComponent.prefixAnimation);
            if (imageInPathForAnimation) {
                ele.removeChild(imageInPathForAnimation);
            }
            const imagesBuffer = Utils.childrenStartWith(ele, 'svg_');
            imagesBuffer.forEach((img) => {
                ele.removeChild(img);
            });
            if (gaugeSettings.property?.options?.imageAnimation as PipeImageAnimation) {
                let path = Utils.searchTreeStartWith(ele, PipeComponent.prefixC);
                fetch(gaugeSettings.property.options.imageAnimation.imageUrl)
                    .then((response) => {
                        if (!response.ok) {
                            throw new Error(`Failed to load SVG: ${response.statusText}`);
                        }
                        return response.text();
                    })
                    .then((svgContent) => {
                        const parser = new DOMParser();
                        const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
                        imageInPathForAnimation = svgDoc.documentElement;
                        imageInPathForAnimation.setAttribute('id', Utils.getShortGUID('svg_'));
                        const imageInPath = new ImageInPath(imageInPathForAnimation, path, gaugeSettings.property.options.imageAnimation.count);
                        const anim = new ImageInPathAnimation(imageInPath, gaugeSettings.property.options.imageAnimation.delay, isView);
                        anim.start();
                    })
                    .catch((error) => {
                        console.error('Error loading SVG:', error);
                    });
            }
        }
        return ele;
    }

    static resize(gaugeSettings: GaugeSettings) {
        PipeComponent.initElement(gaugeSettings, false);
    }

    static detectChange(gaugeSettings: GaugeSettings, res: any, ref: any) {
        let data = { id: gaugeSettings.id, property: gaugeSettings.property.options };
        let result = ref.nativeWindow.svgEditor.runExtension('pipe', 'initPipe', data);
        PipeComponent.initElement(gaugeSettings, false);
        return result;
    }
}

export class PipeOptions {
    border: string = '#3F4964';
    borderWidth: number = 11;
    pipe: string = '#E79180';
    pipeWidth: number = 6;
    content: string = '#DADADA';
    contentWidth: number = 6;
    contentSpace: number = 20;
    imageAnimation?: PipeImageAnimation;
}

export interface PipeImageAnimation {
    imageUrl: string;
    count: number;
    delay: number;
}

class PipeStatus extends GaugeStatus {
    actionBlinkRef: GaugeActionStatus;
}

class ImageInPath {
    private images: SVGElement[] = [];
    private path: SVGPathElement | null = null;

    constructor(_image: SVGElement | HTMLElement, _path: SVGPathElement, numImages: number) {
        this.path = _path;

        if (!_image || !this.path) {
            throw new Error('Pipe Image or track element not found.');
        }
        for (let i = 0; i < numImages; i++) {
            const clone = _image.cloneNode(true) as SVGElement;
            this.images.push(clone);
        }
        this.images.forEach(image => {
            this.path.parentElement?.appendChild(image);
        });
    }

    move(progress: number): void {
        if (!this.path) {
            return;
        }
        const totalLength = this.path.getTotalLength();

        this.images.forEach((image, index) => {
            const u = (progress + index / this.images.length) % 1;
            const point = this.path.getPointAtLength(u * totalLength);

            const bbox = image.getBoundingClientRect();
            const offsetX = bbox.width / 2;
            const offsetY = bbox.height / 2;

            image.setAttribute('x', `${point.x - offsetX}`);
            image.setAttribute('y', `${point.y - offsetY}`);
        });
    }
}

class ImageInPathAnimation {
    private duration: number;
    private tZero: number = 0;
    private multiImageInPath: ImageInPath;
    private loop: boolean;

    constructor(_multiImageInPath: ImageInPath, duration: number, loop: boolean = true) {
        this.multiImageInPath = _multiImageInPath;
        this.duration = duration;
        this.loop = loop;
    }

    start(): void {
        this.tZero = Date.now();
        requestAnimationFrame(() => this.run());
    }

    private run(): void {
        const elapsed = Date.now() - this.tZero;
        const progress = (elapsed / this.duration) % 1;

        this.multiImageInPath.move(progress);

        if (this.loop && progress < 1) {
            requestAnimationFrame(() => this.run());
        } else {
            this.onFinish();
        }
    }

    private onFinish(): void {
        if (this.loop) {
            setTimeout(() => this.start(), 1000);
        }
    }
}
