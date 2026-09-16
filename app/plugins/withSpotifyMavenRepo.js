const { withProjectBuildGradle } = require('expo/config-plugins');

/**
 * Registra o repositorio Maven local com os AARs do Spotify no build.gradle raiz.
 *
 * Os AARs (app-remote, auth) sao baixados manualmente de
 * github.com/spotify/android-sdk/releases e nao existem em nenhum repositorio
 * publico. O modulo mellow-spotify ja declara esse repositorio no proprio
 * build.gradle, mas isso nao basta: no Gradle cada projeto so enxerga os
 * proprios repositorios, e quem resolve a dependencia transitiva na hora de
 * montar o releaseRuntimeClasspath e o :app. Sem esta entrada o build quebra com
 * "Could not find com.spotify.android:app-remote:0.8.0".
 *
 * E um plugin, e nao uma edicao direta em android/build.gradle, porque a pasta
 * android/ e gerada pelo prebuild e esta no .gitignore — editar la se perde na
 * proxima regeneracao.
 */

const MARKER = 'modules/mellow-spotify/android/libs-repo';
const REPO_LINE =
  '    maven { url uri("${rootDir}/../modules/mellow-spotify/android/libs-repo") }';

module.exports = function withSpotifyMavenRepo(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error(
        'withSpotifyMavenRepo: esperava build.gradle em Groovy, veio ' + cfg.modResults.language
      );
    }
    if (cfg.modResults.contents.includes(MARKER)) return cfg;

    const anchor = /allprojects\s*\{[\s\S]*?repositories\s*\{/;
    if (!anchor.test(cfg.modResults.contents)) {
      throw new Error('withSpotifyMavenRepo: nao achei allprojects { repositories { no build.gradle');
    }
    cfg.modResults.contents = cfg.modResults.contents.replace(
      anchor,
      (match) => match + '\n' + REPO_LINE
    );
    return cfg;
  });
};
