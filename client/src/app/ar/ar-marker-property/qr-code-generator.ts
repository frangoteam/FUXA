const QR_ECC_FORMAT_BITS_LOW = 1;
const QR_MASK = 0;

interface QrVersionInfo {
    version: number;
    dataCodewords: number;
    eccCodewords: number;
}

const QR_VERSIONS: QrVersionInfo[] = [
    { version: 1, dataCodewords: 19, eccCodewords: 7 },
    { version: 2, dataCodewords: 34, eccCodewords: 10 },
    { version: 3, dataCodewords: 55, eccCodewords: 15 },
    { version: 4, dataCodewords: 80, eccCodewords: 20 }
];

export function createQrSvgDataUrl(text: string): string {
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(createQrSvg(text))}`;
}

export function createQrSvg(text: string): string {
    const matrix = createQrMatrix(text || ' ');
    const quietZone = 4;
    const moduleSize = 6;
    const size = matrix.length + quietZone * 2;
    const rects: string[] = [];

    matrix.forEach((row, y) => {
        row.forEach((module, x) => {
            if (module) {
                rects.push(`<rect x="${(x + quietZone) * moduleSize}" y="${(y + quietZone) * moduleSize}" width="${moduleSize}" height="${moduleSize}"/>`);
            }
        });
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size * moduleSize} ${size * moduleSize}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">${rects.join('')}</g></svg>`;
}

function createQrMatrix(text: string): boolean[][] {
    const dataBytes = Array.from(new TextEncoder().encode(text));
    const versionInfo = getVersionInfo(dataBytes.length);
    const dataCodewords = createDataCodewords(dataBytes, versionInfo.dataCodewords);
    const eccCodewords = createEccCodewords(dataCodewords, versionInfo.eccCodewords);
    const allCodewords = dataCodewords.concat(eccCodewords);
    const size = versionInfo.version * 4 + 17;
    const modules: (boolean | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
    const reserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

    drawFunctionPatterns(modules, reserved, versionInfo.version);
    drawCodewords(modules, reserved, codewordsToBits(allCodewords));
    applyMask(modules, reserved);
    drawFormatBits(modules, reserved);

    return modules.map(row => row.map(module => !!module));
}

function getVersionInfo(byteLength: number): QrVersionInfo {
    const requiredBits = 4 + 8 + byteLength * 8;
    const versionInfo = QR_VERSIONS.find(item => item.dataCodewords * 8 >= requiredBits + 4);
    if (!versionInfo) {
        throw new Error('AR marker ID is too long for QR preview.');
    }
    return versionInfo;
}

function createDataCodewords(dataBytes: number[], dataCodewordCount: number): number[] {
    const bits: number[] = [];
    appendBits(bits, 0x4, 4);
    appendBits(bits, dataBytes.length, 8);
    dataBytes.forEach(value => appendBits(bits, value, 8));
    appendBits(bits, 0, Math.min(4, dataCodewordCount * 8 - bits.length));
    while (bits.length % 8) {
        bits.push(0);
    }

    const dataCodewords: number[] = [];
    for (let i = 0; i < bits.length; i += 8) {
        dataCodewords.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0));
    }
    for (let pad = 0xec; dataCodewords.length < dataCodewordCount; pad ^= 0xec ^ 0x11) {
        dataCodewords.push(pad);
    }
    return dataCodewords;
}

function appendBits(bits: number[], value: number, length: number) {
    for (let i = length - 1; i >= 0; i--) {
        bits.push((value >>> i) & 1);
    }
}

function codewordsToBits(codewords: number[]): number[] {
    const bits: number[] = [];
    codewords.forEach(codeword => appendBits(bits, codeword, 8));
    return bits;
}

function drawFunctionPatterns(modules: (boolean | null)[][], reserved: boolean[][], version: number) {
    const size = modules.length;
    drawFinderPattern(modules, reserved, 3, 3);
    drawFinderPattern(modules, reserved, size - 4, 3);
    drawFinderPattern(modules, reserved, 3, size - 4);

    for (let i = 8; i < size - 8; i++) {
        setFunctionModule(modules, reserved, 6, i, i % 2 === 0);
        setFunctionModule(modules, reserved, i, 6, i % 2 === 0);
    }

    getAlignmentCenters(version).forEach(row => {
        getAlignmentCenters(version).forEach(col => {
            if (!reserved[row][col]) {
                drawAlignmentPattern(modules, reserved, col, row);
            }
        });
    });

    for (let i = 0; i < 8; i++) {
        reserveModule(reserved, 8, i);
        reserveModule(reserved, i, 8);
    }
    for (let i = size - 8; i < size; i++) {
        reserveModule(reserved, 8, i);
        reserveModule(reserved, i, 8);
    }
    setFunctionModule(modules, reserved, 8, size - 8, true);
}

function drawFinderPattern(modules: (boolean | null)[][], reserved: boolean[][], centerX: number, centerY: number) {
    for (let y = -4; y <= 4; y++) {
        for (let x = -4; x <= 4; x++) {
            const distance = Math.max(Math.abs(x), Math.abs(y));
            const xx = centerX + x;
            const yy = centerY + y;
            if (yy >= 0 && yy < modules.length && xx >= 0 && xx < modules.length) {
                setFunctionModule(modules, reserved, xx, yy, distance !== 2 && distance !== 4);
            }
        }
    }
}

