import { mergeConfig } from "vite";
import baseConfig from "./vite.config.ts";

export default mergeConfig(baseConfig, {
  server: { fs: { allow: [".", "/home/user/pa-zzle/frontend/node_modules"] } },
});
