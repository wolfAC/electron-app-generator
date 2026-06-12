import { z } from 'zod';
import fs from 'fs-extra';

/**
 * Configuration schema for Electronify.
 * Validates the config.json file used by the generator.
 */
export const ConfigSchema = z.object({
  name: z.string().min(1, "App name is required"),
  appId: z.string().min(1, "App ID is required (e.g., com.company.myapp)"),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Version must be in semver format (e.g., 1.0.0)").default("1.0.0"),

  author: z.object({
    name: z.string().default("Electronify User"),
    email: z.email("Invalid author email").default("admin@example.com"),
  }).prefault({}),

  homepage: z.url("Homepage must be a valid URL").default("https://example.com"),

  buildFolder: z.string().min(1, "Build folder path is required").default("./build"),

  window: z.object({
    width: z.number().int().positive().default(1400),
    height: z.number().int().positive().default(900),
    minWidth: z.number().int().positive().default(1000),
    minHeight: z.number().int().positive().default(700),
  }).prefault({}),

  features: z.object({
    tray: z.boolean().default(false),
    notifications: z.boolean().default(true),
    dragDrop: z.boolean().default(true),
    singleInstance: z.boolean().default(true),
    autoUpdater: z.boolean().default(true),
  }).prefault({}),

  updater: z.object({
    provider: z.enum(["custom", "firebase", "cloudflare", "github", "s3"]).default("custom"),
    url: z.url("Updater URL must be a valid URL").default("https://updates.example.com"),
  }).prefault({}),

  plugins: z.array(z.string()).default([]),
});

export type ElectronifyConfig = z.infer<typeof ConfigSchema>;

/**
 * Loads and validates the configuration file.
 * @param configPath Path to the config.json file.
 * @throws Error if configuration is invalid.
 */
export async function loadConfig(configPath: string): Promise<ElectronifyConfig> {
  if (!await fs.pathExists(configPath)) {
    throw new Error(`Configuration file not found at ${configPath}`);
  }

  const rawConfig = await fs.readJson(configPath);
  const result = ConfigSchema.safeParse(rawConfig);

  if (!result.success) {
    const errors = result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join('\n');
    throw new Error(`Invalid configuration:\n${errors}`);
  }

  return result.data;
}
