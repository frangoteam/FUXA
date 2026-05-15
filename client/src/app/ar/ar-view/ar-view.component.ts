import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';

@Component({
    selector: 'app-ar',
    templateUrl: './ar-view.component.html',
    styleUrls: ['./ar-view.component.scss']
})
export class ArViewComponent implements AfterViewInit, OnDestroy {
    @ViewChild('video', { static: false }) videoRef: ElementRef<HTMLVideoElement>;

    cameraError = '';
    detectorAvailable = false;
    isCameraActive = false;

    private detector: BarcodeDetectorLike;
    private readonly markerTtlMs = 1500;
    private stream: MediaStream;

    private scanTimer?: ReturnType<typeof setTimeout>;
    private scanStopped = false;
    private readonly scanIntervalMs = 700;

    readonly demoMarkers: Record<string, DemoArMarker> = {
        'FUXA-AR': {
            title: 'Demo Machine',
            tags: [
                { name: 'Temperature', value: '23.5 °C' },
                { name: 'Pressure', value: '1.2 bar' },
                { name: 'Status', value: 'Running' }
            ]
        }
    };
    activeMarker: ActiveMarkerState = {
        id: '',
        visible: false,
        lastSeen: 0
    };

    debugLines: string[] = [];
    private debug(message: string, data?: any): void {
        const value = data !== undefined ? `${message}: ${JSON.stringify(data)}` : message;
        this.debugLines = [value, ...this.debugLines].slice(0, 12);
        console.log(message, data ?? '');
    }

    ngAfterViewInit(): void {
        this.startCamera();
    }

    ngOnDestroy(): void {
        this.stopScanLoop();
        this.stopCamera();
    }

    private async startCamera(): Promise<void> {
        try {
            this.debug('secureContext', window.isSecureContext);
            this.debug('getUserMedia', !!navigator.mediaDevices?.getUserMedia);
            this.debug('BarcodeDetector', 'BarcodeDetector' in window);

            if (!window.isSecureContext) {
                this.cameraError = 'Camera requires HTTPS or localhost.';
                this.debug('error', this.cameraError);
                return;
            }

            if (!navigator.mediaDevices?.getUserMedia) {
                this.cameraError = 'Camera API not available in this browser.';
                this.debug('error', this.cameraError);
                return;
            }

            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: 'environment' }
                },
                audio: false
            });

            this.debug('camera stream created');

            const video = this.videoRef?.nativeElement;
            if (!video) {
                this.debug('video element missing');
                return;
            }

            video.srcObject = this.stream;
            await video.play();

            this.debug('video started', {
                width: video.videoWidth,
                height: video.videoHeight,
                readyState: video.readyState
            });

            this.isCameraActive = true;

            this.initDetector();
            this.startScanLoop();
            this.debug('detectorAvailable', this.detectorAvailable);

        } catch (err) {
            this.cameraError = 'Camera access failed. Use HTTPS or localhost and allow camera permission.';
            this.debug('camera error', String(err));
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
            this.debug('scan skipped', {
                detector: !!this.detector,
                video: !!this.videoRef?.nativeElement
            });
            return;
        }

        try {
            const results = await this.detector.detect(this.videoRef.nativeElement);

            this.debug('scan results', results?.map(item => item.rawValue));

            if (results?.length) {
                const markerId = results[0].rawValue;
                const marker = this.demoMarkers[markerId];
                if (marker) {
                    this.activeMarker = {
                        id: markerId,
                        visible: true,
                        lastSeen: Date.now(),
                        data: marker
                    };
                }
                this.debug('marker detected', markerId);
            }
            this.updateMarkerVisibility();
        } catch (err) {
            this.debug('scan error', String(err));
            console.warn('AR marker scan error', err);
        }
        this.scheduleNextScan();
    }

    private updateMarkerVisibility(): void {
        if (!this.activeMarker?.visible) {
            return;
        }

        if (Date.now() - this.activeMarker.lastSeen > this.markerTtlMs) {
            this.clearActiveMarker();
        }
    }

    private clearActiveMarker(): void {
        this.activeMarker = {
            id: '',
            visible: false,
            lastSeen: 0
        };
    }

    private stopScanLoop(): void {
        this.scanStopped = true;

        if (this.scanTimer) {
            clearTimeout(this.scanTimer);
            this.scanTimer = undefined;
        }
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

interface DemoArMarker {
    title: string;
    tags: DemoArTag[];
}

interface DemoArTag {
    name: string;
    value: string;
}
interface ActiveMarkerState {
    id: string;
    visible: boolean;
    lastSeen: number;
    data?: DemoArMarker;
}