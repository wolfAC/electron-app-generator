import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { validateProject } from './validator.js';
import { build } from 'electron-builder';
import { pluginManager } from './pluginManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GENERATOR_ROOT = path.join(__dirname, '..', '..');

/**
 * Builds the Electron application using the project configuration.
 */
export async function buildProject() {
  const config = await validateProject();

  // Initialize plugins
  await pluginManager.loadPlugins(config);

  const outputDir = path.join(process.cwd(), 'dist_electron');
  const appDir = path.join(outputDir, 'app');

  console.log(`🚀 Starting build for ${config.name}...`);

  // Hook: preBuild
  await pluginManager.executeHook('preBuild', { config, appDir });

  // 1. Clean and create output directories
  await fs.emptyDir(outputDir);
  await fs.ensureDir(appDir);

  // 2. Copy build folder to the app directory
  const buildSource = path.resolve(process.cwd(), config.buildFolder);
  const buildDest = path.join(appDir, 'web');
  await fs.copy(buildSource, buildDest);

  // 3. Copy assets
  const assetsSource = path.join(process.cwd(), 'electronify', 'assets');
  const assetsDest = path.join(appDir, 'assets');
  await fs.copy(assetsSource, assetsDest);

  // 4. Generate Electron package.json
  const appPackageJson = {
    name: config.appId,
    version: config.version,
    description: `${config.name} Desktop Application`,
    author: {
      name: config.author.name,
      email: config.author.email,
    },
    homepage: config.homepage,
    main: 'main.js',
    scripts: {
      start: 'electron .'
    },
    dependencies: {
      'electron-log': '^5.4.4',
      'fs-extra': '^11.3.5'
    },
    devDependencies: {
      'electron': '^32.0.0'
    }
  };
  await fs.writeJson(path.join(appDir, 'package.json'), appPackageJson, { spaces: 2 });

  // Force pnpm for electron-builder by creating a dummy lockfile
  await fs.writeFile(path.join(appDir, 'pnpm-lock.yaml'), '');

  // 5. Generate main.js from template
  const mainTemplatePath = path.join(GENERATOR_ROOT, 'src/templates/electron/main.js.template');
  const mainTemplate = await fs.readFile(mainTemplatePath, 'utf8');
  const mainContent = mainTemplate.replace('{{CONFIG}}', JSON.stringify(config, null, 2));
  await fs.writeFile(path.join(appDir, 'main.js'), mainContent);

  // 6. Generate preload.js from template
  const preloadTemplatePath = path.join(GENERATOR_ROOT, 'src/templates/electron/preload.js.template');
  const preloadTemplate = await fs.readFile(preloadTemplatePath, 'utf8');
  await fs.writeFile(path.join(appDir, 'preload.js'), preloadTemplate);

  // 7. Generate updater.js from template
  const updaterTemplatePath = path.join(GENERATOR_ROOT, 'src/templates/electron/updater.js.template');
  const updaterTemplate = await fs.readFile(updaterTemplatePath, 'utf8');
  await fs.writeFile(path.join(appDir, 'updater.js'), updaterTemplate);

  console.log(`📦 Electron app assembled at ${appDir}`);

  // 8. Execute Electron Builder
  console.log('🛠️  Building installer with electron-builder...');
  try {
    await build({
      config: {
        appId: config.appId,
        productName: config.name,
        electronVersion: '32.0.0',
        directories: {
          app: appDir,
          output: path.join(process.cwd(), 'releases'),
        },
        files: ['**/*'],
        win: {
          target: 'nsis',
        },
        mac: {
          target: 'dmg',
        },
        linux: {
          target: ['AppImage', 'deb'],
          category: 'Utility',
          maintainer: `${config.author.name} <${config.author.email}>`,
        },
        nsis: {
          oneClick: false,
          allowToChangeInstallationDirectory: true,
        },
      },
    });
    console.log(`✅ Installer built successfully in releases/`);
  } catch (error) {
    console.error('Electron Builder failed:', error);
    throw error;
  }

  // Hook: postBuild
  await pluginManager.executeHook('postBuild', { config, outputDir });
}
