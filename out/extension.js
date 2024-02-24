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
    async function matchImage(activeEditor, regEx, text, curWorkspaceFolder, fontSize, imageDecorationOptions) {
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
            fs.mkdirSync(path.dirname(thumPath), {
                recursive: true,
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
                const decoration = {
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
            }
            else {
                const decoration = { range: new vscode.Range(startPos, endPos), };
                imageDecorationOptions.push(decoration);
            }
        }
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
            const regExp1 = RegExp("\"([^\"]*/)");
            const regExp2 = RegExp("'([^']*/)");
            const matchs1 = regExp1.exec(linePrefix) || [];
            const matchs2 = regExp2.exec(linePrefix) || [];
            if (matchs1.length == 0 && matchs2.length == 0) {
                return undefined;
            }
            const pathSuffix = matchs1.length != 0 ? matchs1[1] : matchs2[1];
            const tipkeyWorkList = [];
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
                                }
                                else {
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
    }, "/");
    context.subscriptions.push(pathProvider);
}
exports.activate = activate;
//# sourceMappingURL=extension.js.map