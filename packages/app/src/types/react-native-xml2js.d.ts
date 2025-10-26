declare module 'fast-xml-parser' {
  export class XMLParser {
    constructor(options?: any);
    parse(xmlData: string): any;
  }
  
  export class XMLValidator {
    static validate(xmlData: string): boolean | object;
  }
}