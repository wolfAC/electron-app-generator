import path from 'path';
import fs from 'fs-extra';
import { loadConfig } from './config.js';

/**
 * PluginManager handles the loading and execution of plugins for Electronify.
 */
export class PluginManager {
  constructor() {
    this.plugins = [];
  }

  /**
   * Loads plugins based on the configuration and available plugin files.
   * @param {z.infer<typeof ConfigSchema>} config Validated configuration.
   */
  async loadPlugins(config) {
    const pluginsToLoad = config.plugins || [];
    const pluginsDir = path.join(process.cwd(), 'src/plugins');

    for (const pluginName of pluginsToLoad) {
      try {
        const pluginPath = path.join(pluginsDir, `${pluginName}.js`);
        if (await fs.pathExists(pluginPath)) {
          const plugin = await import(pluginPath);
          // Handle both default export and named export
          const pluginModule = plugin.default || plugin;

          if (typeof pluginModule.init === 'function') {
            await pluginModule.init(config);
          }

          this.plugins.push(pluginModule);
          console.log(`🔌 Loaded plugin: ${pluginName}`);
        } else {
          console.warn(`⚠️  Plugin ${pluginName} not found at ${pluginsDir}`);
        }
      } catch (e) {
        console.error(`❌ Failed to load plugin ${pluginName}:`, e);
      }
    }
  }

  /**
   * Executes a hook across all loaded plugins.
   * @param {string} hook Name of the hook (e.g., 'preBuild').
   * @param {any} context Data to pass to the plugins.
   */
  async executeHook(hook, context) {
    for (const plugin of this.plugins) {
      if (typeof plugin[hook] === 'function') {
        await plugin[hook](context);
      }
    }
  }
}

export const pluginManager = new PluginManager();
