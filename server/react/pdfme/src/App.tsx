import { Routes, Route, useNavigate } from "react-router-dom";
import { ToastContainer } from 'react-toastify';
import { useEffect } from 'react';
import Designer from "./routes/Designer";
import FormAndViewer from "./routes/FormAndViewer";

export default function App() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'navigate') {
        const { mode, reportId } = event.data.payload;
        if (mode === 'designer') {
          navigate(`/designer${reportId ? `?report=${reportId}` : ''}`);
        } else if (mode === 'form-viewer') {
          navigate(`/form-viewer${reportId ? `?report=${reportId}` : ''}`);
        } else if (mode === 'templates') {
          navigate('/templates');
        }
      } else if (event.data.type === 'SAVE_TEMPLATE') {
        // Get the full template data and generate thumbnail
        const template = (window as any).getTemplate?.();
        if (template) {
          // Generate thumbnail by creating PDF and converting first page to image
          const generateThumbnail = async () => {
            try {
              const { generate } = await import('@pdfme/generator');
              const { pdf2img } = await import('@pdfme/converter');
              const { getFontsData } = await import('./helper');
              const { getInputFromTemplate } = await import('@pdfme/common');
              const plugins = await import('./plugins').then(m => m.getPlugins());

              const inputs = getInputFromTemplate(template);
              const font = getFontsData();

              // Generate PDF from template
              const pdfBuffer = await generate({
                template,
                inputs,
                options: {
                  font,
                  lang: 'en'
                },
                plugins
              });

              // Convert first page of PDF to PNG thumbnail
              const images = await pdf2img(pdfBuffer, {
                imageType: 'png',
                range: { end: 1 }
              });

              // Convert PNG buffer to data URL
              const thumbnailBuffer = images[0];
              const blob = new Blob([thumbnailBuffer], { type: 'image/png' });
              const reader = new FileReader();
              reader.onload = () => {
                const thumbnailDataUrl = reader.result as string;
                window.parent.postMessage({
                  type: 'TEMPLATE_SAVED',
                  template,
                  thumbnail: thumbnailDataUrl
                }, '*');
              };
              reader.readAsDataURL(blob);
            } catch (error) {
              console.error('Error generating thumbnail:', error);
              window.parent.postMessage({
                type: 'TEMPLATE_SAVE_ERROR',
                error: error
              }, '*');
            }
          };

          generateThumbnail();
        }
      } else if (event.data.type === 'GET_TEMPLATE') {
        // Just get the template data without generating thumbnail
        const template = (window as any).getTemplate?.();
        if (template) {
          window.parent.postMessage({
            type: 'TEMPLATE_DATA',
            template
          }, '*');
        }
      } else if (event.data.type === 'UPDATE_SETTINGS') {
        // Update pdfme settings
        const { settings } = event.data;
        if ((window as any).updateSettings) {
          (window as any).updateSettings(settings);
        }
      } else if (event.data.type === 'GENERATE_PDF') {
        // Trigger the generate PDF button click
        const generatePdfButton = document.getElementById('generate-pdf') as HTMLButtonElement;
        if (generatePdfButton && !generatePdfButton.disabled) {
          generatePdfButton.click();
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col">
      <Routes>
        <Route path={"/"} element={<Designer />} />
        <Route path={"/designer"} element={<Designer />} />
        <Route path="/form-viewer" element={<FormAndViewer />} />
      </Routes>
      <ToastContainer />
    </div>
  );
}
