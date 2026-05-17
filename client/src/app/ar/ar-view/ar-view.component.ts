import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';

import { View } from '../../_models/hmi';
import { ProjectService } from '../../_services/project.service';
import { GaugesManager } from '../../gauges/gauges.component';
import { ArViewService, ArVisibleMarker } from './ar-view.service';

@Component({
    selector: 'app-ar',
    templateUrl: './ar-view.component.html',
    styleUrls: ['./ar-view.component.scss'],
    providers: [ArViewService]
})
export class ArViewComponent implements AfterViewInit, OnDestroy {
    @ViewChild('video', { static: false }) videoRef: ElementRef<HTMLVideoElement>;

    cameraError = '';
    detectorAvailable = false;
    isCameraActive = false;
    activeMarkerId = '';
    debugEnabled = true;
    debugLines: string[] = [];

    private detector: BarcodeDetectorLike;
    private stream: MediaStream;
    private scanTimer?: ReturnType<typeof setTimeout>;
    private scanStopped = false;
    private readonly scanIntervalMs = 700;
    private hmiLoadSubscription: Subscription;
    private pendingMarkerId = '';

    constructor(
        public arViewService: ArViewService,
        public gaugesManager: GaugesManager,
        public projectService: ProjectService
    ) { }

    get visibleMarkers(): ArVisibleMarker[] {
        return this.arViewService.visibleMarkers;
    }

    ngAfterViewInit(): void {
        this.hmiLoadSubscription = this.projectService.onLoadHmi.subscribe(() => {
            if (this.pendingMarkerId && this.arViewService.detectMarker(this.pendingMarkerId)) {
                this.activeMarkerId = this.pendingMarkerId;
                this.addDebugLine(`pending marker mapped marker=${this.pendingMarkerId}`);
                this.pendingMarkerId = '';
            }
            this.addDebugLine(`ar enabled=${this.arViewService.debugState.arEnabled} markers=${this.arViewService.debugState.configuredMarkers}`);
        });
        this.startCamera();
    }

    ngOnDestroy(): void {
        this.stopScanLoop();
        this.stopCamera();
        this.arViewService.clear();
        if (this.hmiLoadSubscription) {
            this.hmiLoadSubscription.unsubscribe();
        }
    }

    getMarkerView(viewId: string): View {
        return this.projectService.getViewFromId(viewId);
    }

    private async startCamera(): Promise<void> {
        try {
            if (!window.isSecureContext) {
                this.cameraError = 'Camera requires HTTPS or localhost.';
                return;
            }

            if (!navigator.mediaDevices?.getUserMedia) {
                this.cameraError = 'Camera API not available in this browser.';
                return;
            }

            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: 'environment' }
                },
                audio: false
            });

            const video = this.videoRef?.nativeElement;
            if (!video) {
                return;
            }

            video.srcObject = this.stream;
            await video.play();

            this.isCameraActive = true;
            this.initDetector();
            this.startScanLoop();
        } catch (err) {
            this.cameraError = 'Camera access failed. Use HTTPS or localhost and allow camera permission.';
            console.error('AR camera error', err);
        }
    }

    private stopCamera(): void {
        this.stream?.getTracks().forEach(track => track.stop());
        this.stream = undefined;
    }

    private initDetector(): void {
        const detectorCtor = (window as any).BarcodeDetector as BarcodeDetectorConstructorLike;
        this.detectorAvailable = !!detectorCtor;

        if (!this.detectorAvailable) {
            return;
        }

        this.detector = new detectorCtor({
            formats: ['qr_code']
        });
    }

    private startScanLoop(): void {
        if (!this.detector) {
            return;
        }

        this.scanStopped = false;
        this.scheduleNextScan(0);
    }

    private scheduleNextScan(delayMs = this.scanIntervalMs): void {
        if (this.scanStopped) {
            return;
        }

        if (this.scanTimer) {
            clearTimeout(this.scanTimer);
        }

        this.scanTimer = setTimeout(() => this.scan(), delayMs);
    }

    private async scan(): Promise<void> {
        if (this.scanStopped || !this.detector || !this.videoRef?.nativeElement) {
            return;
        }

        try {
            const results = await this.scanBarcodeMarkers();

            if (results?.length) {
                const markerId = (results[0].rawValue || '').trim();
                let mapped = this.arViewService.detectMarker(markerId);
                if (!mapped) {
                    this.arViewService.refreshProjectMapping();
                    mapped = this.arViewService.detectMarker(markerId);
                }
                if (mapped) {
                    this.activeMarkerId = markerId;
                } else {
                    this.pendingMarkerId = markerId;
                }
                const marker = this.visibleMarkers.find(item => item.id === markerId);
                this.addDebugLine(`detected marker=${markerId} mapped=${mapped} view=${marker?.label || '-'}`);
                if (!mapped) {
                    this.addDebugLine(`known markers=${this.arViewService.getKnownMarkerIds().join(',') || '-'}`);
                }
            }

            this.arViewService.updateMarkerVisibility().forEach(event => {
                this.addDebugLine(`removed marker=${event.markerId} view=${event.viewId || '-'}`);
            });
        } catch (err) {
            this.addDebugLine(`scan error=${String(err)}`);
            console.warn('AR marker scan error', err);
        }

        this.scheduleNextScan();
    }

    private scanBarcodeMarkers(): Promise<DetectedBarcodeLike[]> {
        return this.detector.detect(this.videoRef.nativeElement);
    }

    private stopScanLoop(): void {
        this.scanStopped = true;

        if (this.scanTimer) {
            clearTimeout(this.scanTimer);
            this.scanTimer = undefined;
        }
    }

    private addDebugLine(message: string): void {
        if (!this.debugEnabled) {
            return;
        }
        const line = `${new Date().toLocaleTimeString()} ${message}`;
        if (this.debugLines[0] === line) {
            return;
        }
        this.debugLines = [line, ...this.debugLines].slice(0, 8);
    }
}

interface BarcodeDetectorLike {
    detect(source: HTMLVideoElement): Promise<DetectedBarcodeLike[]>;
}

interface DetectedBarcodeLike {
    rawValue: string;
    boundingBox?: DOMRectReadOnly;
}

interface BarcodeDetectorConstructorLike {
    new(options?: { formats?: string[] }): BarcodeDetectorLike;
}
