/* Scope-bug lint for server.js and friends. Run with:

     npx -y eslint@9 -c eslint.config.cjs server.js buymax.js buymax-adapter.js test/regression/*.js

   Three rules, nothing stylistic. `node --check` only parses; it missed
   three scope bugs in September that each of these would have caught.

   no-use-before-define has functions:false because server.js calls
   hoisted `function` declarations before they appear ~30 times, which is
   safe. The dangerous case is const/let/class used before its line
   (a TDZ crash at runtime) and that stays checked.

   Self-contained on purpose: no plugins and no `globals` package, so
   there is nothing to add to package.json and nothing new for Render to
   install. */
const node = {
  require: "readonly", module: "writable", exports: "writable", process: "readonly",
  Buffer: "readonly", console: "readonly", __dirname: "readonly", __filename: "readonly",
  setTimeout: "readonly", setInterval: "readonly", setImmediate: "readonly",
  clearTimeout: "readonly", clearInterval: "readonly", clearImmediate: "readonly",
  URL: "readonly", URLSearchParams: "readonly", fetch: "readonly", AbortController: "readonly",
  TextEncoder: "readonly", TextDecoder: "readonly", global: "readonly", globalThis: "readonly",
  structuredClone: "readonly", queueMicrotask: "readonly", performance: "readonly"
};
module.exports = [
  {
    files: ["**/*.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "commonjs", globals: node },
    rules: {
      "no-undef": "error",
      "no-redeclare": "error",
      "no-use-before-define": ["error", { variables: false, functions: false }]
    }
  }
];
