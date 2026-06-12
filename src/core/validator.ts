import path from 'path';
import fs from 'fs-extra';
import { loadConfig, type ElectronifyConfig } from './config.js';

/**
 * Validates the Electronify project structure.
 * Checks for config.json, build folder, and required assets.
 */
export async function validateProject(): Promise<ElectronifyConfig> {
  const configDir = path.join(process.cwd(), 'electronify');
  const configPath = path.join(configDir, 'config.json');

  // 1. Check for electronify directory
  if (!await fs.pathExists(configDir)) {
    throw new Error('Missing "electronify/" directory in project root.');
  }

  // 2. Validate configuration
  const config = await loadConfig(configPath);

  // 3. Validate build folder
  const absoluteBuildFolder = path.resolve(process.cwd(), config.buildFolder);
  if (!await fs.pathExists(absoluteBuildFolder)) {
    throw new Error(`Build folder not found at: ${config.buildFolder}`);
  }

  if (!(await fs.stat(absoluteBuildFolder)).isDirectory()) {
    throw new Error(`Path ${config.buildFolder} is not a directory.`);
  }

  // 4. Validate assets
  const assetsDir = path.join(configDir, 'assets');
  if (!await fs.pathExists(assetsDir)) {
    throw new Error('Missing "electronify/assets/" directory.');
  }

  const requiredAssets = [
    { file: 'logo.png', critical: true },
    { file: 'icon.ico', critical: false },
    { file: 'tray.png', critical: false },
    { file: 'splash.png', critical: false },
  ];

  for (const asset of requiredAssets) {
    const assetPath = path.join(assetsDir, asset.file);
    if (!await fs.pathExists(assetPath)) {
      if (asset.critical) {
        throw new Error(`Critical asset missing: ${asset.file}`);
      } else {
        console.warn(`⚠️  Optional asset missing: ${asset.file}`);
      }
    }
  }

  return config;
}
