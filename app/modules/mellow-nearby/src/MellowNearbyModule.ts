import { NativeModule, requireOptionalNativeModule } from 'expo';

type Events = {
  onEncounter: (event: { payload: string }) => void;
  onStatus: (event: { status: string }) => void;
};

export declare class MellowNearbyModule extends NativeModule<Events> {
  start(payloadJson: string): boolean;
  stop(): boolean;
  /** Liga só o encontro por NFC (não precisa de permissão de localização). */
  startNfc(payloadJson: string): boolean;
  /** "ok", "disabled" (NFC desligado) ou "none" (aparelho sem NFC/HCE). */
  nfcStatus(): 'ok' | 'disabled' | 'none';
  /** Modo leitor por até 30 s; true se trocou cartão com outro celular. */
  nfcTap(): Promise<boolean>;
}

// Opcional: iOS e Expo Go não têm o módulo, e o app segue sem encontros.
const MellowNearby = requireOptionalNativeModule<MellowNearbyModule>('MellowNearby');

export function isMellowNearbyAvailable(): boolean {
  return MellowNearby != null;
}

export default MellowNearby;
