pluginManagement {
  repositories {
    google()
    mavenCentral()
    gradlePluginPortal()
  }
}

dependencyResolutionManagement {
  repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
  repositories {
    google()
    mavenCentral()
  }
}

// Projeto Gradle proprio, separado de app/android, por dois motivos: aquela
// pasta e gerada pelo prebuild do Expo e esta no .gitignore, e desde o Wear OS 2
// o Google descontinuou o app embutido — relogio tem artefato e listagem
// propria. Build e instalacao sao independentes do app do celular.
rootProject.name = "MellowPetWear"
include(":app")
