
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: true,
  routes: [
  {
    "renderMode": 2,
    "route": "/"
  },
  {
    "renderMode": 2,
    "route": "/levels"
  },
  {
    "renderMode": 1,
    "route": "/dashboard/*"
  },
  {
    "renderMode": 1,
    "route": "/desk-trends/*"
  }
],
  assets: new Map([
['index.csr.html', {size: 718, hash: '7aea70fb94a1624d7149d8c7b1a1784feeb610ba106ba5dae496145ef7a0e38c', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)}], 
['index.server.html', {size: 1027, hash: '8d69fef990d7289882bb557515be4c8a08c8657b3a7d0d204c5a7e8d1e3136ed', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)}], 
['index.html', {size: 3415, hash: '70375d71036067779cfcae055a12e0be6e69453d886c10263c8079a116f7ed6f', text: () => import('./assets-chunks/index_html.mjs').then(m => m.default)}], 
['levels/index.html', {size: 1754, hash: '5eb2025d8b79f16941eb80dea89b32d8655d7ed524dc62f0bdd82f09281074b1', text: () => import('./assets-chunks/levels_index_html.mjs').then(m => m.default)}], 
['styles-6TGMMH3I.css', {size: 79, hash: 'C3Z/3E7qhxk', text: () => import('./assets-chunks/styles-6TGMMH3I_css.mjs').then(m => m.default)}]
]),
  locale: undefined,
};
