"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleLoadTemplate = exports.downloadJsonFile = exports.readFile = exports.getBlankTemplate = exports.isJsonString = exports.generatePDF = exports.translations = exports.getFontsData = void 0;
exports.fromKebabCase = fromKebabCase;
const common_1 = require("@pdfme/common");
const generator_1 = require("@pdfme/generator");
const plugins_1 = require("./plugins");
function fromKebabCase(str) {
    return str
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}
const getFontsData = () => ({
    ...(0, common_1.getDefaultFont)(),
    'PinyonScript-Regular': {
        fallback: false,
        data: 'https://fonts.gstatic.com/s/pinyonscript/v22/6xKpdSJbL9-e9LuoeQiDRQR8aOLQO4bhiDY.ttf',
    },
    NotoSerifJP: {
        fallback: false,
        data: 'https://fonts.gstatic.com/s/notoserifjp/v30/xn71YHs72GKoTvER4Gn3b5eMRtWGkp6o7MjQ2bwxOubAILO5wBCU.ttf',
    },
    NotoSansJP: {
        fallback: false,
        data: 'https://fonts.gstatic.com/s/notosansjp/v53/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEj75vY0rw-oME.ttf',
    }
});
exports.getFontsData = getFontsData;
exports.translations = [
    { value: 'en', label: 'English' },
    { value: 'zh', label: 'Chinese' },
    { value: 'ko', label: 'Korean' },
    { value: 'ja', label: 'Japanese' },
    { value: 'ar', label: 'Arabic' },
    { value: 'th', label: 'Thai' },
    { value: 'pl', label: 'Polish' },
    { value: 'it', label: 'Italian' },
    { value: 'de', label: 'German' },
    { value: 'fr', label: 'French' },
    { value: 'es', label: 'Spanish' },
];
const generatePDF = async (currentRef) => {
    if (!currentRef)
        return;
    const template = currentRef.getTemplate();
    const options = currentRef.getOptions();
    const inputs = typeof currentRef.getInputs === 'function'
        ? currentRef.getInputs()
        : (0, common_1.getInputFromTemplate)(template);
    const font = (0, exports.getFontsData)();
    try {
        const pdf = await (0, generator_1.generate)({
            template,
            inputs,
            options: {
                font,
                lang: options.lang,
                title: 'pdfme',
            },
            plugins: (0, plugins_1.getPlugins)(),
        });
        const blob = new Blob([pdf.buffer], { type: 'application/pdf' });
        window.open(URL.createObjectURL(blob));
    }
    catch (e) {
        alert(e + '\n\nCheck the console for full stack trace');
        throw e;
    }
};
exports.generatePDF = generatePDF;
const isJsonString = (str) => {
    try {
        JSON.parse(str);
    }
    catch (e) {
        return false;
    }
    return true;
};
exports.isJsonString = isJsonString;
const getBlankTemplate = () => ({
    schemas: [{}],
    basePdf: {
        width: 210,
        height: 297,
        padding: [20, 10, 20, 10],
    },
});
exports.getBlankTemplate = getBlankTemplate;
const readFile = (file, dataType = 'dataURL') => new Promise((r) => {
    const fileReader = new FileReader();
    fileReader.addEventListener('load', (e) => {
        if (e && e.target && e.target.result && dataType === 'dataURL') {
            r(e.target.result);
        }
        else if (e && e.target && e.target.result && dataType === 'arrayBuffer') {
            r(e.target.result);
        }
        else if (e && e.target && e.target.result && dataType === 'text') {
            r(e.target.result);
        }
    });
    if (dataType === 'dataURL') {
        fileReader.readAsDataURL(file);
    }
    else if (dataType === 'arrayBuffer') {
        fileReader.readAsArrayBuffer(file);
    }
    else if (dataType === 'text') {
        fileReader.readAsText(file);
    }
});
exports.readFile = readFile;
const downloadJsonFile = (data, title) => {
    const dataStr = JSON.stringify(data, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `${title}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
};
exports.downloadJsonFile = downloadJsonFile;
const handleLoadTemplate = (jsonString) => {
    try {
        const template = JSON.parse(jsonString);
        (0, common_1.checkTemplate)(template);
        return template;
    }
    catch (e) {
        console.error(e);
        throw e;
    }
};
exports.handleLoadTemplate = handleLoadTemplate;
