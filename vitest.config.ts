import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "build/**/*", "dist/**/*", "tests/e2e/**/*"],
  },
});
