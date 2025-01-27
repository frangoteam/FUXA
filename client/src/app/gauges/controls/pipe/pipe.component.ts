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

    static processValue(gaugeSettings: GaugeSettings, svgElement: any, signal: Variable, gaugeStatus: PipeStatus | GaugeStatus) {
        try {
            if (svgElement.node) {
                let value = parseFloat(signal.value);
                if (Number.isNaN(value)) {
                    // maybe boolean
                    value = Number(signal.value);
                } else {
                    value = parseFloat(value.toFixed(5));
                }
                if (gaugeSettings.property) {
                    let defaultColor = new GaugePropertyColor();
                    defaultColor.fill = gaugeSettings.property?.options?.pipe;
                    defaultColor.stroke = gaugeSettings.property?.options.content;

                    // check actions
                    if (gaugeSettings.property.actions) {
                        gaugeSettings.property.actions.forEach(action => {
                            if (action.variableId === signal.id) {
                                const inRange = PipeComponent.processAction(action, svgElement, value, gaugeStatus, defaultColor);
                                if (gaugeSettings.property?.options?.imageAnimation && inRange) {
                                    PipeComponent.runImageAction(gaugeSettings, action, svgElement.node, gaugeStatus);
                                }
                            }
                        });
                    }
                }
            }
        } catch (err) {
            console.error(err);
        }
    }

    static processAction(act: GaugeAction, svgele: any, value: any, gaugeStatus: PipeStatus | GaugeStatus, defaultColor?: GaugePropertyColor): boolean {
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
            return true;
        }
        return false;
    }

    static runMyAction(element, type, gaugeStatus: GaugeStatus) {
        if (PipeComponent.actionsType[type] === PipeComponent.actionsType.stop) {
            if (gaugeStatus.actionRef?.timer) {
                clearTimeout(gaugeStatus.actionRef.timer);
                gaugeStatus.actionRef.timer = null;
            }
            if (gaugeStatus.actionRef?.animr) {
                gaugeStatus.actionRef.animr.stop();
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
                    gaugeStatus.actionRef ??= new GaugeActionStatus(type);
                    gaugeStatus.actionRef.timer = timeout;
                    gaugeStatus.actionRef.type = type;
                } else if (PipeComponent.actionsType[type] === PipeComponent.actionsType.anticlockwise) {
                    eletoanim.style.display = 'unset';
                    let timeout = setInterval(() => {
                        if (len > 1000) { len = 0; }
                        eletoanim.style.strokeDashoffset = len;
                        len++;
                    }, 20);
                    gaugeStatus.actionRef ??= new GaugeActionStatus(type);
                    gaugeStatus.actionRef.timer = timeout;
                    gaugeStatus.actionRef.type = type;

                } else if (PipeComponent.actionsType[type] === PipeComponent.actionsType.hidecontent) {
                    eletoanim.style.display = 'none';
                }
            }
        }
    }

    static async runImageAction(gaugeSettings: GaugeSettings, action: GaugeAction, svgElement: any, gaugeStatus: PipeStatus | GaugeStatus) {
        if (!gaugeStatus.actionRef?.animr) {
            gaugeStatus.actionRef ??= new GaugeActionStatus(action.type);
            PipeComponent.removeImageChildren(svgElement);
            let anim = await loadSvgAnimation(gaugeSettings, svgElement, true, 'forward');
            gaugeStatus.actionRef.animr = anim;
        }
        if (PipeComponent.actionsType[action.type] === PipeComponent.actionsType.stop) {
            gaugeStatus.actionRef.animr.stop();
        } else {
            if (PipeComponent.actionsType[action.type] === PipeComponent.actionsType.clockwise) {
                gaugeStatus.actionRef.animr.setDirection('forward');
            } else if (PipeComponent.actionsType[action.type] === PipeComponent.actionsType.anticlockwise) {
                gaugeStatus.actionRef.animr.setDirection('reverse');
            }
            if (!gaugeStatus.actionRef.animr.isRunning) {
                gaugeStatus.actionRef.animr.start();
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

    static initElement(gaugeSettings: GaugeSettings, isView: boolean, gaugeStatus?: GaugeStatus) {
        let ele = document.getElementById(gaugeSettings.id);
        if (ele) {
            PipeComponent.removeImageChildren(ele);
            if (gaugeSettings.property?.options?.imageAnimation as PipeImageAnimation) {
                loadSvgAnimation(gaugeSettings, ele, isView).then(anim => {
                    anim.stop();
                }).catch(error => {
                    console.error('Error occurred while initializing animation:', error);
                });
            }
        }
        return ele;
    }

    static removeImageChildren(svgElement: any) {
        // clear all children
        let imageInPathForAnimation = Utils.searchTreeStartWith(svgElement, PipeComponent.prefixAnimation);
        if (imageInPathForAnimation) {
            svgElement.removeChild(imageInPathForAnimation);
        }
        const imagesBuffer = Utils.childrenStartWith(svgElement, 'svg_');
        imagesBuffer.forEach((img) => {
            svgElement.removeChild(img);
        });
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

function loadSvgAnimation(gaugeSettings: any,
                          ele: any,
                          isView: boolean,
                          direction: 'forward' | 'reverse' = 'forward'): Promise<ImageInPathAnimation | null> {
    let path = Utils.searchTreeStartWith(ele, PipeComponent.prefixC);
    if (!path) {
        return Promise.resolve(null);
    }
    return fetch(gaugeSettings.property.options.imageAnimation.imageUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to load SVG: ${response.statusText}`);
            }
            return response.text();
        })
        .then(svgContent => {
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
            const imageInPathForAnimation = svgDoc.documentElement;
            imageInPathForAnimation.setAttribute('id', Utils.getShortGUID('svg_'));

            const imageInPath = new ImageInPath(
                imageInPathForAnimation,
                path,
                gaugeSettings.property.options.imageAnimation.count
            );
            const anim = new ImageInPathAnimation(
                imageInPath,
                gaugeSettings.property.options.imageAnimation.delay,
                isView,
                direction
            );
            anim.initialize();
            return anim;
        });
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
    private direction: 'forward' | 'reverse';
    private isRunning: boolean = false;
    private animationFrameId: number | null = null;

    constructor(
        _multiImageInPath: ImageInPath,
        duration: number,
        loop: boolean = true,
        direction: 'forward' | 'reverse' = 'forward'
    ) {
        this.multiImageInPath = _multiImageInPath;
        this.duration = duration;
        this.loop = loop;
        this.direction = direction;
    }

    initialize(): void {
        const progress = this.direction === 'forward' ? 0 : 1;
        this.multiImageInPath.move(progress);
    }

    start(): void {
        if (this.isRunning) {
            return;
        }
        this.isRunning = true;
        this.tZero = Date.now();
        requestAnimationFrame(() => this.run());
    }

    stop(): void {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.isRunning = false;
    }

    setDirection(direction: 'forward' | 'reverse'): void {
        this.direction = direction;
    }

    private run(): void {
        if (!this.isRunning) {
            return;
        }
        const elapsed = Date.now() - this.tZero;
        let progress = elapsed / this.duration;

        let adjustedProgress = progress % 1;

        if (this.direction === 'reverse') {
            adjustedProgress = 1 - adjustedProgress;
        }

        this.multiImageInPath.move(adjustedProgress);

        if (this.loop || progress < 1) {
            this.animationFrameId = requestAnimationFrame(() => this.run());
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
