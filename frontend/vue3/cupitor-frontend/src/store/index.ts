import Vue from 'vue';
import Vuex from 'vuex';

Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    searchPage: {
      articles: [],
      searchTerm: ""
    }
  },

  getters: {

  },

  mutations: {
    setSearchedArticles(state, payload) {
      state.searchPage.articles = payload.articles;
      state.searchPage.searchTerm = payload.searchTerm;
    }
  },

  actions: {

  },

  modules: {
  },
});
