import { useRef, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from 'react-toastify';
import { Template, checkTemplate, getInputFromTemplate } from "@pdfme/common";
import { Form, Viewer } from "@pdfme/ui";
import {
  getFontsData,
  getTemplateById,
  getBlankTemplate,
  generatePDF,
  getReportById,
} from "../helper";
import { getPlugins } from '../plugins';

type Mode = "form" | "viewer";


function FormAndViewerApp() {
  const [searchParams, setSearchParams] = useSearchParams();
  const uiRef = useRef<HTMLDivElement | null>(null);
  const ui = useRef<Form | Viewer | null>(null);

  const [mode, setMode] = useState<Mode>(
    (localStorage.getItem("mode") as Mode) ?? "form"
  );

  const buildUi = useCallback(async (mode: Mode, providedTemplate?: Template) => {
    if (!uiRef.current) return;
    
    try {
      let template: Template = providedTemplate || getBlankTemplate();
      const templateIdFromQuery = searchParams.get("template");
      const reportIdFromQuery = searchParams.get("report");
      searchParams.delete("template");
      // Don't delete "report" param so it can be used on re-navigation
      setSearchParams(searchParams, { replace: true });
      const templateFromLocal = localStorage.getItem("template");

      if (!providedTemplate) {
        if (reportIdFromQuery) {
          // Load report from server API
          const report = await getReportById(reportIdFromQuery);
          if (report && report.pdfmeData && report.pdfmeData.template) {
            template = report.pdfmeData.template;
            checkTemplate(template);
          }
        } else if (templateIdFromQuery) {
          const templateJson = await getTemplateById(templateIdFromQuery);
          checkTemplate(templateJson);
          template = templateJson;

          if (!templateFromLocal) {
            localStorage.setItem("template", JSON.stringify(templateJson));
          }
        } else if (templateFromLocal) {
          const templateJson = JSON.parse(templateFromLocal) as Template;
          checkTemplate(templateJson);
          template = templateJson;
        }
      }

      let inputs = getInputFromTemplate(template);
      const inputsString = localStorage.getItem("inputs");
      if (inputsString) {
        const inputsJson = JSON.parse(inputsString);
        inputs = inputsJson;
      }

      ui.current = new (mode === "form" ? Form : Viewer)({
        domContainer: uiRef.current,
        template,
        inputs,
        options: {
          font: getFontsData(),
          lang: 'en',
          labels: { 'signature.clear': 'Clear' },
          theme: {
            token: {
              colorPrimary: '#25c2a0',
            },
          },
        },
        plugins: getPlugins(),
      });

      (window as any).getTemplate = () => {
        try {
          return ui.current?.getTemplate();
        } catch (error) {
          console.warn('UI instance is destroyed, cannot get template:', error);
          return null;
        }
      };
    } catch {
      localStorage.removeItem("inputs");
      localStorage.removeItem("template");
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'LOAD_TEMPLATE') {
        const { template } = event.data;
        if (template) {
          checkTemplate(template);
          // Create new UI with the loaded template
          buildUi(mode, template);
        }
      } else if (event.data.type === 'UPDATE_TEMPLATE_BASEPDF') {
        const { basePdf } = event.data;
        if (ui.current) {
          const template = ui.current.getTemplate();
          if (basePdf === '' || basePdf === null || basePdf === undefined) {
            // Clear the basePdf - use default blank PDF
            template.basePdf = { width: 210, height: 297, padding: [10, 10, 10, 10] };
          } else {
            template.basePdf = basePdf;
          }
          // Rebuild UI with updated template
          buildUi(mode, template);
        }
      } else if (event.data.type === 'UPDATE_SETTINGS') {
        const { settings } = event.data;
        if (ui.current && settings) {
          // Update UI options
          if (settings.language) {
            ui.current.updateOptions({ lang: settings.language });
          }
          // Note: Other settings like pageSize might need to be handled differently
        }
      } else if (event.data.type === 'GENERATE_PDF') {
        // Handle PDF generation from Angular client
        if (ui.current) {
          generatePDF(ui.current).then(() => {
            toast.info('PDF generated successfully');
          }).catch((error) => {
            console.error('PDF generation failed:', error);
            toast.error('Failed to generate PDF');
          });
        }
      } else if (event.data.type === 'CHANGE_MODE') {
        // Handle mode change from Angular client
        const newMode = event.data.mode as Mode;
        setMode(newMode);
        buildUi(newMode);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [mode, buildUi]);

  useEffect(() => {
    buildUi(mode);
    return () => {
      if (ui.current) {
        ui.current.destroy();
      }
      // Clear the global getTemplate function when component unmounts
      if ((window as any).getTemplate) {
        delete (window as any).getTemplate;
      }
    };
  }, [mode, uiRef, buildUi, searchParams]);

  return (
    <div ref={uiRef} className="flex-1 w-full" />
  );
}

export default FormAndViewerApp;
