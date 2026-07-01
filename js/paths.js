export const PATHS = {
  textures: './texture',
  audio: './audio'
};

export function texture(path) {
  return `${PATHS.textures}/${path}`;
}

export function audio(path) {
  return `${PATHS.audio}/${path}`;
}