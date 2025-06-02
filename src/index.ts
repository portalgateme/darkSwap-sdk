export class DarkSwapSDK {
  private version: string;

  constructor() {
    this.version = "0.1.0";
  }

  public getVersion(): string {
    return this.version;
  }
}

export default DarkSwapSDK;
