"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
const fs = require("fs");
const os = require("os");
const path = require("path");
const vscode = require("vscode");
const CryptoJS = require("crypto-js");
const sharp = require("sharp");
function activate(context) {
    console.log('path completions is activated');
    const fileMd5Map = new Map();
    let timeout = undefined;
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
        const imageDecorationOptions = [];
        const fontSize = getCurrentEditorFontSize();
        const regEx1 = new RegExp('"((?:\\.|[^"])*)"', 'g');
        const regEx2 = new RegExp("'((?:\\.|[^'])*)'", 'g');
        const curWorkspaceFolder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
        if (curWorkspaceFolder == null) {
            return;
        }
        const text = activeEditor.document.getText();
        await matchImage(activeEditor, regEx1, text, curWorkspaceFolder, fontSize, imageDecorationOptions);
        await matchImage(activeEditor, regEx2, text, curWorkspaceFolder, fontSize, imageDecorationOptions);
        activeEditor.setDecorations(iamgeDecorationType, imageDecorationOptions);
    }
    async function matchImage(activeEditor, regEx, text, curWorkspaceFolder, fontSize, imageDecorationOptions) {
        let match;
        while ((match = regEx.exec(text))) {
            const startPos = activeEditor.document.positionAt(match.index);
            const endPos = activeEditor.document.positionAt(match.index + match[0].length);
            if (match[1].trim().length == 0) {
                continue;
            }
            let curFilePath = path.join(curWorkspaceFolder.uri.fsPath, match[1]);
            if (!fs.existsSync(curFilePath)) {
                curFilePath = match[1];
                if (!fs.existsSync(curFilePath)) {
                    continue;
                }
            }
            const itemRelativePath = path.relative(curWorkspaceFolder.uri.fsPath, curFilePath);
            const tempDir = os.tmpdir();
            const thumPath = path.join(tempDir, "thum", "path_completions", path.basename(curWorkspaceFolder.name), path.dirname(itemRelativePath), path.basename(itemRelativePath, path.extname(itemRelativePath)) + ".webp");
            const width = Math.floor(fontSize * 1.2);
            const height = Math.floor(fontSize * 1.2);
            const hoverMessage = new vscode.MarkdownString();
            hoverMessage.isTrusted = true;
            hoverMessage.supportThemeIcons = true;
            hoverMessage.supportHtml = true;
            hoverMessage.appendMarkdown(`[${match[1]}](${vscode.Uri.parse(curFilePath).toString()})`);
            hoverMessage.appendText("\n");
            hoverMessage.appendMarkdown(`![](${vscode.Uri.parse(curFilePath).toString()})`);
            hoverMessage.appendText("\n");
            const isExistThum = fs.existsSync(thumPath);
            const fileContent = fs.readFileSync(curFilePath);
            const wordArray = CryptoJS.lib.WordArray.create(fileContent);
            const fileMD5 = CryptoJS.MD5(wordArray).toString();
            const oldMd5 = fileMd5Map.get(curFilePath);
            if (fileMD5 !== oldMd5 || !isExistThum) {
                if (isExistThum) {
                    fs.unlinkSync(thumPath);
                }
                else {
                    fs.mkdirSync(path.dirname(thumPath), {
                        recursive: true,
                    });
                }
                let sharpMetadata;
                try {
                    sharpMetadata = await sharp(fs.readFileSync(curFilePath)).metadata();
                    if (sharpMetadata != null && sharpMetadata.width !== undefined && sharpMetadata.height !== undefined) {
                        hoverMessage.appendText(`width:${sharpMetadata.width},`);
                        hoverMessage.appendText("\n");
                        hoverMessage.appendText(`height:${sharpMetadata.height},`);
                        hoverMessage.appendText("\n");
                    }
                    // eslint-disable-next-line no-empty
                }
                catch (error) { }
                try {
                    await sharp(fs.readFileSync(curFilePath))
                        .resize(width, height, {
                        fit: sharp.fit.inside,
                    })
                        .webp()
                        .toFile(thumPath);
                    //保存新的md5
                    fileMd5Map.set(curFilePath, fileMD5);
                    // eslint-disable-next-line no-empty
                }
                catch (error) { }
            }
            if (fs.existsSync(thumPath)) {
                const thumPathStat = fs.statSync(thumPath);
                if (thumPathStat.isFile()) {
                    const themeColor = await getThemeColors(thumPath);
                    const invertedColor = getInvertdColor(themeColor);
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
                                    borderColor: `#${padZeroHex(invertedColor.red)}${padZeroHex(invertedColor.green)}${padZeroHex(invertedColor.blue)}`,
                                    backgroundColor: `#${padZeroHex(invertedColor.red)}${padZeroHex(invertedColor.green)}${padZeroHex(invertedColor.blue)}`,
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
                                    borderColor: `#${padZeroHex(invertedColor.red)}${padZeroHex(invertedColor.green)}${padZeroHex(invertedColor.blue)}`,
                                    backgroundColor: `#${padZeroHex(invertedColor.red)}${padZeroHex(invertedColor.green)}${padZeroHex(invertedColor.blue)}`,
                                    // borderColor: 'darkblue',
                                    // backgroundColor: 'darkblue',
                                }
                            }
                        }
                    };
                    imageDecorationOptions.push(decoration);
                }
                else {
                    const decoration = { hoverMessage: hoverMessage, range: new vscode.Range(startPos, endPos), };
                    imageDecorationOptions.push(decoration);
                }
            }
            else {
                const decoration = { hoverMessage: hoverMessage, range: new vscode.Range(startPos, endPos), };
                imageDecorationOptions.push(decoration);
            }
        }
    }
    function padZeroHex(num) {
        const hex = num.toString(16).toUpperCase(); // 转换为大写十六进制
        return hex.length === 1 ? '0' + hex : hex; // 如果长度为1，则补零
    }
    async function getThemeColors(imagePath) {
        // 加载图片
        const image = sharp(imagePath);
        // 获取原始像素缓冲区
        const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
        // 假设图片是RGB格式（如果不是，可能需要根据info.channels进行调整）
        const width = info.width;
        const height = info.height;
        const channels = info.channels; // 通常是3（RGB）
        let rTotal = 0, gTotal = 0, bTotal = 0;
        let pixelCount = 0;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // 计算索引
                const index = (y * width + x) * channels;
                // 提取RGB值
                const r = data[index];
                const g = data[index + 1];
                const b = data[index + 2];
                if (Math.abs(125 - r) > 20 && Math.abs(125 - g) > 20 && Math.abs(125 - b) > 20) {
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
    }
    function getInvertdColor(color) {
        return new vscode.Color((255 - color.red), (255 - color.green), (255 - color.blue), (color.alpha));
    }
    function getCurrentEditorFontSize() {
        const config = vscode.workspace.getConfiguration('editor');
        return config.get('fontSize') || 14;
    }
    function triggerUpdateDecorations(throttle = false) {
        if (timeout) {
            clearTimeout(timeout);
            timeout = undefined;
        }
        if (throttle) {
            timeout = setTimeout(updateDecorations, 1000);
        }
        else {
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
    const pathProvider = vscode.languages.registerCompletionItemProvider({ scheme: 'file', language: '*', }, {
        provideCompletionItems(document, position) {
            const linePrefix = document.lineAt(position).text.slice(0, position.character);
            const regExp1 = RegExp('"((?:\\.|[^"])*/)');
            const regExp2 = RegExp("'((?:\\.|[^'])*/)");
            const matchs1 = regExp1.exec(linePrefix) || [];
            const matchs2 = regExp2.exec(linePrefix) || [];
            if (matchs1.length == 0 && matchs2.length == 0) {
                return undefined;
            }
            const tipkeyWorkList = [];
            if (matchs1[1] != null) {
                buildKeyWorkListFromWorkSpace(tipkeyWorkList, matchs1[1]);
                buildKeyWorkListFromFile(tipkeyWorkList, matchs1[1]);
            }
            if (matchs2[1] != null) {
                buildKeyWorkListFromWorkSpace(tipkeyWorkList, matchs2[2]);
                buildKeyWorkListFromFile(tipkeyWorkList, matchs2[2]);
            }
            return tipkeyWorkList;
        }
    }, "/");
    context.subscriptions.push(pathProvider);
    function buildKeyWorkListFromWorkSpace(tipkeyWorkList, pathSuffix) {
        vscode.workspace.workspaceFolders?.forEach(folder => {
            const completionPath = path.join(folder.uri.fsPath, pathSuffix);
            buildKeyWorkListFromFile(tipkeyWorkList, completionPath);
        });
    }
    function buildKeyWorkListFromFile(tipkeyWorkList, completionPath) {
        if (fs.existsSync(completionPath)) {
            const childs = fs.readdirSync(completionPath);
            childs.forEach(element => {
                if (!element.startsWith(".")) {
                    const itemPath = path.join(completionPath, element);
                    if (fs.existsSync(itemPath)) {
                        const itemStat = fs.statSync(itemPath);
                        if (itemStat.isDirectory()) {
                            const completionItem = new vscode.CompletionItem(element, vscode.CompletionItemKind.Folder);
                            tipkeyWorkList.push(completionItem);
                        }
                        else {
                            const completionItem = new vscode.CompletionItem(element, vscode.CompletionItemKind.File);
                            tipkeyWorkList.push(completionItem);
                        }
                    }
                }
            });
        }
    }
}
exports.activate = activate;
//# sourceMappingURL=extension.js.map