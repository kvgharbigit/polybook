declare module 'jszip' {
  export default class JSZip {
    constructor();
    loadAsync(data: any): Promise<JSZip>;
    file(path: string): JSZipObject | null;
    folder(name: string): JSZip | null;
    forEach(callback: (relativePath: string, file: JSZipObject) => void): void;
  }

  export interface JSZipObject {
    name: string;
    dir: boolean;
    async(type: 'string' | 'arraybuffer' | 'uint8array' | 'blob'): Promise<any>;
  }
}