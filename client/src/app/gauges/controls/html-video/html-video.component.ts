import { Component } from '@angular/core';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component';
import { GaugeDialogType } from '../../gauge-property/gauge-property.component';
import { GaugeAction, GaugeActionsType, GaugeSettings, Variable } from '../../../_models/hmi';
import { Utils } from '../../../_helpers/utils';
import { EndPointApi } from '../../../_helpers/endpointapi';

@Component({
    selector: 'app-html-video',
    templateUrl: './html-video.component.html',
    styleUrls: ['./html-video.component.css']
})
export class HtmlVideoComponent extends GaugeBaseComponent {
    static TypeTag = 'svg-ext-own_ctrl-video';
    static LabelTag = 'HtmlVideo';
    static prefixD = 'D-OXC_';

    static actionsType = {
        stop: GaugeActionsType.stop,
        start: GaugeActionsType.start,
        pause: GaugeActionsType.pause,
        reset: GaugeActionsType.reset
    };

    constructor() {
        super();
    }

    static getSignals(pro: any) {
        let res: string[] = [];
        if (pro.variableId) {
            res.push(pro.variableId);
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
        return GaugeDialogType.Video;
    }

    static processValue(ga: GaugeSettings, svgele: any, sig: Variable) {
        try {
            if (svgele?.node?.children?.length >= 1) {
                const parentIframe = Utils.searchTreeStartWith(svgele.node, this.prefixD);
                const video = parentIframe.querySelector('video');
                if (!video) {
                    return;
                }
                if (sig.id === ga.property.variableId) {
                    const newSrc = EndPointApi.resolveUrl(String(sig.value ?? '').trim());
                    const same = newSrc === video.currentSrc || newSrc === video.src || (video.querySelector('source') as HTMLSourceElement)?.src === newSrc;
                    video.src = sig.value;
                    if (!same) {
                        video.pause();
                        while (video.firstChild) {
                            video.removeChild(video.firstChild);
                        }
                        const source = document.createElement('source');
                        source.src = newSrc;
                        source.type = HtmlVideoComponent.getMimeTypeFromUrl(newSrc);
                        video.appendChild(source);
                        video.load();
                    }
                    const image = parentIframe.querySelector('img');
                    if (image) {
                        if (sig.value) {
                            image.style.display = 'none';
                        } else {
                            image.style.display = 'block';
                        }
                    }
                } else {
                    let value = Utils.toFloatOrNumber(sig.value);
                    if (ga.property.actions) {
                        ga.property.actions.forEach(act => {
                            if (act.variableId === sig.id) {
                                HtmlVideoComponent.processAction(act, video, value);
                            }
                        });
                    }
                }
            }
        } catch (err) {
            console.error(err);
        }
    }

    static initElement(gaugeSettings: GaugeSettings, isView: boolean = false): HTMLElement {
        let ele = document.getElementById(gaugeSettings.id);
        if (!ele) {
            return null;
        }
        ele?.setAttribute('data-name', gaugeSettings.name);
        let svgVideoContainer = Utils.searchTreeStartWith(ele, this.prefixD);
        if (svgVideoContainer) {
            svgVideoContainer.innerHTML = '';
            const rawSrc  = gaugeSettings.property?.options?.address;
            const initImage = gaugeSettings.property?.options?.initImage;
            const videoSrc = EndPointApi.resolveUrl(rawSrc);
            const hasVideo = !!rawSrc;
            if (initImage && !hasVideo) {
                const img = document.createElement('img');
                img.src = initImage;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'contain';
                svgVideoContainer.appendChild(img);
            }
            let video = document.createElement('video');
            video.setAttribute('playsinline', 'true');
            video.style.width = '100%';
            video.style.height = '100%';
            video.style.objectFit = 'contain';
            video.style.display = 'block';
            if (gaugeSettings.property?.options?.showControls) {
                video.setAttribute('controls', '');
            }
            const source = document.createElement('source');
            source.src = videoSrc;
            if (hasVideo) {
                source.type = HtmlVideoComponent.getMimeTypeFromUrl(videoSrc);
            }
            video.appendChild(source);
            svgVideoContainer.appendChild(video);

        }
        return svgVideoContainer;
    }

    static processAction(act: GaugeAction, video: any, value: any) {
        let actValue = GaugeBaseComponent.checkBitmask(act.bitmask, value);
        if (this.actionsType[act.type] === this.actionsType.start) {
            if (act.range.min <= actValue && act.range.max >= actValue) {
                video.play().catch(err => console.error('Video play failed:', err));
            }
        } else if (this.actionsType[act.type] === this.actionsType.pause) {
            if (act.range.min <= actValue && act.range.max >= actValue) {
                video.pause();
            }
        } else if (this.actionsType[act.type] === this.actionsType.stop) {
            if (act.range.min <= actValue && act.range.max >= actValue) {
                video.pause();
            }
        } else if (this.actionsType[act.type] === this.actionsType.reset) {
            if (act.range.min <= actValue && act.range.max >= actValue) {
                video.pause();
                video.currentTime = 0;
            }
        }
    }

    static detectChange(gaugeSettings: GaugeSettings, res: any, ref: any) {
        return HtmlVideoComponent.initElement(gaugeSettings, false);
    }

    static getMimeTypeFromUrl(url: string): string {
        const ext = url.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'mp4': return 'video/mp4';
            case 'webm': return 'video/webm';
            case 'ogg':
            case 'ogv': return 'video/ogg';
            default: return 'video/mp4';
        }
    }
}
