/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import fs = require('fs');
import os = require('os');
import path = require('path');
import * as vscode from 'vscode';
//import { MyLog } from './my_log';


export function activate(context: vscode.ExtensionContext) {

	//MyLog.getInstance().info('path-completion is activated');

	let isShowHiddenFiles: boolean = getIsShowHiddenFiles();
	const changeConfigDisposable = vscode.workspace.onDidChangeConfiguration((event) => {
		isShowHiddenFiles = getIsShowHiddenFiles();
		//MyLog.getInstance().info(`onDidChangeConfiguration,isShowHiddenFiles=${isShowHiddenFiles}`);
	});

	const pathProvider = vscode.languages.registerCompletionItemProvider(
		{ scheme: 'file', language: '*' }, {
		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
			const linePrefix = document.lineAt(position).text.slice(0, position.character);

			const regExp2 = RegExp('\'((?:\\.|[^\']*)(?:\\.|/)$)');
			const regExp3 = RegExp("\"((?:\\.|[^\"]*)(?:\\.|/)$)");
			const matchs2 = regExp2.exec(linePrefix) || [];
			const matchs3 = regExp3.exec(linePrefix) || [];
			if (matchs2.length == 0 && matchs3.length == 0) {
				return undefined;
			}
			const tipkeyWorkList: vscode.CompletionItem[] = [];


			if (matchs2.length > 0) {
				const pathPrefix = matchs2[1];
				if (pathPrefix === ".") {
					buildKeyWorkListFromWorkSpaceFileSuffix(position, tipkeyWorkList, matchs2[1], "0");
					buildKeyWorkListFromFileSuffix(position, tipkeyWorkList, "/", "1");
				} else if (pathPrefix.trimEnd().endsWith(".")) {
					const curDirPath = pathPrefix.substring(0, pathPrefix.length);
					buildKeyWorkListFromWorkSpaceFileSuffix(position, tipkeyWorkList, curDirPath, "0");
					buildKeyWorkListFromFileSuffix(position, tipkeyWorkList, curDirPath, "1");
				} else {
					buildKeyWorkListFromWorkSpace(position, tipkeyWorkList, matchs2[1], "0");
					buildKeyWorkListFromFile(position, tipkeyWorkList, matchs2[1], "1");
				}
			} else if (matchs3.length > 0) {
				const pathPrefix = matchs3[1];
				if (pathPrefix.trim() === ".") {
					buildKeyWorkListFromWorkSpaceFileSuffix(position, tipkeyWorkList, matchs3[1], "0");
					buildKeyWorkListFromFileSuffix(position, tipkeyWorkList, "/", "1");
				} else if (pathPrefix.trimEnd().endsWith(".")) {
					const curDirPath = pathPrefix.substring(0, pathPrefix.length);
					buildKeyWorkListFromWorkSpaceFileSuffix(position, tipkeyWorkList, curDirPath, "0");
					buildKeyWorkListFromFileSuffix(position, tipkeyWorkList, curDirPath, "1");
				} else {
					buildKeyWorkListFromWorkSpace(position, tipkeyWorkList, matchs3[1], "0");
					buildKeyWorkListFromFile(position, tipkeyWorkList, matchs3[1], "1");
				}
			}
			//MyLog.getInstance().info(`tipkeyWorkList=${tipkeyWorkList.length}`);
			return tipkeyWorkList;
		}
	},
		"/", "."
	);

	context.subscriptions.push(changeConfigDisposable,pathProvider);

	function getIsShowHiddenFiles() {
		const isShowHiddenFiles = vscode.workspace.getConfiguration().get<boolean>("path-completion.is_show_hidden_files");
		if (isShowHiddenFiles === undefined) {
			return false;
		}
		return isShowHiddenFiles;
	}

	function buildKeyWorkListFromWorkSpace(position: vscode.Position, tipkeyWorkList: vscode.CompletionItem[], pathSuffix: string, sortText: string) {
		vscode.workspace.workspaceFolders?.forEach(folder => {
			const completionPath = path.join(folder.uri.fsPath, pathSuffix);
			buildKeyWorkListFromFile(position, tipkeyWorkList, completionPath, sortText);
		});
	}

	function buildKeyWorkListFromFile(position: vscode.Position, tipkeyWorkList: vscode.CompletionItem[], completionPath: string, sortText: string) {
		if (fs.existsSync(completionPath)) {
			const childs = fs.readdirSync(completionPath);
			for (const index in childs) {
				const element = childs[index];
				if ((!isShowHiddenFiles) && element.startsWith(".")) {
					continue;
				}
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
			}
		}
	}

	function buildKeyWorkListFromWorkSpaceFileSuffix(position: vscode.Position, tipkeyWorkList: vscode.CompletionItem[], pathSuffix: string, sortText: string) {
		vscode.workspace.workspaceFolders?.forEach(folder => {
			if (pathSuffix.trim() === ".") {
				buildKeyWorkListFromFileSuffix(position, tipkeyWorkList, folder.uri.fsPath + "/.", sortText);
			} else if (pathSuffix.endsWith("/.")) {
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
			for (const index in childs) {
				const element = childs[index];
				if ((!isShowHiddenFiles) && element.startsWith(".")) {
					continue;
				}
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
			}

		}
	}
}

export function deactivate() {
	//MyLog.getInstance().info('path-completion is now deactivate!');
}
