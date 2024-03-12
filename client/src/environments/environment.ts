declare function require(moduleName: string): any;
export const environment = {
  version: require('../../package.json').version,
  production: false,
  apiEndpoint: "http://192.168.100.60:1881",
  apiPort: 1881,
  serverEnabled: true,
  type: null
};
