import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { validateProject } from './validator.js';
import { build } from 'electron-builder';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GENERATOR_ROOT = path.join(__dirname, '..', '..');

/**
 * Packages the application into a runnable directory without creating installers.
 */
export async function packageProject() {
  const config = await validateProject();
  const outputDir = path.join(process.cwd(), 'dist_electron');
  const appDir = path.join(outputDir, 'app');

  console.log(`📦 Packaging ${config.name} for distribution...`);

  // 1. Assemble the app
  await fs.emptyDir(outputDir);
  await fs.ensureDir(appDir);

  const buildSource = path.resolve(process.cwd(), config.buildFolder);
  const buildDest = path.join(appDir, 'web');
  await fs.copy(buildSource, buildDest);

  const assetsSource = path.join(process.cwd(), 'electronify', 'assets');
  const assetsDest = path.join(appDir, 'assets');
  await fs.copy(assetsSource, assetsDest);

  const appPackageJson = {
    name: config.appId,
    version: config.version,
    main: 'main.js',
    scripts: { start: 'electron .' },
    dependencies: {
      'electron-log': '^5.4.4',
      'fs-extra': '^11.3.5'
    },
    devDependencies: {
      'electron': '^32.0.0'
    }
  };
  await fs.writeJson(path.join(appDir, 'package.json'), appPackageJson, { spaces: 2 });

  const mainTemplatePath = path.join(GENERATOR_ROOT, 'src/templates/electron/main.js.template');
  const mainTemplate = await fs.readFile(mainTemplatePath, 'utf8');
  const mainContent = mainTemplate.replace('{{CONFIG}}', JSON.stringify(config, null, 2));
  await fs.writeFile(path.join(appDir, 'main.js'), mainContent);

  const preloadTemplatePath = path.join(GENERATOR_ROOT, 'src/templates/electron/preload.js.template');
  const preloadTemplate = await fs.readFile(preloadTemplatePath, 'utf8');
  await fs.writeFile(path.join(appDir, 'preload.js'), preloadTemplate);

  const updaterTemplatePath = path.join(GENERATOR_ROOT, 'src/templates/electron/updater.js.template');
  const updaterTemplate = await fs.readFile(updaterTemplatePath, 'utf8');
  await fs.writeFile(path.join(appDir, 'updater.js'), updaterTemplate);

  // 2. Use electron-builder to create a 'dir' target (unpacked app)
  try {
    await build({
      config: {
        appId: config.appId,
        productName: config.name,
        electronVersion: '32.0.0',
        directories: {
          app: appDir,
          output: path.join(process.cwd(), 'releases/unpacked'),
        },
        win: { target: 'dir' },
        mac: { target: 'dir' },
        linux: { target: 'dir' },
      },
    });
    console.log(`✅ Unpacked application created in releases/unpacked/`);
  } catch (error) {
    console.error('Packaging failed:', error);
    throw error;
  }
}
