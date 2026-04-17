const { withSettingsGradle } = require("@expo/config-plugins");

/**
 * @react-native-async-storage/async-storage v3+ ships the storage-android
 * KMP AAR in a local_repo directory bundled with the npm package, but its
 * build.gradle only declares mavenCentral() and google() — not the local_repo.
 * Add the local_repo path to dependencyResolutionManagement so Gradle can
 * find org.asyncstorage.shared_storage:storage-android:1.0.0 at build time.
 */
module.exports = function withAndroidRepositoriesMode(config) {
  return withSettingsGradle(config, (mod) => {
    // Define the path at script level (outside the closure) so Groovy
    // resolves it correctly — rootDir is a Settings property accessible here.
    mod.modResults.contents += `
def asyncStorageLocalRepo = new File(rootDir, "../node_modules/@react-native-async-storage/async-storage/android/local_repo").canonicalPath
dependencyResolutionManagement {
  repositories {
    maven { url = uri(asyncStorageLocalRepo) }
  }
}
`;
    return mod;
  });
};
