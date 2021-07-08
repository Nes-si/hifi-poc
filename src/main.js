import Vue from 'vue';
import App from './App.vue';
import VueKonva from 'vue-konva';
import Parse from 'parse';

import 'normalize.css';

Vue.use(VueKonva);

Vue.config.productionTip = false


Parse.initialize('5ed72354cfdada53571121136ae1be7b');
Parse.serverURL = 'https://master.parse-server-524115.c66.me:40088/parse';


new Vue({
  render: h => h(App),
}).$mount('#app')
