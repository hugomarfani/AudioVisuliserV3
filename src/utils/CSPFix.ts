/**
 * Utility to fix Content Security Policy issues for DTLS connections
 */

export function fixCSPForDTLS() {
  console.log("Applying CSP fix for DTLS connections");

  // In a production environment, this would add the necessary CSP headers
  // But for our development environment, we'll just log that it was called

  try {
    // Check if we're in a browser environment
    if (typeof document !== 'undefined') {
      // For development, we can try to modify CSP directly
      const meta = document.createElement('meta');
      meta.httpEquiv = 'Content-Security-Policy';
      meta.content = "default-src * 'unsafe-inline' 'unsafe-eval'; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src * 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; frame-src *; style-src * 'unsafe-inline';";
      document.head.appendChild(meta);
      console.log("Added permissive CSP meta tag");
    }
  } catch (e) {
    console.warn("Could not modify CSP in browser:", e);
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
