import { describe, expect, it } from 'vitest';

import {
  isSupportedScoutyAvatarId,
  resolveStoredAvatarId,
  scoutyAvatarCatalog,
  SCOUTY_DEFAULT_AVATAR_ID,
} from './avatar-catalog';

describe('scouty avatar catalog', () => {
  it('contains all 12 stable IDs exactly once', () => {
    const ids = scoutyAvatarCatalog.map((item) => item.id);
    const uniqueIds = new Set(ids);

    expect(ids).toHaveLength(12);
    expect(uniqueIds.size).toBe(12);
    expect(ids).toEqual([
      'binoculars',
      'smiling',
      'movie-popcorn',
      'smartphone',
      'film-reel',
      'thumbs-up',
      'empty-popcorn',
      'filmstrip-tangle',
      'heart',
      'checkmark',
      'profile-card',
      'sleepy',
    ]);
  });

  it('validates supported avatar IDs only', () => {
    expect(isSupportedScoutyAvatarId('smiling')).toBe(true);
    expect(isSupportedScoutyAvatarId('not-valid')).toBe(false);
  });

  it('resolves default avatar when stored value is missing or invalid', () => {
    expect(resolveStoredAvatarId(null)).toBe(SCOUTY_DEFAULT_AVATAR_ID);
    expect(resolveStoredAvatarId(undefined)).toBe(SCOUTY_DEFAULT_AVATAR_ID);
    expect(resolveStoredAvatarId('legacy')).toBe(SCOUTY_DEFAULT_AVATAR_ID);
    expect(resolveStoredAvatarId('heart')).toBe('heart');
  });
});
