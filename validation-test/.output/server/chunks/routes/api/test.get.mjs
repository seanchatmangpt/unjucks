import { d as defineEventHandler } from '../../nitro/nitro.mjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:url';
import '@iconify/utils';
import 'consola';

const test_get = defineEventHandler(async (event) => {
  await new Promise((resolve) => setTimeout(resolve, 100));
  return {
    success: true,
    data: {
      message: "API route is working correctly!",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      method: event.node.req.method,
      path: event.node.req.url
    }
  };
});

export { test_get as default };
//# sourceMappingURL=test.get.mjs.map
