export function canSendMessage(params: {
  text: string;
  photoCount: number;
  recording: boolean;
}): boolean {
  const hasText = params.text.trim().length > 0;
  const hasPhotos = params.photoCount > 0;
  if (params.recording) return true; // in recording mode, send becomes "stop"
  return hasText || hasPhotos;
}

