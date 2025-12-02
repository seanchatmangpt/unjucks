/**
 * KGEN Marketplace Commands
 * 
 * Main entry point for marketplace-related commands including:
 * - install: Install KPacks with cryptographic verification
 * - search: Search for KPacks in registries
 * - publish: Publish KPacks to registries
 * - list: List installed KPacks
 */

import { defineCommand } from 'citty';

export default defineCommand({
  meta: {
    name: 'marketplace',
    description: 'KGEN Marketplace operations for KPack management'
  },
  subCommands: {
    install: () => import('./marketplace/install.js'),
    // Future commands:
    // search: () => import('./marketplace/search.js'),
    // publish: () => import('./marketplace/publish.js'),
    // list: () => import('./marketplace/list.js'),
    // uninstall: () => import('./marketplace/uninstall.js')
  }
});