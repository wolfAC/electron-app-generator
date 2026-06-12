#!/usr/bin/env node
import { Command } from 'commander';
import { validateProject } from '../core/validator.js';
import { buildProject } from '../core/builder.js';
import { packageProject } from '../core/packager.js';
import { publishProject } from '../core/publisher.js';

const program = new Command();

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

program
  .name('electronify')
  .description('Convert web production builds into desktop applications')
  .version('1.0.0');

program
  .command('validate')
  .description('Validate the project configuration and assets')
  .action(async () => {
    try {
      await validateProject();
      console.log('✅ Project is valid!');
    } catch (error) {
      console.error(`❌ Validation failed: ${errorMessage(error)}`);
      process.exit(1);
    }
  });

program
  .command('build')
  .description('Generate the Electron package and build the installer')
  .action(async () => {
    try {
      await validateProject();
      await buildProject();
      console.log('✅ Build successful!');
    } catch (error) {
      console.error(`❌ Build failed: ${errorMessage(error)}`);
      process.exit(1);
    }
  });

program
  .command('package')
  .description('Package the application without building installers')
  .action(async () => {
    try {
      await validateProject();
      await packageProject();
      console.log('✅ Packaging successful!');
    } catch (error) {
      console.error(`❌ Packaging failed: ${errorMessage(error)}`);
      process.exit(1);
    }
  });

program
  .command('publish')
  .description('Upload release artifacts using the configured provider')
  .action(async () => {
    try {
      await validateProject();
      await publishProject();
      console.log('✅ Publish successful!');
    } catch (error) {
      console.error(`❌ Publish failed: ${errorMessage(error)}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
