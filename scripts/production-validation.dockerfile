# Production Validation Dockerfile
# Tests the npm package in multiple clean environments

FROM node:18-alpine AS base
RUN apk add --no-cache git bash curl

# Test 1: Clean npm install
FROM base AS npm-install-test
WORKDIR /test
COPY package.json package-lock.json ./
RUN npm ci --production
COPY . .
RUN node bin/unjucks.cjs --help
RUN node bin/unjucks.cjs --version
RUN node bin/unjucks.cjs list

# Test 2: Global install test
FROM base AS global-install-test
WORKDIR /test
COPY seanchatmangpt-unjucks-2025.9.8.tgz ./
RUN npm install -g seanchatmangpt-unjucks-2025.9.8.tgz
RUN unjucks --help
RUN unjucks --version
RUN unjucks list

# Test 3: Zero-config usage test
FROM base AS zero-config-test
WORKDIR /app
COPY seanchatmangpt-unjucks-2025.9.8.tgz ./
RUN npm install seanchatmangpt-unjucks-2025.9.8.tgz
RUN npx unjucks --help
RUN npx unjucks list

# Test 4: Template generation test
FROM base AS template-test
WORKDIR /project
COPY seanchatmangpt-unjucks-2025.9.8.tgz ./
RUN npm install seanchatmangpt-unjucks-2025.9.8.tgz
# Test basic template generation
RUN mkdir -p _templates/component/new
RUN echo "---\nto: src/components/<%= name %>.js\n---\nexport const <%= name %> = () => {\n  return <div><%= name %></div>;\n};" > _templates/component/new/component.js.ejs
RUN npx unjucks generate component new TestComponent
RUN test -f src/components/TestComponent.js

# Final validation stage
FROM base AS validation-summary
WORKDIR /summary
COPY --from=npm-install-test /test/package.json ./npm-install.json
COPY --from=global-install-test /usr/local/lib/node_modules/@seanchatmangpt/unjucks/package.json ./global-install.json
COPY --from=zero-config-test /app/node_modules/@seanchatmangpt/unjucks/package.json ./zero-config.json
COPY --from=template-test /project/src/components/TestComponent.js ./test-component.js
RUN echo "All validation tests passed!" > validation-complete.txt