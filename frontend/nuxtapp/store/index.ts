import Vuex from 'vuex'

export const state = () => ({
  languages: [],
  searchPage: {
    articles: [],
    searchTerm: ""
  }
})

export const mutations = {
  populateLanguages (state, data) {
    state.languages = data
  },

  setSearchedArticles(state, payload) {
    state.searchPage.articles = payload.articles;
    state.searchPage.searchTerm = payload.searchTerm;
  }
}

