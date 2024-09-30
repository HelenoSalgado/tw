import { CodeMapping, forEachEmbeddedCode, LanguagePlugin, VirtualCode } from '@volar/language-core';
import type { TypeScriptExtraServiceScript } from '@volar/typescript';
import type * as ts from 'typescript';
import * as html from 'vscode-html-languageservice';
import { URI } from 'vscode-uri';

export const twLanguagePlugin: LanguagePlugin<URI> = {
	getLanguageId(uri) {
		if (uri.path.endsWith('.tw')) {
			return 'tw';
		}
	},
	createVirtualCode(_uri, languageId, snapshot) {
		if (languageId === 'tw') {
			return new TwVirtualCode(snapshot);
		}
	},
	typescript: {
		extraFileExtensions: [{ extension: 'tw', isMixedContent: true, scriptKind: 7 satisfies ts.ScriptKind.Deferred }],
		getServiceScript() {
			return undefined;
		},
		getExtraServiceScripts(fileName, root) {
			const scripts: TypeScriptExtraServiceScript[] = [];
			for (const code of forEachEmbeddedCode(root)) {
				if (code.languageId === 'javascript') {
					scripts.push({
						fileName: fileName + '.' + code.id + '.js',
						code,
						extension: '.js',
						scriptKind: 1 satisfies ts.ScriptKind.JS,
					});
				}
				else if (code.languageId === 'typescript') {
					scripts.push({
						fileName: fileName + '.' + code.id + '.ts',
						code,
						extension: '.ts',
						scriptKind: 3 satisfies ts.ScriptKind.TS,
					});
				}
			}
			return scripts;
		},
	},
};

const twLs = html.getLanguageService();

export class TwVirtualCode implements VirtualCode {
	id = 'root';
	languageId = 'html';
	mappings: CodeMapping[];
	embeddedCodes: VirtualCode[] = [];

	// Reuse in custom language service plugin
	htmlDocument: html.HTMLDocument;

	constructor(public snapshot: ts.IScriptSnapshot) {
		this.mappings = [{
			sourceOffsets: [0],
			generatedOffsets: [0],
			lengths: [snapshot.getLength()],
			data: {
				completion: true,
				format: true,
				navigation: true,
				semantic: true,
				structure: true,
				verification: true,
			},
		}];
		this.htmlDocument = twLs.parseHTMLDocument(html.TextDocument.create('', 'html', 0, snapshot.getText(0, snapshot.getLength())));
		this.embeddedCodes = [...getTwEmbeddedCodes(snapshot, this.htmlDocument)];
	}
}

function* getTwEmbeddedCodes(snapshot: ts.IScriptSnapshot, htmlDocument: html.HTMLDocument): Generator<VirtualCode> {
	const styles = htmlDocument.roots.filter(root => root.tag === 'style');
	const scripts = htmlDocument.roots.filter(root => root.tag === 'script');

	for (let i = 0; i < styles.length; i++) {
		const style = styles[i];
		if (style.startTagEnd !== undefined && style.endTagStart !== undefined) {
			const styleText = snapshot.getText(style.startTagEnd, style.endTagStart);
			yield {
				id: 'style_' + i,
				languageId: 'css',
				snapshot: {
					getText: (start, end) => styleText.substring(start, end),
					getLength: () => styleText.length,
					getChangeRange: () => undefined,
				},
				mappings: [{
					sourceOffsets: [style.startTagEnd],
					generatedOffsets: [0],
					lengths: [styleText.length],
					data: {
						completion: true,
						format: true,
						navigation: true,
						semantic: true,
						structure: true,
						verification: true,
					},
				}],
				embeddedCodes: [],
			};
		}
	}

	for (let i = 0; i < scripts.length; i++) {
		const script = scripts[i];
		console.log(script);
		if (script.startTagEnd !== undefined && script.endTagStart !== undefined) {
			const text = snapshot.getText(script.startTagEnd, script.endTagStart);
			console.log(script.attributes);
			// const lang = script.attributes?.lang;
			// const isTs = lang === 'ts' || lang === '"ts"' || lang === "'ts'";
			yield {
				id: 'script_' + i,
				//languageId: isTs ? 'typescript' : 'javascript',
				languageId: 'typescript',
				snapshot: {
					getText: (start, end) => text.substring(start, end),
					getLength: () => text.length,
					getChangeRange: () => undefined,
				},
				mappings: [{
					sourceOffsets: [script.startTagEnd],
					generatedOffsets: [0],
					lengths: [text.length],
					data: {
						completion: true,
						format: true,
						navigation: true,
						semantic: true,
						structure: true,
						verification: true
					},
				}],
				embeddedCodes: [],
			};
		}
	}
}