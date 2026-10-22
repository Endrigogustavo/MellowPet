const { withGradleProperties } = require('expo/config-plugins');

/**
 * Empacota só as arquiteturas de celular real (ARM 32 e 64 bits).
 *
 * Por padrão o APK leva as bibliotecas nativas também para x86 e x86_64, que
 * só existem em emulador. Com MediaPipe de visão e de LLM, cada arquitetura a
 * mais pesava dezenas de MB — e celular modesto é justamente quem mais sente
 * download e armazenamento.
 *
 * Plugin, e não edição em android/gradle.properties, porque android/ é gerada
 * pelo prebuild e está no .gitignore.
 */
const ABIS = 'armeabi-v7a,arm64-v8a';

module.exports = function withLeanAbis(config) {
  return withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter(
      (item) => !(item.type === 'property' && item.key === 'reactNativeArchitectures')
    );
    cfg.modResults.push({ type: 'property', key: 'reactNativeArchitectures', value: ABIS });
    return cfg;
  });
};
