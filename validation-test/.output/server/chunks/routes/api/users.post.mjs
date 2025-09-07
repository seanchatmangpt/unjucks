import { d as defineEventHandler, r as readBody, c as createError } from '../../nitro/nitro.mjs';
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

const users_post = defineEventHandler(async (event) => {
  const body = await readBody(event);
  if (!body.name || !body.email) {
    throw createError({
      statusCode: 400,
      statusMessage: "Name and email are required"
    });
  }
  const user = {
    id: Math.random().toString(36).substr(2, 9),
    name: body.name,
    email: body.email,
    created: (/* @__PURE__ */ new Date()).toISOString()
  };
  return {
    success: true,
    user
  };
});

export { users_post as default };
//# sourceMappingURL=users.post.mjs.map
