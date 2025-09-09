#!/bin/bash
# Buildah container building alternative to Docker

set -euo pipefail

# Create working container
ctr=$(buildah from node:18-alpine)

# Install dependencies
buildah run $ctr -- apk update
buildah run $ctr -- apk add --no-cache dumb-init

# Set working directory
buildah config --workingdir /app $ctr

# Copy files
buildah copy $ctr package*.json ./
buildah copy $ctr bin/ ./bin/
buildah copy $ctr src/ ./src/
buildah copy $ctr _templates/ ./_templates/

# Install npm dependencies
buildah run $ctr -- npm ci --only=production

# Configure container
buildah config --entrypoint '["dumb-init", "--"]' $ctr
buildah config --cmd '["node", "bin/unjucks.cjs", "--help"]' $ctr
buildah config --port 3000 $ctr

# Create image
buildah commit $ctr unjucks:buildah

echo "Container built with buildah: unjucks:buildah"
