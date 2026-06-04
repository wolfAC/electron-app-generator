import path from 'path';
import fs from 'fs-extra';
import { validateProject } from './validator.js';
import { pluginManager } from './pluginManager.js';

/**
 * Base class for Publish Providers
 */
class PublishProvider {
  async upload(artifactPath, config) { throw new Error('Not implemented'); }
}

class GitHubProvider extends PublishProvider {
  async upload(artifactPath, config) {
    console.log(`Uploading ${artifactPath} to GitHub Releases...`);
    // Use 'gh' CLI or octokit
  }
}

class CustomHTTPProvider extends PublishProvider {
  async upload(artifactPath, config) {
    console.log(`Uploading ${artifactPath} to ${config.updater.url}...`);
    // Custom upload logic
  }
}

const PROVIDERS = {
  github: GitHubProvider,
  custom: CustomHTTPProvider,
};

export async function publishProject() {
  const config = await validateProject();

  // Initialize plugins
  await pluginManager.loadPlugins(config);

  const releaseDir = path.join(process.cwd(), 'releases');

  if (!await fs.pathExists(releaseDir)) {
    throw new Error('No releases directory found. Run build first.');
  }

  const files = await fs.readdir(releaseDir);
  if (files.length === 0) {
    throw new Error('No artifacts found in releases directory.');
  }

  // Hook: prePublish
  await pluginManager.executeHook('prePublish', { config, releaseDir, files });

  const ProviderClass = PROVIDERS[config.updater.provider] || PROVIDERS.custom;
  const provider = new ProviderClass();

  console.log(`Publishing ${files.length} artifacts via ${config.updater.provider} provider...`);

  for (const file of files) {
    const filePath = path.join(releaseDir, file);
    await provider.upload(filePath, config);
  }

  // Hook: postPublish
  await pluginManager.executeHook('postPublish', { config, releaseDir, files });

  console.log('✅ All artifacts published successfully!');
}
