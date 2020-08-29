import Vuex from 'vuex'

export const state = () => ({
  languages: [],
  searchPage: {
    articles: [],
    searchTerm: ""
  }
})

export const mutations = {
  populateLanguages (state: any, data: any) {
    state.languages = data
  },

  setSearchedArticles(state: any, payload: any) {
    state.searchPage.articles = payload.articles;
    state.searchPage.searchTerm = payload.searchTerm;
  }
}

