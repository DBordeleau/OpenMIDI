export const MIN_AVATAR_IMAGE_SIDE = 128;
export const MAX_AVATAR_IMAGE_SIDE = 4096;
export const MAX_AVATAR_IMAGE_PIXELS = 4096 * 4096;

export function hasValidAvatarDimensions(input: {
  width: number;
  height: number;
}) {
  return (
    Number.isInteger(input.width) &&
    Number.isInteger(input.height) &&
    input.width >= MIN_AVATAR_IMAGE_SIDE &&
    input.height >= MIN_AVATAR_IMAGE_SIDE &&
    input.width <= MAX_AVATAR_IMAGE_SIDE &&
    input.height <= MAX_AVATAR_IMAGE_SIDE &&
    input.width * input.height <= MAX_AVATAR_IMAGE_PIXELS
  );
}
