/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import fs = require('fs');
import os = require('os');
import path = require('path');
import * as vscode from 'vscode';
import CryptoJS = require('crypto-js');
import sharp = require('sharp');
import { MyLog } from './my_log';

const fileMd5Map: Map<string, string> = new Map();
let timeout: NodeJS.Timer | undefined = undefined;


export function activate(context: vscode.ExtensionContext) {

	MyLog.getInstance().info('path-completion is activated');

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

	async function updateDecorations() {

		const activeEditor = vscode.window.activeTextEditor;
		if (!activeEditor) {
			return;
		}

		const imageDecorationOptions: vscode.DecorationOptions[] = [];

		const fontSize = getCurrentEditorFontSize();

		const regEx1 = new RegExp('"((?:\\.|[^"])*)"', 'g');
		const regEx2 = new RegExp("'((?:\\.|[^'])*)'", 'g');

		//	const regEx = new RegExp("([\"'])(.+)\\1", 'g');

		const curWorkspaceFolder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
		if (curWorkspaceFolder != null) {
			const text = activeEditor.document.getText();
			await matchImage(activeEditor, regEx1, text, curWorkspaceFolder, fontSize, imageDecorationOptions);
			await matchImage(activeEditor, regEx2, text, curWorkspaceFolder, fontSize, imageDecorationOptions);
		}
		activeEditor.setDecorations(iamgeDecorationType, imageDecorationOptions);
	}

	async function matchImage(activeEditor: vscode.TextEditor, regEx: RegExp, text: string, curWorkspaceFolder: vscode.WorkspaceFolder, fontSize: number, imageDecorationOptions: vscode.DecorationOptions[]) {
		let match;

		while ((match = regEx.exec(text))) {
			const startPos = activeEditor.document.positionAt(match.index);
			const endPos = activeEditor.document.positionAt(match.index + match[0].length);

			if (match[1].length == 0) {
				continue;
			}

			const hoverMessage: vscode.MarkdownString = new vscode.MarkdownString();
			hoverMessage.isTrusted = true;
			hoverMessage.supportThemeIcons = true;
			hoverMessage.supportHtml = true;

			let curFilePath = path.join(curWorkspaceFolder.uri.fsPath, match[1]);
			if (fs.existsSync(curFilePath)) {

				hoverMessage.appendMarkdown(`[${match[1]}](${vscode.Uri.parse(curFilePath).toString()})`);
				hoverMessage.appendText("\n");
				if ((!fs.statSync(curFilePath).isFile())) {
					const decoration = { hoverMessage: hoverMessage, range: new vscode.Range(startPos, endPos), };
					imageDecorationOptions.push(decoration);
					continue;
				}
			} else {
				curFilePath = match[1];
				if (fs.existsSync(curFilePath)) {
					hoverMessage.appendMarkdown(`[${match[1]}](${vscode.Uri.parse(curFilePath).toString()})`);
					hoverMessage.appendText("\n");
					if ((!fs.statSync(curFilePath).isFile())) {
						const decoration = { hoverMessage: hoverMessage, range: new vscode.Range(startPos, endPos), };
						imageDecorationOptions.push(decoration);
						continue;
					}
				} else {
					continue;
				}
			}

			const itemRelativePath = path.relative(curWorkspaceFolder.uri.fsPath, curFilePath);
			const tempDir = os.tmpdir();
			const thumPath = path.join(tempDir, "thum", "path_completion", path.basename(curWorkspaceFolder.name), path.dirname(itemRelativePath), path.basename(itemRelativePath, path.extname(itemRelativePath)) + ".webp");

			const width = Math.floor(fontSize * 1.2);
			const height = Math.floor(fontSize * 1.2);

			const fileContent = fs.readFileSync(curFilePath);
			const wordArray = CryptoJS.lib.WordArray.create(fileContent);
			const fileMD5 = CryptoJS.MD5(wordArray).toString();

			const oldMd5 = fileMd5Map.get(curFilePath);

			if (fileMD5 !== oldMd5) {

				let sharpMetadata: sharp.Metadata | undefined;
				try {
					sharpMetadata = await sharp(fs.readFileSync(curFilePath)).metadata();

					if (sharpMetadata != null && sharpMetadata.width !== undefined && sharpMetadata.height !== undefined) {
						hoverMessage.appendText(`width:${sharpMetadata.width},`);
						hoverMessage.appendText("\n");
						hoverMessage.appendText(`height:${sharpMetadata.height},`);
						hoverMessage.appendText("\n");
					}

					const isExistThum = fs.existsSync(thumPath);
					if (isExistThum) {
						fs.unlinkSync(thumPath);
					} else {
						fs.mkdirSync(path.dirname(thumPath), {
							recursive: true,
						});
					}

					await sharp(fs.readFileSync(curFilePath))
						.resize(width, height, {
							fit: sharp.fit.inside,
						})
						.webp()
						.toFile(thumPath);

					//保存新的md5
					fileMd5Map.set(curFilePath, fileMD5);
					// eslint-disable-next-line no-empty
				} catch (error) {
					MyLog.getInstance().error(`metadata:${error}`);
				}
			}

			if (fs.existsSync(thumPath) && fs.statSync(thumPath).isFile()) {

				hoverMessage.appendMarkdown(`![](${vscode.Uri.parse(curFilePath).toString()})`);
				hoverMessage.appendText("\n");

				const themeColor = await getThemeColors(thumPath);
				let invertedColor;
				if (themeColor !== undefined) {
					invertedColor = getInvertdColor(themeColor);
				}

				const borderColor = themeColor ? `#${padZeroHex(themeColor.red)}${padZeroHex(themeColor.green)}${padZeroHex(themeColor.blue)}` : "darkblue";
				const backgroundColor = invertedColor ? `#${padZeroHex(invertedColor.red)}${padZeroHex(invertedColor.green)}${padZeroHex(invertedColor.blue)}` : "darkblue";

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
								borderColor: borderColor,
								backgroundColor: backgroundColor,
								// borderColor: 'darkblue',
								// backgroundColor: 'darkblue',
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
								borderColor: borderColor,
								backgroundColor: backgroundColor,
								// borderColor: 'darkblue',
								// backgroundColor: 'darkblue',
							}
						}
					}
				};
				imageDecorationOptions.push(decoration);

			} else {
				const decoration = { hoverMessage: hoverMessage, range: new vscode.Range(startPos, endPos), };
				imageDecorationOptions.push(decoration);
			}
		}
	}

	function padZeroHex(num: number) {
		const hex = num.toString(16).toUpperCase(); // 转换为大写十六进制
		return hex.length === 1 ? '0' + hex : hex; // 如果长度为1，则补零
	}

	async function getThemeColors(imagePath: string): Promise<vscode.Color | undefined> {
		// 加载图片
		try {
			const image = sharp(imagePath);

			// 获取原始像素缓冲区
			const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });


			// 假设图片是RGB格式（如果不是，可能需要根据info.channels进行调整）
			const width = info.width;
			const height = info.height;
			const channels = info.channels; // 通常是3（RGB）

			let rTotal: number = 0, gTotal: number = 0, bTotal: number = 0;
			let pixelCount: number = 0;

			for (let y = 0; y < height; y++) {
				for (let x = 0; x < width; x++) {

					// 计算索引
					const index = (y * width + x) * channels;
					// 提取RGB值
					const r = data[index];
					const g = data[index + 1];
					const b = data[index + 2];
					const a = data[index + 3];

					if ((Math.abs(125 - r) > 20 || Math.abs(125 - g) > 20 || Math.abs(125 - b) > 20)) {
						rTotal += r;
						gTotal += g;
						bTotal += b;
						pixelCount++;
					}
				}
			}
			const rAverage = rTotal / pixelCount;
			const gAverage = gTotal / pixelCount;
			const bAverage = bTotal / pixelCount;
			return new vscode.Color(Math.round(rAverage), Math.round(gAverage), Math.round(bAverage), 255);
		} catch (error) {
			MyLog.getInstance().error(`getThemeColors:${error}`);
			return undefined;
		}
	}

	function getInvertdColor(color: vscode.Color): vscode.Color {
		return new vscode.Color(
			(255 - color.red),
			(255 - color.green),
			(255 - color.blue),
			(color.alpha),
		);
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

	let activeEditor = vscode.window.activeTextEditor;
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

			const regExp3 = RegExp('(?:"|\')(.*(?:\\.|/)$)');
			const matchs3 = regExp3.exec(linePrefix) || [];
			if (matchs3.length == 0) {
				return undefined;
			}
			const tipkeyWorkList: vscode.CompletionItem[] = [];

			const pathPrefix = matchs3[1];

			if (matchs3[1].length > 0) {
				if (pathPrefix === ".") {
					buildKeyWorkListFromWorkSpace(position, tipkeyWorkList, matchs3[1], "0");
				} else if (pathPrefix.endsWith(".")) {
					const curDirPath = pathPrefix.substring(0, pathPrefix.length);
					buildKeyWorkListFromWorkSpaceFileSuffix(position, tipkeyWorkList, curDirPath, "0");
					buildKeyWorkListFromFileSuffix(position, tipkeyWorkList, curDirPath, "1");
				} else {
					buildKeyWorkListFromWorkSpace(position, tipkeyWorkList, matchs3[1], "0");
					buildKeyWorkListFromFile(position, tipkeyWorkList, matchs3[1], "1");
				}
			}
			MyLog.getInstance().info(`tipkeyWorkList=${tipkeyWorkList.length}`);
			return tipkeyWorkList;
		}
	},
		"/", "."
	);

	context.subscriptions.push(pathProvider);

	function buildKeyWorkListFromWorkSpace(position: vscode.Position, tipkeyWorkList: vscode.CompletionItem[], pathSuffix: string, sortText: string) {
		vscode.workspace.workspaceFolders?.forEach(folder => {
			const completionPath = path.join(folder.uri.fsPath, pathSuffix);
			buildKeyWorkListFromFile(position, tipkeyWorkList, completionPath, sortText);
		});
	}

	function buildKeyWorkListFromFile(position: vscode.Position, tipkeyWorkList: vscode.CompletionItem[], completionPath: string, sortText: string) {
		if (fs.existsSync(completionPath)) {
			const childs = fs.readdirSync(completionPath);
			childs.forEach(element => {
				const itemPath = path.join(completionPath, element);
				if (fs.existsSync(itemPath)) {
					const itemStat = fs.statSync(itemPath);
					let completionItem;
					if (itemStat.isDirectory()) {
						completionItem = new vscode.CompletionItem(element, vscode.CompletionItemKind.Folder);

					} else {
						completionItem = new vscode.CompletionItem(element, vscode.CompletionItemKind.File);
					}
					completionItem.sortText = sortText + element;
					completionItem.detail = itemPath;
					tipkeyWorkList.push(completionItem);
				}
			});
		}
	}

	function buildKeyWorkListFromWorkSpaceFileSuffix(position: vscode.Position, tipkeyWorkList: vscode.CompletionItem[], pathSuffix: string, sortText: string) {
		vscode.workspace.workspaceFolders?.forEach(folder => {

			if (pathSuffix.endsWith("/.")) {
				const completionPath = path.join(folder.uri.fsPath, pathSuffix);
				buildKeyWorkListFromFileSuffix(position, tipkeyWorkList, completionPath + "/.", sortText);
			} else {
				const completionPath = path.join(folder.uri.fsPath, pathSuffix);
				buildKeyWorkListFromFileSuffix(position, tipkeyWorkList, completionPath, sortText);
			}

		});
	}

	function buildKeyWorkListFromFileSuffix(position: vscode.Position, tipkeyWorkList: vscode.CompletionItem[], completionPath: string, sortText: string) {
		const curDir = path.dirname(completionPath);
		const fileName = path.basename(completionPath);

		if (fs.existsSync(curDir)) {
			const childs = fs.readdirSync(curDir);
			childs.forEach(element => {
				const itemPath = path.join(curDir, element);
				if (fs.existsSync(itemPath)) {

					const itemStat = fs.statSync(itemPath);
					let completionItem;
					if (itemStat.isDirectory()) {
						completionItem = new vscode.CompletionItem(element, vscode.CompletionItemKind.Folder);
					} else {
						completionItem = new vscode.CompletionItem(element, vscode.CompletionItemKind.File);
					}
					completionItem.sortText = sortText + element;
					completionItem.detail = element;
					completionItem.insertText = element;
					const range = new vscode.Range(new vscode.Position(position.line, position.character - fileName.length), position);
					completionItem.additionalTextEdits = [vscode.TextEdit.delete(range)];
					tipkeyWorkList.push(completionItem);

				}
			});
		}
	}
}

export function deactivate() {
	MyLog.getInstance().info('path-completion is now deactivate!');
	fileMd5Map.clear();
	if (timeout) {
		clearTimeout(timeout);
		timeout = undefined;
	}
}


