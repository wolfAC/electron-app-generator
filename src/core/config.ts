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

  protocol: z.string()
    .regex(/^[a-z][a-z0-9+\-.]*$/, "Protocol must be a valid URI scheme (e.g., 'app', 'pulse', 'myapp')")
    .default("app"),

  window: z.object({
    width: z.number().int().positive().default(1400),
    height: z.number().int().positive().default(900),
    minWidth: z.number().int().min(0).default(0),
    minHeight: z.number().int().min(0).default(0),
    maxWidth: z.number().int().positive().optional(),
    maxHeight: z.number().int().positive().optional(),
  }).prefault({}),

  features: z.object({
    tray: z.boolean().default(false),
    menuBar: z.boolean().default(true),
    notifications: z.boolean().default(true),
    dragDrop: z.boolean().default(true),
    singleInstance: z.boolean().default(true),
    autoUpdater: z.boolean().default(true),
  }).prefault({}),

  updater: z.object({
    provider: z.enum(["custom", "firebase", "cloudflare", "github", "s3"]).default("custom"),
    url: z.url("Updater URL must be a valid URL").default("https://updates.example.com"),
  }).prefault({}),

  linux: z.object({
    targets: z.array(z.enum(['AppImage', 'deb', 'rpm', 'snap', 'pacman', 'flatpak'])).default(['AppImage', 'deb']),
  }).prefault({}),

  win: z.object({
    targets: z.array(z.enum(['nsis', 'msi', 'portable', 'zip', '7z'])).default(['nsis']),
  }).prefault({}),

  mac: z.object({
    targets: z.array(z.enum(['dmg', 'pkg', 'zip', 'mas'])).default(['dmg']),
  }).prefault({}),

  apiUrl: z.string().default(""),

  vercelBypassSecret: z.string().default(""),

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
