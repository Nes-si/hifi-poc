var path = require("path");

module.exports = {
  publicPath: process.VUE_CLI_SERVICE.mode == "production" ? "/" : "/",
  configureWebpack: {
    resolve: {
      alias: {
        vue$: "vue/dist/vue.js"
      }
    },
    devtool: 'source-map'
  },
  lintOnSave: true
};
