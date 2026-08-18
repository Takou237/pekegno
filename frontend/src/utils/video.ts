const YOUTUBE_REGEX = /(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/;

export function isYouTubeUrl(url: string | null | undefined): boolean {
  return typeof url === 'string' && YOUTUBE_REGEX.test(url.trim());
}

export function getYouTubeEmbedUrl(url: string | null | undefined): string | null {
  if (typeof url !== 'string') return null;
  const match = url.trim().match(YOUTUBE_REGEX);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}