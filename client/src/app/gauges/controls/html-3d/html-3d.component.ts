import { Component } from '@angular/core';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component';
import { GaugeDialogType } from '../../gauge-property/gauge-property.component';
import { GaugeAction, GaugeSettings, Variable } from '../../../_models/hmi';
import { Utils } from '../../../_helpers/utils';
import { EndPointApi } from '../../../_helpers/endpointapi';

function toNum(v: any, def: number): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
}

@Component({
    selector: 'app-html-3d',
    templateUrl: './html-3d.component.html',
    styleUrls: ['./html-3d.component.css']
})
export class Html3dComponent extends GaugeBaseComponent {
    static TypeTag = 'svg-ext-own_ctrl-3d';
    static LabelTag = 'Html3d';
    static prefixD = 'D-OXC_';

    // module level WebGL context defense (browser limit ~8-16 contexts per page)
    static webglFailCount = 0;
    static readonly WEBGL_FAIL_LIMIT = 8;
    // gauge id -> running runtime instance
    static running: Map<string, any> = new Map();
    // gauge id -> init generation token (guards async init races on view reload)
    private static initTokens: Map<string, number> = new Map();

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
                if (act.variableId) {
                    res.push(act.variableId);
                }
            });
        }
        return res;
    }

    static getDialogType(type?: string): GaugeDialogType {
        return GaugeDialogType.ThreeD;
    }

    private static toNum(v: any, def: number): number {
        return toNum(v, def);
    }

    static tr(key: string): string {
        try {
            const w = window as any;
            if (w.__fuxaTranslate?.instant) {
                const t = w.__fuxaTranslate.instant(key);
                if (t && t !== key) {
                    return t;
                }
            }
        } catch { /* noop */ }
        return key;
    }

    static showError(container: HTMLElement, msgKey?: string) {
        if (!container) {
            return;
        }
        container.innerHTML = '';
        const box = document.createElement('div');
        box.style.cssText = 'width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;box-sizing:border-box;padding:8px;overflow:hidden;';
        const icon = document.createElement('span');
        icon.className = 'material-icons';
        icon.style.cssText = 'font-size:36px;color:#b00020;';
        icon.textContent = 'broken_image';
        const msg = document.createElement('span');
        msg.style.cssText = 'font-size:12px;color:#b00020;text-align:center;font-family:Roboto,"Helvetica Neue",sans-serif;';
        msg.textContent = Html3dComponent.tr(msgKey || 'three-d.error-placeholder');
        box.appendChild(icon);
        box.appendChild(msg);
        container.appendChild(box);
    }

    private static findContainer(gaugeSettings: GaugeSettings): HTMLElement {
        let ele = document.getElementById(gaugeSettings.id);
        if (!ele) {
            return null;
        }
        ele?.setAttribute('data-name', gaugeSettings.name);
        return Utils.searchTreeStartWith(ele, Html3dComponent.prefixD);
    }

    static initElement(gaugeSettings: GaugeSettings, isView: boolean = false, viewId?: string): HTMLElement {
        const container = Html3dComponent.findContainer(gaugeSettings);
        if (!container) {
            return null;
        }
        // cleanup a previous runtime of the same gauge (view reload) and invalidate its async init
        Html3dComponent.destroy(gaugeSettings.id);
        Html3dComponent.initTokens.set(gaugeSettings.id, (Html3dComponent.initTokens.get(gaugeSettings.id) || 0) + 1);
        container.innerHTML = '';
        const options = gaugeSettings.property?.options || {};
        if (!isView) {
            const ph = document.createElement('div');
            ph.style.cssText = 'width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;box-sizing:border-box;padding:8px;overflow:hidden;';
            const icon = document.createElement('span');
            icon.className = 'material-icons';
            icon.style.cssText = 'font-size:42px;color:#607d8b;opacity:0.85;';
            icon.textContent = 'view_in_ar';
            ph.appendChild(icon);
            const label = document.createElement('span');
            label.style.cssText = 'font-size:12px;color:#78909c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;font-family:Roboto,"Helvetica Neue",sans-serif;';
            label.textContent = Html3dComponent.tr('three-d.placeholder');
            ph.appendChild(label);
            const address = String(options?.address ?? '').trim();
            if (address) {
                const src = document.createElement('span');
                src.style.cssText = 'font-size:11px;color:#90a4ae;font-style:italic;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
                src.textContent = address.split('/').pop();
                ph.appendChild(src);
            }
            container.appendChild(ph);
            return container;
        }
        Html3dComponent.renderScene(gaugeSettings.id, container, options, viewId);
        return container;
    }

    /**
     * runtime render: three.js is dynamically imported to keep it in a lazy chunk,
     * the editor mode never loads this code path.
     */
    private static async renderScene(id: string, container: HTMLElement, options: any, viewId?: string) {
        const token = Html3dComponent.initTokens.get(id) || 0;
        const isStale = () => !container.isConnected || token !== (Html3dComponent.initTokens.get(id) || 0);
        const address = String(options?.address ?? '').trim();
        if (!address) {
            Html3dComponent.showError(container);
            return;
        }
        if (Html3dComponent.webglFailCount >= Html3dComponent.WEBGL_FAIL_LIMIT) {
            Html3dComponent.showError(container, 'three-d.error-webgl');
            return;
        }
        // stale container check (view switched while loading)
        if (isStale()) {
            return;
        }
        let THREE: any, OrbitControls: any, GLTFLoader: any;
        try {
            const [threeMod, controlsMod, loaderMod] = await Promise.all([
                import('three'),
                import('three/examples/jsm/controls/OrbitControls.js'),
                import('three/examples/jsm/loaders/GLTFLoader.js')
            ]);
            THREE = threeMod;
            OrbitControls = controlsMod.OrbitControls;
            GLTFLoader = loaderMod.GLTFLoader;
        } catch (err) {
            console.error('Html3d: three.js chunk load failed', err);
            if (!isStale()) {
                Html3dComponent.showError(container);
            }
            return;
        }
        if (isStale()) {
            return;
        }
        let runtime: Html3dRuntime = null;
        try {
            runtime = new Html3dRuntime(id, viewId, container, options, THREE, OrbitControls, GLTFLoader);
            Html3dComponent.running.set(id, runtime);
        } catch (err) {
            console.error('Html3d: WebGL init failed', err);
            Html3dComponent.webglFailCount++;
            runtime?.dispose();
            if (!isStale()) {
                Html3dComponent.showError(container, 'three-d.error-webgl');
            }
            return;
        }
        runtime.load(EndPointApi.resolveUrl(address));
    }

    static processValue(ga: GaugeSettings, svgele: any, sig: Variable) {
        Html3dComponent.applySignal(ga, sig);
    }

    private static applySignal(ga: GaugeSettings, sig: Variable) {
        const instance = Html3dComponent.running.get(ga?.id);
        if (!instance) {
            return;
        }
        (ga.property?.actions || []).forEach(act => {
            if (act.variableId === sig.id) {
                instance.applyAction(act, sig.value);
            }
        });
    }

    static destroy(id: string) {
        const instance = Html3dComponent.running.get(id);
        if (instance) {
            Html3dComponent.running.delete(id);
            instance.dispose();
        }
    }

    /** release all instances bound to a view (called on view switch/destroy) */
    static destroyByView(viewId: string) {
        if (!viewId) {
            return;
        }
        Html3dComponent.running.forEach((instance, id) => {
            if (instance.viewId === viewId) {
                Html3dComponent.destroy(id);
            }
        });
    }
}

