import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  resolveAvatarId,
  scoutyAvatarCatalog,
  SCOUTY_DEFAULT_AVATAR_ID,
} from '../../constants/scouty-avatar-catalog';

describe('frontend scouty avatar catalog', () => {
  it('contains all 12 stable IDs exactly once', () => {
    const ids = scoutyAvatarCatalog.map((item) => item.id);
    const uniqueIds = new Set(ids);

    expect(ids).toHaveLength(12);
    expect(uniqueIds.size).toBe(12);
  });

  it('maps each catalog item to a bundled local asset file', () => {
    for (const item of scoutyAvatarCatalog) {
      const fullPath = path.join(process.cwd(), 'scouty-copilot-handoff', 'assets', 'avatars', item.assetFilename);
      expect(existsSync(fullPath)).toBe(true);
    }
  });

  it('falls back to default avatar id when given unknown values', () => {
    expect(resolveAvatarId(null)).toBe(SCOUTY_DEFAULT_AVATAR_ID);
    expect(resolveAvatarId(undefined)).toBe(SCOUTY_DEFAULT_AVATAR_ID);
    expect(resolveAvatarId('not-supported')).toBe(SCOUTY_DEFAULT_AVATAR_ID);
    expect(resolveAvatarId('sleepy')).toBe('sleepy');
  });
});
