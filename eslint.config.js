// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // every text is Fraunces: see src/components/text.tsx
    ignores: ["src/components/text.tsx"],
    rules: {
      "no-restricted-imports": ["error", { paths: [{ name: "react-native", importNames: ["Text", "TextInput"], message: "Use Text/TextInput from @/components/text (Fraunces)." }] }],
    },
  },
]);