function drawAlignmentPattern(modules: (boolean | null)[][], reserved: boolean[][], centerX: number, centerY: number) {
    for (let y = -2; y <= 2; y++) {
        for (let x = -2; x <= 2; x++) {
            setFunctionModule(modules, reserved, centerX + x, centerY + y, Math.max(Math.abs(x), Math.abs(y)) !== 1);
        }
    }
}

function getAlignmentCenters(version: number): number[] {
    if (version === 1) {
        return [];
    }
    return [6, version * 4 + 10];
}

function drawCodewords(modules: (boolean | null)[][], reserved: boolean[][], bits: number[]) {
    const size = modules.length;
    let bitIndex = 0;
    let upward = true;

    for (let right = size - 1; right >= 1; right -= 2) {
        if (right === 6) {
            right--;
        }
        for (let vert = 0; vert < size; vert++) {
            const y = upward ? size - 1 - vert : vert;
            for (let j = 0; j < 2; j++) {
                const x = right - j;
                if (!reserved[y][x]) {
                    modules[y][x] = bitIndex < bits.length ? bits[bitIndex++] === 1 : false;
                }
            }
        }
        upward = !upward;
    }
}

function applyMask(modules: (boolean | null)[][], reserved: boolean[][]) {
    modules.forEach((row, y) => {
        row.forEach((_, x) => {
            if (!reserved[y][x] && (x + y) % 2 === QR_MASK) {
                modules[y][x] = !modules[y][x];
            }
        });
    });
}

function drawFormatBits(modules: (boolean | null)[][], reserved: boolean[][]) {
    const size = modules.length;
    const data = QR_ECC_FORMAT_BITS_LOW << 3 | QR_MASK;
    let remainder = data;
    for (let i = 0; i < 10; i++) {
        remainder = (remainder << 1) ^ (((remainder >>> 9) & 1) ? 0x537 : 0);
    }
    const bits = ((data << 10) | remainder) ^ 0x5412;

    for (let i = 0; i <= 5; i++) {
        setFunctionModule(modules, reserved, 8, i, getBit(bits, i));
    }
    setFunctionModule(modules, reserved, 8, 7, getBit(bits, 6));
    setFunctionModule(modules, reserved, 8, 8, getBit(bits, 7));
    setFunctionModule(modules, reserved, 7, 8, getBit(bits, 8));
    for (let i = 9; i < 15; i++) {
        setFunctionModule(modules, reserved, 14 - i, 8, getBit(bits, i));
    }

    for (let i = 0; i < 8; i++) {
        setFunctionModule(modules, reserved, size - 1 - i, 8, getBit(bits, i));
    }
    for (let i = 8; i < 15; i++) {
        setFunctionModule(modules, reserved, 8, size - 15 + i, getBit(bits, i));
    }
    setFunctionModule(modules, reserved, 8, size - 8, true);
}

function getBit(value: number, index: number): boolean {
    return ((value >>> index) & 1) !== 0;
}

function setFunctionModule(modules: (boolean | null)[][], reserved: boolean[][], x: number, y: number, value: boolean) {
    modules[y][x] = value;
    reserved[y][x] = true;
}

function reserveModule(reserved: boolean[][], x: number, y: number) {
    reserved[y][x] = true;
}

function createEccCodewords(data: number[], degree: number): number[] {
    const generator = createGeneratorPolynomial(degree);
    const result = Array(degree).fill(0);
    data.forEach(value => {
        const factor = value ^ result.shift();
        result.push(0);
        generator.forEach((coefficient, index) => {
            result[index] ^= multiplyGalois(coefficient, factor);
        });
    });
    return result;
}

function createGeneratorPolynomial(degree: number): number[] {
    let result = [1];
    for (let i = 0; i < degree; i++) {
        result = multiplyPolynomials(result, [1, powerGalois(2, i)]);
    }
    return result.slice(1);
}

function multiplyPolynomials(left: number[], right: number[]): number[] {
    const result = Array(left.length + right.length - 1).fill(0);
    left.forEach((leftValue, i) => {
        right.forEach((rightValue, j) => {
            result[i + j] ^= multiplyGalois(leftValue, rightValue);
        });
    });
    return result;
}

function multiplyGalois(left: number, right: number): number {
    if (left === 0 || right === 0) {
        return 0;
    }
    return QR_EXP[(QR_LOG[left] + QR_LOG[right]) % 255];
}

function powerGalois(value: number, power: number): number {
    if (value === 0) {
        return 0;
    }
    return QR_EXP[(QR_LOG[value] * power) % 255];
}

const QR_EXP: number[] = [];
const QR_LOG: number[] = [];

let value = 1;
for (let i = 0; i < 255; i++) {
    QR_EXP[i] = value;
    QR_LOG[value] = i;
    value <<= 1;
    if (value & 0x100) {
        value ^= 0x11d;
    }
}
