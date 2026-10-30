/** External video hosting. Lessons store provider + reference; video files never go in Postgres. */
export type VideoProvider = 'youtube' | 'vimeo' | 'mux' | 'cloudflare' | 'url'

export function videoEmbedUrl(
  provider: VideoProvider,
  ref: string,
): { kind: 'iframe' | 'file'; src: string } {
  switch (provider) {
    case 'youtube':
      return {
        kind: 'iframe',
        src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(ref)}?rel=0`,
      }
    case 'vimeo':
      return { kind: 'iframe', src: `https://player.vimeo.com/video/${encodeURIComponent(ref)}` }
    case 'mux':
      return { kind: 'file', src: `https://stream.mux.com/${encodeURIComponent(ref)}.m3u8` }
    case 'cloudflare':
      return { kind: 'iframe', src: `https://iframe.videodelivery.net/${encodeURIComponent(ref)}` }
    case 'url':
      return { kind: 'file', src: ref }
  }
}
