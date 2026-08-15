import * as CodeMirror from 'codemirror';
import { parse } from 'acorn';
import type { Annotation } from 'codemirror/addon/lint/lint';

interface AcornSyntaxError extends SyntaxError {
    loc?: {
        line: number;
        column: number;
    };
}

/**
 * Validates the editor content as a function body and maps Acorn's position
 * from the generated wrapper back to the CodeMirror document.
 */
export function getJavaScriptSyntaxAnnotations(
    code: string,
    parameters: string[],
    isAsync: boolean
): Annotation[] {
    const asyncKeyword = isAsync ? 'async ' : '';
    const source = `${asyncKeyword}function __fuxa_script__(${parameters.join(', ')}) {\n${code}\n}`;

    try {
        parse(source, {
            ecmaVersion: 'latest',
            sourceType: 'script'
        });
        return [];
    } catch (error) {
        const syntaxError = error as AcornSyntaxError;
        const codeLines = code.split('\n');
        const parsedLine = syntaxError.loc?.line ?? 2;
        const line = Math.min(Math.max(parsedLine - 2, 0), codeLines.length - 1);
        const parsedColumn = syntaxError.loc?.column ?? 0;
        const column = parsedLine > codeLines.length + 1
            ? codeLines[line].length
            : Math.min(parsedColumn, codeLines[line].length);
        const fromColumn = Math.min(column, Math.max(codeLines[line].length - 1, 0));

        return [{
            from: CodeMirror.Pos(line, fromColumn),
            to: CodeMirror.Pos(line, Math.min(fromColumn + 1, codeLines[line].length)),
            message: syntaxError.message.replace(/ \(\d+:\d+\)$/, ''),
            severity: 'error'
        }];
    }
}
