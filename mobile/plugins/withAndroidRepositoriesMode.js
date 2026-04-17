const { withSettingsGradle } = require("@expo/config-plugins");

/**
 * Changes FAIL_ON_PROJECT_REPOS to PREFER_SETTINGS in settings.gradle.
 * Required because some npm packages declare Maven repositories at the
 * project level in their build.gradle, which Gradle 8 rejects with
 * FAIL_ON_PROJECT_REPOS mode.
 */
module.exports = function withAndroidRepositoriesMode(config) {
  return withSettingsGradle(config, (mod) => {
    mod.modResults.contents = mod.modResults.contents.replace(
      /FAIL_ON_PROJECT_REPOS/g,
      "PREFER_SETTINGS"
    );
    return mod;
  });
};
