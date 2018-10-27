import Vue from "vue";
import App from "./App.vue";
import router from "./router";
import store from "./store";
import "./registerServiceWorker";

import { CHECK_AUTH } from "@/store/actions.type";
import ApiService from "@/common/api.service";
import DateFilter from "@/common/date.filter";
import ErrorFilter from "@/common/error.filter";
// import Loading from 'vue-loading-overlay';
// // Import stylesheet
// import 'vue-loading-overlay/dist/vue-loading.css';

// // Init plugin
// Vue.use(Loading);

Vue.config.productionTip = false;
Vue.filter("date", DateFilter);
Vue.filter("error", ErrorFilter);

ApiService.init();

// Ensure we checked auth before each page load.
router.beforeEach((to, from, next) => {
  return Promise.all([store.dispatch(CHECK_AUTH)]).then(next);
});

new Vue({
  router,
  store,
  render: h => h(App)
}).$mount("#app");
