import { ZOOM, Plugin, Schema } from '@pdfme/common';
import SignaturePad from 'signature_pad';
import { image } from '@pdfme/schemas';

interface Signature extends Schema {}

const getEffectiveScale = (element: HTMLElement | null) => {
  let scale = 1;
  while (element && element !== document.body) {
    const style = window.getComputedStyle(element);
    const transform = style.transform;
    if (transform && transform !== 'none') {
      const localScale = parseFloat(transform.match(/matrix\((.+)\)/)?.[1].split(', ')[3] || '1');
      scale *= localScale;
    }
    element = element.parentElement;
  }
  return scale;
};

export const signature: Plugin<Signature> = {
  ui: async (arg) => {
    const { schema, value, onChange, rootElement, mode, i18n } = arg;

    const canvas = document.createElement('canvas');
    canvas.width = schema.width * ZOOM;
    canvas.height = schema.height * ZOOM;
    const resetScale = 1 / getEffectiveScale(rootElement);
    canvas.getContext('2d')!.scale(resetScale, resetScale);

    const signaturePad = new SignaturePad(canvas);
    try {
      value ? signaturePad.fromDataURL(value, { ratio: resetScale }) : signaturePad.clear();
    } catch (e) {
      console.error(e);
    }

    if (mode === 'viewer' || (mode === 'form' && schema.readOnly)) {
      signaturePad.off();
    } else {
      signaturePad.on();
      const clearButton = document.createElement('button');
      clearButton.style.position = 'absolute';
      clearButton.style.zIndex = '1';
      clearButton.textContent = i18n('signature.clear') || 'x';
      clearButton.addEventListener('click', () => {
        onChange && onChange({ key: 'content', value: '' });
      });
      rootElement.appendChild(clearButton);
      signaturePad.addEventListener('endStroke', () => {
        const data = signaturePad.toDataURL('image/png');
        onChange && data && onChange({ key: 'content', value: data });
      });
    }
    rootElement.appendChild(canvas);
  },
  pdf: image.pdf,
  propPanel: {
    schema: {},
    defaultSchema: {
      name: '',
      type: 'signature',
      content:
        'data:image/png;base64,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',
      position: { x: 0, y: 0 },
      width: 62.5,
      height: 37.5,
    },
  },
  // icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pen"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
};
