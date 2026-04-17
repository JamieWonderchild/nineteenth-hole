const { withProjectBuildGradle } = require("@expo/config-plugins");

/**
 * @react-native-async-storage/async-storage v3+ ships storage-android:1.0.0
 * as a pre-built KMP AAR in a local_repo directory bundled with the npm
 * package, but its build.gradle does not declare this path as a Maven repo.
 *
 * The root build.gradle has `allprojects { repositories {} }` which makes
 * repos available to all subprojects. We insert the local_repo path here so
 * Gradle can resolve org.asyncstorage.shared_storage:storage-android:1.0.0.
 */
module.exports = function withAndroidRepositoriesMode(config) {
  return withProjectBuildGradle(config, (mod) => {
    if (mod.modResults.contents.includes("async-storage/android/local_repo")) {
      return mod; // Already patched
    }
    // Insert after the JitPack line inside allprojects { repositories {} }
    mod.modResults.contents = mod.modResults.contents.replace(
      "maven { url 'https://www.jitpack.io' }",
      "maven { url 'https://www.jitpack.io' }\n    maven { url \"${rootDir}/../node_modules/@react-native-async-storage/async-storage/android/local_repo\" }"
    );
    return mod;
  });
};
