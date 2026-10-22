plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
  id("org.jetbrains.kotlin.plugin.compose")
}

android {
  namespace = "com.mellowpet.wear"
  compileSdk = 36

  defaultConfig {
    applicationId = "com.mellowpet.app"
    // Galaxy Watch 4 saiu com Wear OS 3 = API 30. Abaixo disso nao existe
    // Wear OS moderno, e o Health Services precisa de 30+.
    minSdk = 30
    targetSdk = 34
    versionCode = 1
    versionName = "1.0"
  }

  signingConfigs {
    // Tem de ser a MESMA chave do app do celular: o Data Layer so entrega
    // mensagens entre apps com o mesmo applicationId E a mesma assinatura. Com
    // chaves diferentes o relogio e o celular simplesmente nao se enxergam, e
    // sem nenhum erro visivel — as mensagens somem.
    //
    // Esta e copia de app/android/app/debug.keystore, a chave de debug publica
    // do template React Native (CN=Android Debug, valida ate 2052), identica em
    // todo projeto RN — nao e segredo. Ela esta versionada aqui porque
    // app/android/ e gerada pelo prebuild e esta no .gitignore.
    //
    // Ao migrar para uma chave de release de verdade, OS DOIS apps precisam
    // passar a usar a mesma, ou o relogio para de falar com o celular.
    getByName("debug") {
      storeFile = file("debug.keystore")
      storePassword = "android"
      keyAlias = "androiddebugkey"
      keyPassword = "android"
    }
  }

  buildTypes {
    release {
      isMinifyEnabled = false
      signingConfig = signingConfigs.getByName("debug")
    }
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
  kotlinOptions { jvmTarget = "17" }
  buildFeatures { compose = true }
}

dependencies {
  implementation("androidx.core:core-ktx:1.13.1")
  implementation("androidx.activity:activity-compose:1.9.3")
  // play-services-wearable arrasta fragment 1.1.0, e o registerForActivityResult
  // quebra com fragment < 1.3. Sobe explicitamente; o app nao usa Fragment, mas
  // a versao antiga no classpath basta para estourar.
  implementation("androidx.fragment:fragment:1.8.5")
  implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")

  implementation(platform("androidx.compose:compose-bom:2024.12.01"))
  implementation("androidx.compose.ui:ui")
  implementation("androidx.compose.ui:ui-graphics")
  implementation("androidx.compose.ui:ui-tooling-preview")

  // Compose for Wear OS: componentes com as formas e o comportamento do relogio.
  implementation("androidx.wear.compose:compose-material:1.4.0")
  implementation("androidx.wear.compose:compose-foundation:1.4.0")
  implementation("androidx.wear.compose:compose-navigation:1.4.0")

  // Data Layer: a ponte com o celular. `coroutines-play-services` da o
  // `.await()` nas Task do GMS, para o codigo nao virar pilha de callback.
  implementation("com.google.android.gms:play-services-wearable:18.2.0")
  implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.9.0")

  // Batimentos.
  implementation("androidx.health:health-services-client:1.0.0-rc02")
  implementation("com.google.guava:guava:33.3.1-android")
  implementation("androidx.concurrent:concurrent-futures-ktx:1.2.0")

  // Tile.
  implementation("androidx.wear.tiles:tiles:1.4.1")
  implementation("androidx.wear.watchface:watchface-complications-data-source-ktx:1.2.1")
  implementation("androidx.wear.protolayout:protolayout:1.2.1")
  implementation("androidx.wear.protolayout:protolayout-material:1.2.1")
  implementation("androidx.wear.protolayout:protolayout-expression:1.2.1")

  debugImplementation("androidx.compose.ui:ui-tooling")
}
