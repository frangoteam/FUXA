import { Injectable } from '@angular/core';
import { Utils } from './utils';

@Injectable()
export class SvgUtils {

    static exportStart = '//!export-start';
    static exportEnd = '//!export-end';

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

    static processWidget(scriptContent: string,
                         moduleId: string,
                         idMap: { [oldId: string]: string },
                         variableDefined?: WidgetPropertyVariable[]): { content: string, vars: WidgetPropertyVariable[] } {
        let cleanContent = SvgUtils.removeComments(scriptContent);
        let modifiedContent = SvgUtils.exportGlobalVariables(cleanContent, moduleId, variableDefined);
        let modifiedScriptContent = SvgUtils.exportFunctionNames(modifiedContent.content, moduleId);
        modifiedScriptContent = SvgUtils.replaceIdsInScript(modifiedScriptContent, idMap);
        modifiedScriptContent = SvgUtils.addModuleDeclaration(modifiedScriptContent, moduleId);

        return { content: modifiedScriptContent, vars: modifiedContent.vars };
    }

    static removeComments(scriptContent: string): string {
        // Remove multi-linea comment (/* ... */)
        return scriptContent.replace(/\/\*[\s\S]*?\*\//g, '');
    }

    static exportGlobalVariables(scriptContent: string,
                                 moduleId: string,
                                 variableDefined?: WidgetPropertyVariable[]): { content: string, vars: WidgetPropertyVariable[]} {
        const globalSectionRegex = new RegExp(`${SvgUtils.exportStart}([\\s\\S]*?)${SvgUtils.exportEnd}`, 'g');
        const match = globalSectionRegex.exec(scriptContent);
        const renamedVariables: { [key: string]: string } = {};
        if (match) {
            let globalSection = match[1];

            const globalVarRegex = /(?:var|let|const)\s+(\w+)/g;
            let varMatch;

            while ((varMatch = globalVarRegex.exec(globalSection)) !== null) {
                const varName = varMatch[1];
                const varExist = variableDefined?.find(varDef => varDef.originalName === varName);
                const newVarName = varExist ? varExist.name : varName;
                renamedVariables[varName] = newVarName;

                const varNameRegex = new RegExp(`\\b${varName}\\b`, 'g');
                globalSection = globalSection.replace(varNameRegex, newVarName);
                globalSection += `\n${moduleId}.${newVarName} = ${newVarName};`;
            }
            scriptContent = scriptContent.replace(match[0], `${SvgUtils.exportStart}${globalSection}${SvgUtils.exportEnd}`);
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

    static exportFunctionNames(scriptContent: string, moduleId: string): string {
        // Regex to identify functions declaration
        const functionDeclRegex = /function\s+(\w+)\s*\(/g;
        // Regex to identify functions (arrow functions and function expressions)
        const functionExprRegex = /(\w+)\s*=\s*(?:function|=>)\s*\(/g;
        let match;
        while ((match = functionDeclRegex.exec(scriptContent)) !== null) {
            scriptContent += `\n${moduleId}.${match[1]} = ${match[1]};`;
        }
        while ((match = functionExprRegex.exec(scriptContent)) !== null) {
            scriptContent += `\n${moduleId}.${match[1]} = ${match[1]};`;
        }

        // Regex to search calls of postValue function
        const oldFuncName = 'postValue';
        const newFuncName = `${moduleId}.${oldFuncName}`;
        const functionCallRegex = new RegExp(`(?<!function\\s+)\\b${oldFuncName}\\b(?=\\s*\\()`, 'g');
        // const functionCallRegex = new RegExp(`\\b${oldFuncName}\\s*\\(`, 'g');
        scriptContent = scriptContent.replace(functionCallRegex, `${newFuncName}`);
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

    static addModuleDeclaration(scriptContent: string, moduleId: string): string {
        return `var ${moduleId} = window.${moduleId} || {};\n(function() {${scriptContent}\n})();\nwindow.${moduleId}=${moduleId}`;
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

    static initWidget(scriptContent: string, variableDefined: WidgetPropertyVariable[]): string {
        if (!variableDefined) {
            return scriptContent;
        }
        // search global variable section //!export-start and //!export-end
        const regexSection = new RegExp(`${SvgUtils.exportStart}([\\s\\S]*?)${SvgUtils.exportEnd}`, 'g');
        const match = regexSection.exec(scriptContent);

        if (!match) {
            return scriptContent;
        }

        let gSection = match[1];

        // replace global variable with init value
        variableDefined.forEach(variable => {
            if (!Utils.isNullOrUndefined(variable.variableValue) && SvgUtils.validateVariable(variable)) {
                const varRegex = new RegExp(`(let|var|const)\\s+${variable.name}\\s*=\\s*[^;]+;`);
                if (variable.type === 'string' || variable.type === 'color') {
                    gSection = gSection.replace(varRegex, `$1 ${variable.name} = \`${variable.variableValue}\`;`);
                } else if (variable.type === 'boolean') {
                    gSection = gSection.replace(varRegex, `$1 ${variable.name} = ${!!variable.variableValue};`);
                } else {
                    gSection = gSection.replace(varRegex, `$1 ${variable.name} = ${variable.variableValue};`);
                }
            }
        });
        // replace global variable section
        return scriptContent.replace(match[1], gSection);
    }

    static resizeSvgNodes(svgElement: SVGSVGElement, boxSize: { width: number, height: number }) {
        if (boxSize && svgElement) {
            for (let i = 0; i < svgElement.children?.length; i++) {
                svgElement.children[i].setAttribute('height', boxSize.height.toString());
                svgElement.children[i].setAttribute('width', boxSize.width.toString());
            }
        }
    }

    static validateVariable(variable: WidgetPropertyVariable): boolean {
        if (variable.type === 'number' && !Utils.isNumeric(variable.variableValue)) {
            return false;
        } else if (variable.type === 'string' && !variable.variableValue) {
            return false;
        } else if (variable.type === 'color' && !variable.variableValue) {
            return false;
        }
        return true;
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
    boolean = '_pb_',
    number = '_pn_',
    string = '_ps_',
    color = '_pc_',
}
