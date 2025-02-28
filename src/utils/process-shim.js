// Simple process shim for browser environments
window.process = window.process || {
  env: {},
  browser: true,
  version: '',
  nextTick: (fn) => setTimeout(fn, 0)
};

export default window.process;
