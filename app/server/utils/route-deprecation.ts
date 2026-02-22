export function markLegacyRoute(event: any, replacementPath: string) {
  setHeader(event, 'Deprecation', 'true')
  setHeader(event, 'Sunset', 'Wed, 31 Dec 2026 23:59:59 GMT')
  setHeader(event, 'Link', `<${replacementPath}>; rel="successor-version"`)
}
