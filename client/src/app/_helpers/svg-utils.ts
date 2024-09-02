import { Injectable } from '@angular/core';

@Injectable()
export class SvgUtils {

    static isSVG(filePath: string): boolean {
        const extension = filePath.split('.').pop()?.toLowerCase();
        return extension === 'svg';
    }

    static getSvgSize(svgElement: SVGSVGElement): { width: number, height: number } {
        const width = svgElement.getAttribute('width');
        const height = svgElement.getAttribute('height');

        if (width && height) {
            return { width: parseInt(width), height: parseInt(height) };
        } else {
            const viewBox = svgElement.getAttribute('viewBox');
            if (viewBox) {
                const viewBoxValues = viewBox.split(' ').map(Number);
                const viewBoxWidth = viewBoxValues[2];
                const viewBoxHeight = viewBoxValues[3];
                return { width: viewBoxWidth, height: viewBoxHeight };
            }
        }
    }

    static processWidget(scriptContent: string, uniqueId: string, idMap: { [oldId: string]: string }): { content: string, vars: WidgetPropertyVariable[] } {

        let modifiedContent = SvgUtils.renameGlobalVariables(scriptContent, uniqueId);
        let modifiedScriptContent = SvgUtils.renameFunctionNames(modifiedContent.content, uniqueId);
        modifiedScriptContent = SvgUtils.replaceIdsInScript(modifiedScriptContent, idMap);

        return { content: modifiedScriptContent, vars: modifiedContent.vars };
    }

    static renameGlobalVariables(scriptContent: string, uniqueId: string): { content: string, vars: WidgetPropertyVariable[] } {
        // marker `//!g-start` e `//!g-end` for global variable
        const globalSectionRegex = /\/\/!g-start([\s\S]*?)\/\/!g-end/g;
        const match = globalSectionRegex.exec(scriptContent);
        const renamedVariables: { [key: string]: string } = {};
        if (match) {
            let globalSection = match[1];

            const globalVarRegex = /(?:var|let|const)\s+(\w+)/g;
            let varMatch;

            while ((varMatch = globalVarRegex.exec(globalSection)) !== null) {
                const varName = varMatch[1];
                const newVarName = `${varName}_${uniqueId}`;
                renamedVariables[varName] = newVarName;

                const varNameRegex = new RegExp(`\\b${varName}\\b`, 'g');
                globalSection = globalSection.replace(varNameRegex, newVarName);
            }
            scriptContent = scriptContent.replace(match[0], `//!g-start${globalSection}//!g-end`);
        }
        let vars: WidgetPropertyVariable[] = [];
        Object.entries(renamedVariables).forEach(([originalVar, newVar]) => {
            const varNameRegex = new RegExp(`\\b${originalVar}\\b`, 'g');
            scriptContent = scriptContent.replace(varNameRegex, newVar);
            const widgetVar = SvgUtils.toWidgetPropertyVariable(originalVar, newVar);
            if (widgetVar) {
                vars.push(widgetVar);
            }
        });
        return { content: scriptContent, vars: vars };
    }

    static renameFunctionNames(scriptContent: string, uniqueId: string): string {
        // Regex per identificare le dichiarazioni di funzione
        const functionDeclRegex = /function\s+(\w+)\s*\(/g;
        // Regex per identificare le espressioni di funzione (arrow functions e function expressions)
        const functionExprRegex = /(\w+)\s*=\s*(?:function|=>)\s*\(/g;

        // Oggetto per tenere traccia delle funzioni rinominate
        const renamedFunctions: { [key: string]: string } = {};
        let match;

        // Trova e rinomina tutte le dichiarazioni di funzione
        while ((match = functionDeclRegex.exec(scriptContent)) !== null) {
            const oldName = match[1];
            const newName = `${oldName}_${uniqueId}`;
            renamedFunctions[oldName] = newName;
            scriptContent = scriptContent.replace(new RegExp(`\\b${oldName}\\b(?=\\s*\\()`, 'g'), newName);
        }

        // Trova e rinomina tutte le espressioni di funzione
        while ((match = functionExprRegex.exec(scriptContent)) !== null) {
            const oldName = match[1];
            const newName = `${oldName}_${uniqueId}`;
            renamedFunctions[oldName] = newName;
            scriptContent = scriptContent.replace(new RegExp(`\\b${oldName}\\b`, 'g'), newName);
        }

        // Sostituisce tutte le chiamate alle funzioni rinominate
        Object.entries(renamedFunctions).forEach(([oldName, newName]) => {
            const callRegex = new RegExp(`\\b${oldName}\\b`, 'g');
            scriptContent = scriptContent.replace(callRegex, newName);
        });

        return scriptContent;
    }

    static renameIdsInSvg(svgElement: SVGSVGElement, uniqueId: string): { [oldId: string]: string } {
        const idMap: { [oldId: string]: string } = {};
        function traverseElement(element: HTMLElement | SVGSVGElement) {
            if (element.id) {
                const oldId = element.id;
                const newId = `${oldId}_${uniqueId}`;
                element.id = newId;
                idMap[oldId] = newId;
            }
            Array.from(element.children).forEach(child => traverseElement(child as HTMLElement));
        }
        traverseElement(svgElement);

        return idMap;
    }

    static replaceIdsInScript(scriptContent: string, idMap: { [oldId: string]: string }): string {
        let updatedScriptContent = scriptContent;
        Object.entries(idMap).forEach(([oldId, newId]) => {
            const idRegex = new RegExp(`(['"\"])${oldId}\\1`, 'g');
            updatedScriptContent = updatedScriptContent.replace(idRegex, `$1${newId}$1`);
        });

        return updatedScriptContent;
    }

    static toWidgetPropertyVariable(originalVar: string, varName: string): WidgetPropertyVariable {
        const prefix = Object.entries(WidgetPropertyVariableTypePrefix).find(([_, value]) => varName.startsWith(value));
        if (prefix) {
            return {
                originalName: originalVar,
                name: varName,
                type: prefix[0] as keyof typeof WidgetPropertyVariableTypePrefix
            };
        }
        return null;
    }
}

export interface WidgetPropertyVariable {
    originalName: string;
    name: string;
    type: string;
    variableId?: string;
    description?: string;
    variableValue?: string;
}

export enum WidgetPropertyVariableTypePrefix {
    bool = '_pb_',
    number = '_pn_',
    string = '_ps_',
    color = '_pc_',
}
