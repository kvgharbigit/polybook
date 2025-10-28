const { withAppBuildGradle, withPodfile, createRunOncePlugin } = require('expo/config-plugins');

const pkg = { name: 'with-mlkit-translate', version: '1.0.0' };

function withAndroidDeps(config) {
  return withAppBuildGradle(config, (c) => {
    if (!c.modResults.contents.includes('com.google.mlkit:translate')) {
      c.modResults.contents = c.modResults.contents.replace(
        /dependencies\s*{/,
        `dependencies {
        implementation "com.google.mlkit:translate:17.0.2"`
      );
    }
    return c;
  });
}

function withIosPods(config) {
  return withPodfile(config, (c) => {
    if (!c.modResults.contents.includes("pod 'GoogleMLKit/Translate'")) {
      c.modResults.contents += `\n  pod 'GoogleMLKit/Translate'\n`;
    }
    return c;
  });
}

module.exports = createRunOncePlugin(
  (config) => withIosPods(withAndroidDeps(config)),
  pkg.name,
  pkg.version
);