/**
 * Runtime instance: owns the WebGL context, the loaded model and the render loop.
 * All tag driven behaviors are pure mappings stored here and applied per frame.
 */
export class Html3dRuntime {
    id: string;
    viewId?: string;
    private disposed = false;
    private THREE: any;
    private container: HTMLElement;
    private options: any;

    private renderer: any = null;
    private scene: any = null;
    private camera: any = null;
    private controls: any = null;
    private model: any = null;               // Object3D root of the loaded gltf scene
    private clock: any = null;
    private raf = 0;
    private resizeObserver: ResizeObserver = null;
    private loadTimeout: any = null;
    private GLTFLoaderCtor: any = null;

    // tag driven state, updated by processValue, consumed by the render loop
    private rotateSpeed = 0;                  // rad/s applied to model (or part)
    private rotatePart: any = null;           // Object3D to rotate (null = whole model)
    private partColors = new Map<any, any>(); // material -> original color (to restore)
    private pendingColors: Map<string, string> = new Map(); // part name -> css color
    private pendingVisibility: Map<string, boolean> = new Map(); // part name -> visible

    constructor(id: string, viewId: string, container: HTMLElement, options: any, THREE: any, OrbitControls: any, GLTFLoader: any) {
        this.id = id;
        this.viewId = viewId;
        this.container = container;
        this.options = options || {};
        this.THREE = THREE;
        this.GLTFLoaderCtor = GLTFLoader;

        const width = Math.max(container.clientWidth, 1);
        const height = Math.max(container.clientHeight, 1);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(width, height);
        this.renderer.domElement.style.width = '100%';
        this.renderer.domElement.style.height = '100%';
        this.renderer.domElement.style.display = 'block';
        container.innerHTML = '';
        container.appendChild(this.renderer.domElement);

        this.scene = new THREE.Scene();
        const bgColor = String(this.options.bgColor ?? '').trim();
        if (bgColor) {
            this.scene.background = new THREE.Color(bgColor);
        }
        const fov = toNum(this.options.fov, 60);
        this.camera = new THREE.PerspectiveCamera(fov, width / height, 0.1, 2000);

        this.scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
        const dir = new THREE.DirectionalLight(0xffffff, 1.6);
        dir.position.set(2, 4, 3);
        this.scene.add(dir);

        if (OrbitControls) {
            this.controls = new OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.08;
            if (!!this.options.autoRotate) {
                this.controls.autoRotate = true;
                this.controls.autoRotateSpeed = 2.0;
            }
        }

        this.clock = new THREE.Clock();

        this.resizeObserver = new ResizeObserver(() => this.onResize());
        this.resizeObserver.observe(container);

        this.animate();
    }

