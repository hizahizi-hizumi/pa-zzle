import { serve } from "bun";
import index from "./index.html";

const server = serve({
  routes: {
    "/*": index,
  },
  development: {
    hmr: true,
  },
});

console.log(`Frontend development server running at ${server.url}`);
