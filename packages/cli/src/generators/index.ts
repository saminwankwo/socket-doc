export interface SdkGenerator {
  generate(spec: any): string;
  getFileExtension(): string;
}
