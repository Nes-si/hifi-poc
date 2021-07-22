import Vue from 'vue';
import App from './App.vue';
import VueKonva from 'vue-konva';
import Parse from 'parse';

import 'normalize.css';


Vue.use(VueKonva);

Vue.config.productionTip = false;


Parse.initialize(process.env.VUE_APP_PARSE_SERVER_APP_ID);
Parse.serverURL = process.env.VUE_APP_PARSE_SERVER_URL;


new Vue({
  render: h => h(App),
}).$mount('#app');
