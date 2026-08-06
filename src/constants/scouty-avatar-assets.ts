import { scoutyAvatarCatalog, SCOUTY_DEFAULT_AVATAR_ID, type ScoutyAvatarId } from './scouty-avatar-catalog';

const scoutyAvatarAssetMap: Record<ScoutyAvatarId, number> = {
  binoculars: require('../../scouty-copilot-handoff/assets/avatars/scouty-avatar-binoculars.png'),
  smiling: require('../../scouty-copilot-handoff/assets/avatars/scouty-avatar-smiling.png'),
  'movie-popcorn': require('../../scouty-copilot-handoff/assets/avatars/scouty-avatar-movie-popcorn.png'),
  smartphone: require('../../scouty-copilot-handoff/assets/avatars/scouty-avatar-smartphone.png'),
  'film-reel': require('../../scouty-copilot-handoff/assets/avatars/scouty-avatar-film-reel.png'),
  'thumbs-up': require('../../scouty-copilot-handoff/assets/avatars/scouty-avatar-thumbs-up.png'),
  'empty-popcorn': require('../../scouty-copilot-handoff/assets/avatars/scouty-avatar-empty-popcorn.png'),
  'filmstrip-tangle': require('../../scouty-copilot-handoff/assets/avatars/scouty-avatar-filmstrip-tangle.png'),
  heart: require('../../scouty-copilot-handoff/assets/avatars/scouty-avatar-heart.png'),
  checkmark: require('../../scouty-copilot-handoff/assets/avatars/scouty-avatar-checkmark.png'),
  'profile-card': require('../../scouty-copilot-handoff/assets/avatars/scouty-avatar-profile-card.png'),
  sleepy: require('../../scouty-copilot-handoff/assets/avatars/scouty-avatar-sleepy.png'),
};

export function getScoutyAvatarAsset(avatarId: ScoutyAvatarId): number {
  return scoutyAvatarAssetMap[avatarId] ?? scoutyAvatarAssetMap[SCOUTY_DEFAULT_AVATAR_ID];
}

export const scoutyAvatarOptions = scoutyAvatarCatalog.map((item) => ({
  ...item,
  source: getScoutyAvatarAsset(item.id),
}));
