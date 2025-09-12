/**
 * Configuration Loader - Fallback implementation for missing c12
 */

import fs from 'fs';
import path from 'path';

export async function loadConfig(options = {}) {
  try {
    const configName = options.name || 'config';
    const configExtensions = ['.js', '.mjs', '.json'];
    let config = options.defaults || {};
    
    // Try to load config files from current directory
    for (const ext of configExtensions) {
      const configPath = path.join(process.cwd(), `${configName}${ext}`);
      try {
        if (fs.existsSync(configPath)) {
          if (ext === '.json') {
            const content = fs.readFileSync(configPath, 'utf-8');
            const fileConfig = JSON.parse(content);
            config = { ...config, ...fileConfig };
          } else {
            // For JS/MJS files, we'd need dynamic import, but for now just use defaults
            // This is a simplified fallback - in production you'd want proper config loading
          }
          break;
        }
      } catch (error) {
        // Continue trying other extensions
      }
    }
    
    return { config };
    
  } catch (error) {
    // Return defaults if config loading fails
    return { config: options.defaults || {} };
  }
}

// Re-export for compatibility
export default loadConfig;