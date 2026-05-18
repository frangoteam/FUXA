import { Injectable } from '@angular/core';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

export interface ArMarkerScanResult {
    rawValue: string;
}

export type ArMarkerScannerMode = 'barcode-detector' | 'html5-qrcode' | 'none';

@Injectable()
export class ArMarkerScannerService {
    private barcodeDetector: BarcodeDetectorLike;
    private html5Qrcode: Html5Qrcode;
    private html5QrcodeElement: HTMLDivElement;
    private canvas: HTMLCanvasElement;
    private context: CanvasRenderingContext2D;
    private mode: ArMarkerScannerMode = 'none';
    private readonly maxScanFrameSize = 960;

    init(): ArMarkerScannerMode {
        const detectorCtor = (window as any).BarcodeDetector as BarcodeDetectorConstructorLike;
        if (detectorCtor) {
            this.barcodeDetector = new detectorCtor({
                formats: ['qr_code']
            });
            this.mode = 'barcode-detector';
            return this.mode;
        }

        this.html5QrcodeElement = document.createElement('div');
        this.html5QrcodeElement.id = `ar-html5-qrcode-${Date.now()}`;
        this.html5QrcodeElement.style.display = 'none';
        document.body.appendChild(this.html5QrcodeElement);

        this.html5Qrcode = new Html5Qrcode(this.html5QrcodeElement.id, {
            formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
            useBarCodeDetectorIfSupported: false,
            verbose: false
        });
        this.canvas = document.createElement('canvas');
        this.context = this.canvas.getContext('2d');
        this.mode = this.context ? 'html5-qrcode' : 'none';
        return this.mode;
    }

    get scannerMode(): ArMarkerScannerMode {
        return this.mode;
    }

    get available(): boolean {
        return this.mode !== 'none';
    }

    async scan(video: HTMLVideoElement): Promise<ArMarkerScanResult[]> {
        if (this.mode === 'barcode-detector') {
            const results = await this.barcodeDetector.detect(video);
            return (results || []).map(result => ({ rawValue: result.rawValue }));
        }

        if (this.mode === 'html5-qrcode') {
            return this.scanWithHtml5Qrcode(video);
        }

        return [];
    }

    destroy(): void {
        try {
            this.html5Qrcode?.clear();
        } catch (_) {
            // html5-qrcode may throw if it was never rendered.
        }
        this.html5QrcodeElement?.remove();
        this.html5Qrcode = undefined;
        this.html5QrcodeElement = undefined;
        this.mode = 'none';
    }

    private async scanWithHtml5Qrcode(video: HTMLVideoElement): Promise<ArMarkerScanResult[]> {
        const width = video.videoWidth || video.clientWidth;
        const height = video.videoHeight || video.clientHeight;
        if (!width || !height || !this.context) {
            return [];
        }

        const scale = Math.min(1, this.maxScanFrameSize / Math.max(width, height));
        const scanWidth = Math.round(width * scale);
        const scanHeight = Math.round(height * scale);

        if (this.canvas.width !== scanWidth || this.canvas.height !== scanHeight) {
            this.canvas.width = scanWidth;
            this.canvas.height = scanHeight;
        }

        this.context.drawImage(video, 0, 0, scanWidth, scanHeight);
        try {
            const file = await this.getCanvasImageFile();
            const result = await this.html5Qrcode.scanFileV2(file, false);
            const rawValue = result?.decodedText || '';
            return rawValue ? [{ rawValue }] : [];
        } catch (_) {
            return [];
        }
    }

    private getCanvasImageFile(): Promise<File> {
        return new Promise((resolve, reject) => {
            this.canvas.toBlob(blob => {
                if (!blob) {
                    reject(new Error('Unable to capture QR scan frame.'));
                    return;
                }

                resolve(new File([blob], 'ar-marker-frame.png', { type: 'image/png' }));
            }, 'image/png');
        });
    }
}

interface BarcodeDetectorLike {
    detect(source: HTMLVideoElement): Promise<DetectedBarcodeLike[]>;
}

interface DetectedBarcodeLike {
    rawValue: string;
}

interface BarcodeDetectorConstructorLike {
    new(options?: { formats?: string[] }): BarcodeDetectorLike;
}
