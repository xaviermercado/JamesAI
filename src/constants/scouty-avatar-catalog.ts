export const SCOUTY_DEFAULT_AVATAR_ID = 'smiling' as const;

export const scoutyAvatarCatalog = [
  { id: 'binoculars', label: 'Explorer Scouty', assetFilename: 'scouty-avatar-binoculars.png' },
  { id: 'smiling', label: 'Smiling Scouty', assetFilename: 'scouty-avatar-smiling.png' },
  { id: 'movie-popcorn', label: 'Movie Night Scouty', assetFilename: 'scouty-avatar-movie-popcorn.png' },
  { id: 'smartphone', label: 'Mobile Scouty', assetFilename: 'scouty-avatar-smartphone.png' },
  { id: 'film-reel', label: 'Film Reel Scouty', assetFilename: 'scouty-avatar-film-reel.png' },
  { id: 'thumbs-up', label: 'Thumbs-Up Scouty', assetFilename: 'scouty-avatar-thumbs-up.png' },
  { id: 'empty-popcorn', label: 'Empty Popcorn Scouty', assetFilename: 'scouty-avatar-empty-popcorn.png' },
  { id: 'filmstrip-tangle', label: 'Puzzled Scouty', assetFilename: 'scouty-avatar-filmstrip-tangle.png' },
  { id: 'heart', label: 'Heart Scouty', assetFilename: 'scouty-avatar-heart.png' },
  { id: 'checkmark', label: 'Celebration Scouty', assetFilename: 'scouty-avatar-checkmark.png' },
  { id: 'profile-card', label: 'Profile Scouty', assetFilename: 'scouty-avatar-profile-card.png' },
  { id: 'sleepy', label: 'Sleepy Scouty', assetFilename: 'scouty-avatar-sleepy.png' },
] as const;

export type ScoutyAvatarId = (typeof scoutyAvatarCatalog)[number]['id'];

const allowedAvatarIds = new Set<string>(scoutyAvatarCatalog.map((item) => item.id));

export function isSupportedScoutyAvatarId(value: string): value is ScoutyAvatarId {
  return allowedAvatarIds.has(value);
}

export function resolveAvatarId(value: string | null | undefined): ScoutyAvatarId {
  if (!value) {
    return SCOUTY_DEFAULT_AVATAR_ID;
  }

  return isSupportedScoutyAvatarId(value) ? value : SCOUTY_DEFAULT_AVATAR_ID;
}
