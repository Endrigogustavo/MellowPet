import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';

import MellowLlm, { isMellowLlmAvailable } from '../../modules/mellow-llm';

/**
 * O "Mellow offline": um modelo de linguagem pequeno rodando no celular.
 *
 * Os dois modelos são Qwen 2.5 Instruct (Apache 2.0, multilíngue, falam
 * português) convertidos para o MediaPipe pela comunidade LiteRT. O Gemma da
 * Google seria a escolha natural, mas o download dele exige aceitar a licença
 * com login no Hugging Face — inviável de dentro do app.
 *
 * O SHA-256 vem do próprio Hugging Face (X-Linked-ETag do arquivo LFS); o
 * download só é aceito se bater, para um arquivo corrompido ou trocado nunca
 * ser carregado.
 */
export type LocalModel = {
  id: 'leve' | 'melhor';
  label: string;
  description: string;
  fileName: string;
  url: string;
  sha256: string;
  bytes: number;
  /** RAM total mínima, em GB, para rodar sem travar o celular. */
  minRamGb: number;
};

const HF = 'https://huggingface.co/litert-community';

export const LOCAL_MODELS: LocalModel[] = [
  {
    id: 'leve',
    label: 'Leve',
    description: 'Qwen 2.5 · 0,5 bilhão de parâmetros. Rápido em qualquer celular; respostas mais simples.',
    fileName: 'Qwen2.5-0.5B-Instruct_multi-prefill-seq_q8_ekv1280.task',
    url: `${HF}/Qwen2.5-0.5B-Instruct/resolve/main/Qwen2.5-0.5B-Instruct_multi-prefill-seq_q8_ekv1280.task`,
    sha256: 'e608953f169aeb1bd7b9155fec2559825e08453fc209b84eda3a781ed0452fd2',
    bytes: 546_660_344,
    minRamGb: 3,
  },
  {
    id: 'melhor',
    label: 'Melhor',
    description: 'Qwen 2.5 · 1,5 bilhão de parâmetros. Conversa bem melhor; pede celular com 6 GB de RAM ou mais.',
    fileName: 'Qwen2.5-1.5B-Instruct_multi-prefill-seq_q8_ekv1280.task',
    url: `${HF}/Qwen2.5-1.5B-Instruct/resolve/main/Qwen2.5-1.5B-Instruct_multi-prefill-seq_q8_ekv1280.task`,
    sha256: '8d867a7c93a6acf2892f08e0174e2f6f351ad256b7e3cfb6d6cd9c89794b42e0',
    bytes: 1_597_913_616,
    minRamGb: 6,
  },
];

/** Limite do contexto do modelo (o "ekv1280" do nome do arquivo). */
const MAX_TOKENS = 1280;

const CHOICE_KEY = 'mellowpet.llm.model.v1';
const PRIVATE_KEY = 'mellowpet.llm.private.v1';

export { isMellowLlmAvailable };

export async function loadLocalChoice(): Promise<{ modelId: LocalModel['id'] | null; privateMode: boolean }> {
  const [m, p] = await Promise.all([
    SecureStore.getItemAsync(CHOICE_KEY),
    SecureStore.getItemAsync(PRIVATE_KEY),
  ]);
  return {
    modelId: m === 'leve' || m === 'melhor' ? m : null,
    privateMode: p === 'on',
  };
}

export async function saveLocalChoice(modelId: LocalModel['id'] | null, privateMode: boolean) {
  if (modelId) await SecureStore.setItemAsync(CHOICE_KEY, modelId);
  else await SecureStore.deleteItemAsync(CHOICE_KEY);
  await SecureStore.setItemAsync(PRIVATE_KEY, privateMode ? 'on' : 'off');
}

export function modelById(id: LocalModel['id'] | null): LocalModel | null {
  return LOCAL_MODELS.find((m) => m.id === id) ?? null;
}

export function isDownloaded(model: LocalModel): boolean {
  if (!MellowLlm) return false;
  try {
    return MellowLlm.status(model.fileName).downloaded;
  } catch {
    return false;
  }
}

export async function downloadModel(
  model: LocalModel,
  onProgress: (fraction: number) => void
): Promise<void> {
  if (!MellowLlm) throw new Error('O modelo no aparelho não está disponível neste build.');
  const sub = MellowLlm.addListener('onDownloadProgress', ({ done, total }) => {
    onProgress(Math.min(1, done / (total > 0 ? total : model.bytes)));
  });
  try {
    await MellowLlm.download(model.url, model.sha256, model.fileName);
  } finally {
    sub.remove();
  }
}

export function cancelDownload() {
  MellowLlm?.cancelDownload();
}

export function deleteModel(model: LocalModel) {
  MellowLlm?.deleteModel(model.fileName);
}

/** Pronto para responder agora (baixado). O carregamento na memória é preguiçoso. */
export function localReady(modelId: LocalModel['id'] | null): boolean {
  const model = modelById(modelId);
  return model != null && isDownloaded(model);
}

let counter = 0;

/**
 * Gera a resposta no aparelho. `onPartial` recebe o texto acumulado a cada
 * pedaço — é o que faz as palavras aparecerem enquanto o modelo escreve.
 */
export async function generateLocal(
  modelId: LocalModel['id'],
  prompt: string,
  onPartial: (text: string) => void
): Promise<string> {
  const llm = MellowLlm;
  const model = modelById(modelId);
  if (!llm || !model) throw new Error('Modelo local indisponível.');
  await llm.load(model.fileName, MAX_TOKENS);

  const requestId = `r${Date.now()}_${counter++}`;
  return new Promise<string>((resolve, reject) => {
    const subs = [
      llm.addListener('onToken', (e) => {
        if (e.requestId === requestId) onPartial(e.text);
      }),
      llm.addListener('onDone', (e) => {
        if (e.requestId !== requestId) return;
        subs.forEach((s) => s.remove());
        resolve(e.text);
      }),
      llm.addListener('onError', (e) => {
        if (e.requestId !== requestId) return;
        subs.forEach((s) => s.remove());
        reject(new Error(e.message));
      }),
    ];
    if (!llm.generate(requestId, prompt)) {
      subs.forEach((s) => s.remove());
      reject(new Error('Não foi possível iniciar a geração.'));
    }
  });
}

/** RAM total do aparelho em GB (null se o sistema não informar). */
export function deviceRamGb(): number | null {
  return Device.totalMemory ? Device.totalMemory / 1024 ** 3 : null;
}

/**
 * O aparelho aguenta este modelo? Modelos carregam inteiros na memória: abaixo
 * do mínimo, a geração trava o celular ou o sistema fecha o app. Quando a RAM
 * é desconhecida, deixa a pessoa decidir.
 */
export function fitsDevice(model: LocalModel): boolean {
  const ram = deviceRamGb();
  return ram == null || ram + 0.25 >= model.minRamGb;
}

/** Espaço ocupado pelo modelo baixado, em bytes (0 se não baixado). */
export function installedBytes(model: LocalModel): number {
  if (!MellowLlm) return 0;
  try {
    const s = MellowLlm.status(model.fileName);
    return s.downloaded ? s.bytes : 0;
  } catch {
    return 0;
  }
}
