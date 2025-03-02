/**
 * Configuration for Philips Hue Entertainment API
 */

export const hueConfig = {
  // Don't force entertainment API to avoid blocking the app when it doesn't work
  forceEntertainmentAPI: false,

  // Default update rate for DTLS (updates per second)
  defaultDtlsUpdateRate: 50,

  // Default update rate for color transitions (updates per second)
  defaultColorUpdateRate: 25,

  // Default port for DTLS communication
  defaultDtlsPort: 2100,

  // Timeout for DTLS connection in milliseconds
  dtlsConnectionTimeout: 10000,

  // Debug mode - enables extra logging
  debug: true
};
