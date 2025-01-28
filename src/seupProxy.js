const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    '/auth',
    createProxyMiddleware({
      target: 'http://localhost:5001', // Backend server
      changeOrigin: true,
      logLevel: 'debug', // Enable debugging for troubleshooting
      pathRewrite: {
        '^/auth': '/auth', // Ensure no rewriting issues
      },
      onProxyReq: (proxyReq, req) => {
        console.log('Proxying request:', req.url);
      },
      onProxyRes: (proxyRes, req) => {
        console.log('Received response from backend:', req.url);
      },
    }),
  );
};
