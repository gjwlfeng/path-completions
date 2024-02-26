import * as vscode from 'vscode';

export class MyLog {
  private static instance: MyLog;

  private outputChannel: vscode.LogOutputChannel;

  private static terminalName: string = "path-completion";

  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel(MyLog.terminalName, {
      log: true,
    });
  }

  public static getInstance(): MyLog {
    if (!MyLog.instance) {
      MyLog.instance = new MyLog();
    }
    return MyLog.instance;
  }

  public info(message: string, ...args: any[]) {

    if (args.length > 0) {
      this.outputChannel.info(message, args);
    } else {
      this.outputChannel.info(message);
    }
  }

  public error(message: string, ...args: any[]) {

    if (args.length > 0) {
      this.outputChannel.error(message, args);
    } else {
      this.outputChannel.error(message);
    }
  }
}