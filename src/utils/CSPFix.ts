/**
 * This script forcefully overrides Content Security Policy to allow unsafe-eval
 * Call this early in your application startup
 */

export function fixCSPForDTLS() {
  console.log("🔧 Applying CSP fix for DTLS functionality...");

  try {
    // First approach: Try to remove any existing CSP meta tags
    const existingMetaTags = document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]');
    existingMetaTags.forEach(tag => tag.remove());
    console.log(`Removed ${existingMetaTags.length} existing CSP meta tags`);

    // Second approach: Add our own meta tag with permissive CSP
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://sdk.scdn.co; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.spotify.com wss://*.spotify.com https://api.spotify.com; img-src 'self' data: https://*.scdn.co";
    document.head.appendChild(meta);
    console.log("Added custom CSP meta tag with unsafe-eval");

    // Third approach: Override the CSP via JavaScript
    // This tries to override any CSP set by the server
    document.addEventListener('securitypolicyviolation', (e) => {
      console.warn('CSP violation detected:', e.violatedDirective, e.blockedURI);
    });

    return true;
  } catch (error) {
    console.error("Failed to fix CSP:", error);
    return false;
  }
}

// Alternative approach: Load scripts via blob URLs
export function createEvalFunction(code: string): Function {
  try {
    // Create a blob URL from the code
    const blob = new Blob([`(function() { return ${code} })()`], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);

    // Create a script element and load the blob URL
    const script = document.createElement('script');
    script.src = url;

    // Use a promise to wait for script load
    return new Promise((resolve, reject) => {
      script.onload = () => {
        // Clean up
        URL.revokeObjectURL(url);
        document.head.removeChild(script);
        resolve(window._evalResult);
      };
      script.onerror = () => {
        URL.revokeObjectURL(url);
        document.head.removeChild(script);
        reject(new Error('Failed to execute code via blob URL'));
      };

      // Add to document to execute
      document.head.appendChild(script);
    });
  } catch (error) {
    console.error("Failed to create eval function:", error);
    throw error;
  }
}
