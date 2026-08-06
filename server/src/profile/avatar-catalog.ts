export const SCOUTY_DEFAULT_AVATAR_ID = 'smiling' as const;

export const scoutyAvatarCatalog = [
  {
    id: 'binoculars',
    label: 'Explorer Scouty',
    suppliedFilename: 'Scouty Searches with Binoculars.png',
    assetFilename: 'scouty-avatar-binoculars.png',
  },
  {
    id: 'smiling',
    label: 'Smiling Scouty',
    suppliedFilename: 'Scouty\u2019s smiling blue raccoon avatar.png',
    assetFilename: 'scouty-avatar-smiling.png',
  },
  {
    id: 'movie-popcorn',
    label: 'Movie Night Scouty',
    suppliedFilename: 'Scouty\u2019s 3D Movie Popcorn.png',
    assetFilename: 'scouty-avatar-movie-popcorn.png',
  },
  {
    id: 'smartphone',
    label: 'Mobile Scouty',
    suppliedFilename: 'Scouty checks a smartphone.png',
    assetFilename: 'scouty-avatar-smartphone.png',
  },
  {
    id: 'film-reel',
    label: 'Film Reel Scouty',
    suppliedFilename: 'Scouty Loads a Blue Film Reel.png',
    assetFilename: 'scouty-avatar-film-reel.png',
  },
  {
    id: 'thumbs-up',
    label: 'Thumbs-Up Scouty',
    suppliedFilename: 'Scouty\u2019s sparkling thumbs-up.png',
    assetFilename: 'scouty-avatar-thumbs-up.png',
  },
  {
    id: 'empty-popcorn',
    label: 'Empty Popcorn Scouty',
    suppliedFilename: 'Scouty and the Empty Popcorn Bucket.png',
    assetFilename: 'scouty-avatar-empty-popcorn.png',
  },
  {
    id: 'filmstrip-tangle',
    label: 'Puzzled Scouty',
    suppliedFilename: 'Scouty\u2019s puzzled filmstrip tangle.png',
    assetFilename: 'scouty-avatar-filmstrip-tangle.png',
  },
  {
    id: 'heart',
    label: 'Heart Scouty',
    suppliedFilename: 'Scouty Hugs a Coral Heart.png',
    assetFilename: 'scouty-avatar-heart.png',
  },
  {
    id: 'checkmark',
    label: 'Celebration Scouty',
    suppliedFilename: 'Scouty celebrates with a checkmark badge.png',
    assetFilename: 'scouty-avatar-checkmark.png',
  },
  {
    id: 'profile-card',
    label: 'Profile Scouty',
    suppliedFilename: 'Scouty Waves with a Profile Card.png',
    assetFilename: 'scouty-avatar-profile-card.png',
  },
  {
    id: 'sleepy',
    label: 'Sleepy Scouty',
    suppliedFilename: 'Sleepy Scouty with Popcorn and Stars.png',
    assetFilename: 'scouty-avatar-sleepy.png',
  },
] as const;

export type ScoutyAvatarId = (typeof scoutyAvatarCatalog)[number]['id'];

const allowedAvatarIds = new Set<string>(scoutyAvatarCatalog.map((item) => item.id));

export function isSupportedScoutyAvatarId(value: string): value is ScoutyAvatarId {
  return allowedAvatarIds.has(value);
}

export function resolveStoredAvatarId(avatarId: string | null | undefined): ScoutyAvatarId {
  if (!avatarId) {
    return SCOUTY_DEFAULT_AVATAR_ID;
  }

  return isSupportedScoutyAvatarId(avatarId) ? avatarId : SCOUTY_DEFAULT_AVATAR_ID;
}
