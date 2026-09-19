import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // src/pdf-reader was built and linted on its own (oxlint) before joining
    // the site. These two rules are React Compiler readiness checks, not bug
    // detectors: the reader deliberately keeps "latest value" refs for async
    // work and drives some state from effects (see the comments in its
    // hooks). Every other rule still applies to it.
    files: ["src/pdf-reader/**"],
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
