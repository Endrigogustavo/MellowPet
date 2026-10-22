import { NativeModule, requireOptionalNativeModule } from 'expo';

export type LlmStatus = { downloaded: boolean; bytes: number; loaded: boolean; downloading: boolean };

type Events = {
  onDownloadProgress: (e: { done: number; total: number }) => void;
  onToken: (e: { requestId: string; text: string }) => void;
  onDone: (e: { requestId: string; text: string }) => void;
  onError: (e: { requestId: string; message: string }) => void;
};

export declare class MellowLlmModule extends NativeModule<Events> {
  status(fileName: string): LlmStatus;
  download(url: string, sha256: string, fileName: string): Promise<string>;
  cancelDownload(): void;
  deleteModel(fileName: string): boolean;
  load(fileName: string, maxTokens: number): Promise<boolean>;
  generate(requestId: string, prompt: string): boolean;
  unload(): void;
}

const MellowLlm = requireOptionalNativeModule<MellowLlmModule>('MellowLlm');

export function isMellowLlmAvailable(): boolean {
  return MellowLlm != null;
}

export default MellowLlm;
