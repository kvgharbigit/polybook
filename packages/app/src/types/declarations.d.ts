// Type declarations for modules without official types

declare module 'react-native-static-server' {
  interface StaticServerOptions {
    localOnly?: boolean;
  }

  class StaticServer {
    constructor(port: number, directoryPath: string, options?: StaticServerOptions);
    start(): Promise<string>;
    stop(): void;
    origin: string;
  }

  export default StaticServer;
}

declare module 'react-native-crypto-js' {
  export interface WordArray {
    toString(encoder?: any): string;
  }

  export const enc: {
    Base64: {
      parse(str: string): WordArray;
    };
    Hex: any;
  };

  export function SHA256(data: WordArray): WordArray;
}