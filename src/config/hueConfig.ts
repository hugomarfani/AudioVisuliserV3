/**
 * Configuration for Philips Hue Entertainment API
 */
export const hueConfig = {
  // Force the app to use the Entertainment API and error if unavailable
  forceEntertainmentAPI: true,

  // Default rates for DTLS updates and color changes
  defaultDtlsUpdateRate: 20,  // Updates per second (20Hz by default)
  defaultColorUpdateRate: 20, // Color transitions per second

  // Default port for DTLS connection to Hue Bridge
  defaultDtlsPort: 2100,

  // Timeout for DTLS connection in milliseconds
  dtlsConnectionTimeout: 10000,

  // Enable debug logging
  debug: true
};
