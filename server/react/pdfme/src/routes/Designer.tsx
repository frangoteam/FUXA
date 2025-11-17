import { useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from 'react-toastify';
import { Template, checkTemplate } from "@pdfme/common";
import { Designer } from "@pdfme/ui";
import {
  getFontsData,
  getTemplateById,
  getBlankTemplate,
  readFile,
  handleLoadTemplate,
  generatePDF,
  downloadJsonFile,
  translations,
  getReportById,
} from "../helper";
import { getPlugins } from '../plugins';

function DesignerApp() {
  const [searchParams, setSearchParams] = useSearchParams();
  const designerRef = useRef<HTMLDivElement | null>(null);
  const designer = useRef<Designer | null>(null);

  const buildDesigner = useCallback(async (providedTemplate?: Template) => {
    if (!designerRef.current) return;
    
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

      designer.current = new Designer({
        domContainer: designerRef.current,
        template,
        options: {
          font: getFontsData(),
          lang: 'en',
          labels: {
            'signature.clear': "🗑️",
          },
          theme: {
            token: { colorPrimary: "#25c2a0" },
          },
          icons: {
            multiVariableText:
              '<svg fill="#000000" width="24px" height="24px" viewBox="0 0 24 24"><path d="M6.643,13.072,17.414,2.3a1.027,1.027,0,0,1,1.452,0L20.7,4.134a1.027,1.027,0,0,1,0,1.452L9.928,16.357,5,18ZM21,20H3a1,1,0,0,0,0,2H21a1,1,0,0,0,0-2Z"/></svg>',
          },
          maxZoom: 250,
        },
        plugins: getPlugins(),
      });
      designer.current.onSaveTemplate(onSaveTemplate);

      (window as any).getTemplate = () => {
        try {
          return designer.current?.getTemplate();
        } catch (error) {
          console.warn('Designer instance is destroyed, cannot get template:', error);
          return null;
        }
      };
      (window as any).updateSettings = (settings: any) => {
        try {
          if (designer.current) {
            // Update designer options
            if (settings.language) {
            }
            // Update template properties
            const template = designer.current.getTemplate();
            if (settings.basePdf !== undefined) {
              // Handle basePdf: if it's empty string, use blank PDF object
              if (settings.basePdf === '' || (typeof settings.basePdf === 'string' && settings.basePdf.trim() === '')) {
                template.basePdf = { width: 210, height: 297, padding: [10, 10, 10, 10] };
              } else {
                template.basePdf = settings.basePdf;
              }
            }
            if (settings.pageSize) {
              // pdfme uses basePdf for page size, but we can store it in our settings
            }
            designer.current.updateTemplate(template);
          }
        } catch (error) {
          console.warn('Designer instance is destroyed, cannot update settings:', error);
        }
      };

    } catch (error) {
      localStorage.removeItem("template");
      console.error(error);
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'LOAD_TEMPLATE') {
        const { template } = event.data;
        if (template) {
          checkTemplate(template);
          buildDesigner(template);
          // Send confirmation that template is loaded
          window.parent.postMessage({
            type: 'TEMPLATE_LOADED',
            success: true
          }, '*');
        }
      } else if (event.data.type === 'UPDATE_TEMPLATE_BASEPDF') {
        const { basePdf } = event.data;
        if (designer.current) {
          const newTemplate = JSON.parse(JSON.stringify(designer.current.getTemplate()));
          if (basePdf === '' || basePdf === null || basePdf === undefined) {
            // Clear the basePdf - use default blank PDF
            newTemplate.basePdf = { width: 210, height: 297, padding: [10, 10, 10, 10] };
          } else {
            newTemplate.basePdf = basePdf;
          }
          designer.current.updateTemplate(newTemplate);
        }
      } else if (event.data.type === 'GET_TEMPLATE') {
        // Handle request for current template
        if (designer.current) {
          const template = designer.current.getTemplate();
          window.parent.postMessage({
            type: 'TEMPLATE_DATA',
            template: template
          }, '*');
        } else {
          window.parent.postMessage({
            type: 'TEMPLATE_DATA',
            template: null
          }, '*');
        }
      } else if (event.data.type === 'GENERATE_PDF') {
        // Handle PDF generation from Angular client
        if (designer.current) {
          generatePDF(designer.current).then(() => {
            toast.info('PDF generated successfully');
          }).catch((error) => {
            console.error('PDF generation failed:', error);
            toast.error('Failed to generate PDF');
          });
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const onSaveTemplate = (template?: Template) => {
    if (designer.current) {
      localStorage.setItem(
        "template",
        JSON.stringify(template || designer.current.getTemplate())
      );
      toast.success("Saved on local storage");
    }
  };

  useEffect(() => {
    if (designerRef.current) {
      buildDesigner();
    }
    return () => {
      designer.current?.destroy();
      // Clear the global functions when component unmounts
      if ((window as any).getTemplate) {
        delete (window as any).getTemplate;
      }
      if ((window as any).updateSettings) {
        delete (window as any).updateSettings;
      }
    };
  }, [designerRef, buildDesigner, searchParams]);

  return (
    <div ref={designerRef} className="flex-1 w-full" />
  );
}

export default DesignerApp;
