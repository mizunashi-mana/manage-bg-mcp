import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

export const PackageInfoProviderTag = Symbol.for('PackageInfoProvider');

export interface PackageInfoProvider {
  getName: () => string;
  getVersion: () => string;
  getDescription: () => string;
  getHomepage: () => string;
}

class PackageInfoProviderImpl implements PackageInfoProvider {
  constructor(private readonly packageJson: { name: string; version: string; description: string; homepage: string }) {}

  getName(): string {
    return this.packageJson.name;
  }

  getVersion(): string {
    return this.packageJson.version;
  }

  getDescription(): string {
    return this.packageJson.description;
  }

  getHomepage(): string {
    return this.packageJson.homepage;
  }
}

const PackageJsonSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string(),
  homepage: z.string(),
});

export async function loadPackageInfo(): Promise<PackageInfoProvider> {
  const currentDir = dirname(fileURLToPath(import.meta.url));

  const packageJsonPaths = [
    resolve(currentDir, '../../../package.json'), // For built dist files (dist/src/services -> ../../../)
    resolve(currentDir, '../../package.json'), // For source context (src/services -> ../../)
  ];

  for (const path of packageJsonPaths) {
    try {
      const packageJson = PackageJsonSchema.parse(JSON.parse(await readFile(path, 'utf-8')));
      return new PackageInfoProviderImpl(packageJson);
    }
    catch (_error) {
      // Ignore errors and try the next path
    }
  }

  throw new Error('Failed to load package.json from known paths');
}
