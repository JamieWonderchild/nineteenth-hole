const { withSettingsGradle } = require("@expo/config-plugins");

/**
 * Two fixes needed for Android builds with React Native 0.74+ (Gradle 8):
 *
 * 1. The @react-native/gradle-plugin settings plugin sets FAIL_ON_PROJECT_REPOS
 *    in dependencyResolutionManagement. Some npm packages (e.g. async-storage)
 *    declare their own project-level repositories, which causes the build to fail.
 *    We override to PREFER_SETTINGS so project-level repo declarations are allowed.
 *
 * 2. @react-native-async-storage/async-storage v3+ ships storage-android KMP AAR
 *    in a local_repo directory bundled with the npm package, but does NOT declare
 *    this path in its own build.gradle. We add it to the settings repositories so
 *    Gradle can find the artifact.
 */
module.exports = function withAndroidRepositoriesMode(config) {
  return withSettingsGradle(config, (mod) => {
    mod.modResults.contents += `
dependencyResolutionManagement {
  repositoriesMode.set(org.gradle.api.artifacts.repositories.RepositoriesMode.PREFER_SETTINGS)
  repositories {
    maven {
      url = uri(new File(rootDir, "../node_modules/@react-native-async-storage/async-storage/android/local_repo").canonicalPath)
    }
  }
}
`;
    return mod;
  });
};
