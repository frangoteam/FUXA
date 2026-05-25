import * as QRCode from 'qrcode';

const QUIET_ZONE = 4;
const MODULE_SIZE = 6;

export function createQrSvgDataUrl(text: string): string {
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(createQrSvg(text))}`;
}

export function createQrSvg(text: string): string {
    const value = text || ' ';
    const qr = QRCode.create(value, {
        errorCorrectionLevel: 'L'
    });
    const qrSize = qr.modules.size;
    const size = qrSize + QUIET_ZONE * 2;
    const rects: string[] = [];

    for (let y = 0; y < qrSize; y++) {
        for (let x = 0; x < qrSize; x++) {
            if (qr.modules.get(y, x)) {
                rects.push(`<rect x="${(x + QUIET_ZONE) * MODULE_SIZE}" y="${(y + QUIET_ZONE) * MODULE_SIZE}" width="${MODULE_SIZE}" height="${MODULE_SIZE}"/>`);
            }
        }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size * MODULE_SIZE} ${size * MODULE_SIZE}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">${rects.join('')}</g></svg>`;
}
