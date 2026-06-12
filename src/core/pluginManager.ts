import path from 'path';
import fs from 'fs-extra';
import { pathToFileURL } from 'url';
import type { ElectronifyConfig } from './config.js';

export type HookName = 'preBuild' | 'postBuild' | 'prePublish' | 'postPublish';

export interface HookContext {
  config: ElectronifyConfig;
  appDir?: string;
  outputDir?: string;
  releaseDir?: string;
  files?: string[];
}

export interface ElectronifyPlugin {
  init?: (config: ElectronifyConfig) => void | Promise<void>;
  preBuild?: (context: HookContext) => void | Promise<void>;
  postBuild?: (context: HookContext) => void | Promise<void>;
  prePublish?: (context: HookContext) => void | Promise<void>;
  postPublish?: (context: HookContext) => void | Promise<void>;
}

/**
 * PluginManager handles the loading and execution of plugins for Electronify.
 */
export class PluginManager {
  plugins: ElectronifyPlugin[] = [];

  /**
   * Loads plugins based on the configuration and available plugin files.
   * @param config Validated configuration.
   */
  async loadPlugins(config: ElectronifyConfig): Promise<void> {
    const pluginsToLoad = config.plugins || [];
    const pluginsDir = path.join(process.cwd(), 'src/plugins');

    for (const pluginName of pluginsToLoad) {
      try {
        const pluginPath = path.join(pluginsDir, `${pluginName}.js`);
        if (await fs.pathExists(pluginPath)) {
          const plugin = await import(pathToFileURL(pluginPath).href);
          // Handle both default export and named export
          const pluginModule: ElectronifyPlugin = plugin.default || plugin;

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
   * @param hook Name of the hook (e.g., 'preBuild').
   * @param context Data to pass to the plugins.
   */
  async executeHook(hook: HookName, context: HookContext): Promise<void> {
    for (const plugin of this.plugins) {
      const handler = plugin[hook];
      if (typeof handler === 'function') {
        await handler(context);
      }
    }
  }
}

export const pluginManager = new PluginManager();