    /** load the gltf/glb model, with timeout the error placeholder is shown by the caller side map */
    load(url: string) {
        const loader = new this.GLTFLoaderCtor();
        this.loadTimeout = setTimeout(() => {
            if (!this.disposed && !this.model) {
                console.error('Html3d: model load timeout ' + url);
                this.failLoad();
            }
        }, 30000);
        loader.load(url, (gltf) => {
            if (this.disposed) {
                return;
            }
            clearTimeout(this.loadTimeout);
            this.loadTimeout = null;
            this.setModel(gltf.scene);
        }, undefined, (err) => {
            if (this.disposed) {
                return;
            }
            clearTimeout(this.loadTimeout);
            this.loadTimeout = null;
            console.error('Html3d: model load failed ' + url, err);
            this.failLoad();
        });
    }

    private failLoad() {
        Html3dComponent.destroy(this.id);
        Html3dComponent.showError(this.container);
    }

    private setModel(sceneRoot: any) {
        this.model = sceneRoot;
        // frame the model: center it and scale to a unit box, camera at a fixed distance
        const box = new this.THREE.Box3().setFromObject(sceneRoot);
        if (!box.isEmpty()) {
            const size = box.getSize(new this.THREE.Vector3());
            const center = box.getCenter(new this.THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z) || 1;
            const scale = 2 / maxDim;
            sceneRoot.scale.setScalar(scale);
            sceneRoot.position.sub(center.multiplyScalar(scale));
        }
        this.scene.add(sceneRoot);
        this.camera.position.set(1.2, 1.0, 1.8);
        this.camera.lookAt(0, 0, 0);
        if (this.controls) {
            this.controls.update();
        }
        // apply tag states that arrived before the model was ready
        this.pendingVisibility.forEach((visible, part) => {
            this.setPartVisibility(part, visible);
        });
        this.pendingVisibility.clear();
        this.pendingColors.forEach((color, part) => {
            this.setPartColor(part, color);
        });
        this.pendingColors.clear();
    }

