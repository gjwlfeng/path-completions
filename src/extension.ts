/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import fs = require('fs');
import os = require('os');
import path = require('path');
import * as vscode from 'vscode';
import CryptoJS = require('crypto-js');
import sharp = require('sharp');

export function activate(context: vscode.ExtensionContext) {

	console.log('path completions is activated');

	const fileMd5Map: Map<string, string> = new Map();

	let timeout: NodeJS.Timer | undefined = undefined;

	// create a decorator type that we use to decorate large numbers
	const iamgeDecorationType = vscode.window.createTextEditorDecorationType({
		// use a themable color. See package.json for the declaration and default values.
		//backgroundColor: { id: 'myextension.largeNumberBackground' },
		overviewRulerLane: vscode.OverviewRulerLane.Right,
		borderWidth: '1px',
		borderStyle: 'solid',
		overviewRulerColor: 'blue',
		light: {
			// this color will be used in light color themes
			borderColor: 'darkblue'
		},
		dark: {
			// this color will be used in dark color themes
			borderColor: 'lightblue'
		}
	});

	let activeEditor = vscode.window.activeTextEditor;

	async function updateDecorations() {
		if (!activeEditor) {
			return;
		}

		const imageDecorationOptions: vscode.DecorationOptions[] = [];

		const fontSize = getCurrentEditorFontSize();

		const regEx1 = new RegExp("\"(.*)\"", 'g');
		const regEx2 = new RegExp("'(.*)'", 'g');

		const curWorkspaceFolder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
		if (curWorkspaceFolder == null) {
			return;
		}
		const text = activeEditor.document.getText();
		await matchImage(activeEditor, regEx1, text, curWorkspaceFolder, fontSize, imageDecorationOptions);
		await matchImage(activeEditor, regEx2, text, curWorkspaceFolder, fontSize, imageDecorationOptions);
		activeEditor.setDecorations(iamgeDecorationType, imageDecorationOptions);
	}

	async function matchImage(activeEditor: vscode.TextEditor, regEx: RegExp, text: string, curWorkspaceFolder: vscode.WorkspaceFolder, fontSize: number, imageDecorationOptions: vscode.DecorationOptions[]) {
		let match;
		while ((match = regEx.exec(text))) {
			const startPos = activeEditor.document.positionAt(match.index);
			const endPos = activeEditor.document.positionAt(match.index + match[0].length);

			if (match[1].trim().length == 0) {
				continue;
			}

			const curFilePath = path.join(curWorkspaceFolder.uri.fsPath, match[1]);
			if (!fs.existsSync(curFilePath)) {
				continue;
			}

			const itemRelativePath = path.relative(curWorkspaceFolder.uri.fsPath, curFilePath);
			const tempDir = os.tmpdir();
			const thumPath = path.join(tempDir, "thum", "path_completions", path.basename(curWorkspaceFolder.name), path.dirname(itemRelativePath), path.basename(itemRelativePath, path.extname(itemRelativePath)) + ".webp");

			const width = Math.floor(fontSize * 1.2);
			const height = Math.floor(fontSize * 1.2);

			const hoverMessage: vscode.MarkdownString = new vscode.MarkdownString();
			hoverMessage.isTrusted = true;
			hoverMessage.supportThemeIcons = true;
			hoverMessage.supportHtml = true;

			fs.mkdirSync(path.dirname(thumPath), {
				recursive: true,
			});

			const sharpMetadata = await sharp(fs.readFileSync(curFilePath)).metadata().catch((error)=>{
				console.error(error);
			});

			await sharp(fs.readFileSync(curFilePath))
				.resize(width, height, {
					fit: sharp.fit.inside,
				})
				.webp()
				.toFile(thumPath).catch((error) => {
					console.error(error);
				});
			if (fs.existsSync(thumPath)) {
				hoverMessage.appendMarkdown(`[${match[1]}](${vscode.Uri.parse(curFilePath).toString()})`);
				hoverMessage.appendText("\n");
				if (sharpMetadata!=null && sharpMetadata.width !== undefined && sharpMetadata.height !== undefined) {
					hoverMessage.appendText(`width:${sharpMetadata.width},`);
					hoverMessage.appendText("\n");
					hoverMessage.appendText(`height:${sharpMetadata.height},`);
					hoverMessage.appendText("\n");
				}
				hoverMessage.appendMarkdown(`![](${vscode.Uri.parse(curFilePath).toString()})`);
				hoverMessage.appendText("\n");
				const decoration = {
					hoverMessage: hoverMessage,
					range: new vscode.Range(startPos, endPos), renderOptions: {
						light: {
							before: {
								contentIconPath: vscode.Uri.file(thumPath),
								//border: '2px solid green',
								margin: '0px 4px 0px 0px',
								borderWidth: '1px',
								borderStyle: 'solid',
								width: `${fontSize + 4}px`,
								height: `${fontSize + 4}px`,
								borderColor: 'darkblue',
								backgroundColor: 'darkblue',
							}
						},
						dark: {
							before: {
								contentIconPath: vscode.Uri.file(thumPath),
								//border: '2px solid green',
								margin: '0px 4px 0px 0px',
								borderWidth: '1px',
								borderStyle: 'solid',
								width: `${fontSize + 4}px`,
								height: `${fontSize + 4}px`,
								borderColor: 'darkblue',
								backgroundColor: 'darkblue',
							}
						}
					}
				};
				imageDecorationOptions.push(decoration);
			} else {
				hoverMessage.appendMarkdown("$(extensions-warning-message)file not found!");
				const decoration = { hoverMessage: hoverMessage, range: new vscode.Range(startPos, endPos), };
				imageDecorationOptions.push(decoration);
			}
		}
	}

	function getCurrentEditorFontSize(): number {
		const config = vscode.workspace.getConfiguration('editor');
		return config.get<number>('fontSize') || 14;
	}

	function triggerUpdateDecorations(throttle = false) {
		if (timeout) {
			clearTimeout(timeout);
			timeout = undefined;
		}
		if (throttle) {
			timeout = setTimeout(updateDecorations, 1000);
		} else {
			updateDecorations();
		}
	}

	if (activeEditor) {
		triggerUpdateDecorations();
	}

	vscode.window.onDidChangeActiveTextEditor(editor => {
		activeEditor = editor;
		if (editor) {
			triggerUpdateDecorations();
		}
	}, null, context.subscriptions);


	vscode.workspace.onDidChangeTextDocument(event => {
		if (activeEditor && event.document === activeEditor.document) {
			triggerUpdateDecorations(true);
		}
	}, null, context.subscriptions);


	const pathProvider = vscode.languages.registerCompletionItemProvider(
		{ scheme: 'file', language: '*', }, {
		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
			const linePrefix = document.lineAt(position).text.slice(0, position.character);
			const regExp1 = RegExp("\"([^\"]*/)");
			const regExp2 = RegExp("'([^']*/)");
			const matchs1 = regExp1.exec(linePrefix) || [];
			const matchs2 = regExp2.exec(linePrefix) || [];
			if (matchs1.length == 0 && matchs2.length == 0) {
				return undefined;
			}
			const pathSuffix = matchs1.length != 0 ? matchs1[1] : matchs2[1];
			const tipkeyWorkList: vscode.CompletionItem[] = [];
			vscode.workspace.workspaceFolders?.forEach(folder => {
				const completionPath = path.join(folder.uri.fsPath, pathSuffix);
				if (fs.existsSync(completionPath)) {
					const childs = fs.readdirSync(completionPath);
					childs.forEach(element => {

						if (!element.startsWith(".")) {
							const itemPath = path.join(folder.uri.fsPath, pathSuffix, element);
							if (fs.existsSync(itemPath)) {
								const itemStat = fs.statSync(itemPath);
								if (itemStat.isDirectory()) {
									const completionItem = new vscode.CompletionItem(element, vscode.CompletionItemKind.Folder);
									tipkeyWorkList.push(completionItem);
								} else {
									const completionItem = new vscode.CompletionItem(element, vscode.CompletionItemKind.File);
									tipkeyWorkList.push(completionItem);
								}
							}
						}
					});
				}
			});

			return tipkeyWorkList;
		}
	},
		"/"
	);

	context.subscriptions.push(pathProvider);
}