    /** tag value -> runtime state (pure mapping, no scene rebuild) */
    applyAction(act: GaugeAction, value: any) {
        if (this.disposed || !act) {
            return;
        }
        const num = Number(value);
        const val = Number.isFinite(num) ? num : 0;
        const min = toNum(act.range?.min, 0);
        const max = toNum(act.range?.max, 100);
        const inRange = val >= min && val <= max;
        const partName = String(act.options?.part ?? '').trim();
        switch (act.type) {
            case 'rotate-speed': {
                // normalize value into [min..max] -> [0..1] -> rad/s (max 1 turn/s)
                const t = max > min ? (val - min) / (max - min) : (val > 0 ? 1 : 0);
                this.rotateSpeed = Math.max(0, Math.min(1, t)) * Math.PI * 2;
                this.rotatePart = partName ? this.findPart(partName) : null;
                break;
            }
            case 'part-visibility': {
                // visible when in range if options.visible != 0, hidden otherwise
                const visibleWhenInRange = toNum(act.options?.visible, 1) !== 0;
                const visible = inRange ? visibleWhenInRange : !visibleWhenInRange;
                if (this.model) {
                    this.setPartVisibility(partName, visible);
                } else {
                    this.pendingVisibility.set(partName, visible);
                }
                break;
            }
            case 'part-color': {
                const color = act.range?.color || '#ff0000';
                if (this.model) {
                    this.setPartColor(partName, color);
                } else {
                    this.pendingColors.set(partName, color);
                }
                break;
            }
        }
    }

    private findPart(partName: string): any {
        if (!this.model || !partName) {
            return null;
        }
        const lower = partName.toLowerCase();
        let found = null;
        this.model.traverse((child) => {
            if (!found && child?.name && child.name.toLowerCase() === lower) {
                found = child;
            }
        });
        return found;
    }

    private setPartVisibility(partName: string, visible: boolean) {
        if (!this.model) {
            return;
        }
        if (!partName) {
            this.model.visible = visible;
            return;
        }
        const part = this.findPart(partName);
        if (part) {
            part.visible = visible;
        }
    }

    private setPartColor(partName: string, cssColor: string) {
        if (!this.model) {
            return;
        }
        const targets: any[] = [];
        if (!partName) {
            this.model.traverse((child) => {
                if (child?.isMesh) {
                    targets.push(child);
                }
            });
        } else {
            const part = this.findPart(partName);
            if (part) {
                part.traverse((child) => {
                    if (child?.isMesh) {
                        targets.push(child);
                    }
                });
            }
        }
        const color = new this.THREE.Color(cssColor);
        targets.forEach(mesh => {
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mats.forEach(mat => {
                if (!mat || !mat.color) {
                    return;
                }
                if (!this.partColors.has(mat)) {
                    this.partColors.set(mat, mat.color.clone());
                }
                mat.color.copy(color);
            });
        });
    }

    private restorePartColors() {
        this.partColors.forEach((original, mat) => {
            try {
                mat.color.copy(original);
            } catch { /* noop */ }
        });
        this.partColors.clear();
    }

    private onResize() {
        if (this.disposed || !this.renderer) {
            return;
        }
        const width = Math.max(this.container.clientWidth, 1);
        const height = Math.max(this.container.clientHeight, 1);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    private animate = () => {
        if (this.disposed) {
            return;
        }
        this.raf = requestAnimationFrame(this.animate);
        const delta = this.clock.getDelta();
        if (this.rotateSpeed) {
            const target = this.rotatePart || this.model;
            if (target) {
                target.rotation.y += this.rotateSpeed * delta;
            }
        }
        if (this.controls) {
            this.controls.update();
        }
        this.renderer.render(this.scene, this.camera);
    }

    /** full WebGL resource release: renderer context + scene graph dispose + rAF cancel */
    dispose() {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        if (this.raf) {
            cancelAnimationFrame(this.raf);
            this.raf = 0;
        }
        if (this.loadTimeout) {
            clearTimeout(this.loadTimeout);
            this.loadTimeout = null;
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        this.restorePartColors();
        if (this.scene) {
            this.scene.traverse((object) => {
                if (object?.isMesh || object?.isPoints || object?.isLine) {
                    const mats = Array.isArray(object.material) ? object.material : [object.material];
                    mats.forEach(mat => {
                        if (!mat) {
                            return;
                        }
                        for (const key in mat) {
                            const value = mat[key];
                            if (value?.isTexture) {
                                value.dispose();
                            }
                        }
                        mat.dispose();
                    });
                    object.geometry?.dispose();
                }
            });
            this.scene.clear();
            this.scene = null;
        }
        if (this.controls) {
            this.controls.dispose();
            this.controls = null;
        }
        this.model = null;
        this.camera = null;
        if (this.renderer) {
            try {
                this.renderer.dispose();
                this.renderer.forceContextLoss();
            } catch (err) {
                console.error('Html3d: renderer dispose', err);
            }
            this.renderer.domElement?.remove();
            this.renderer = null;
        }
    }
}
