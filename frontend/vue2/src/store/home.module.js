import { TagsService, ArticlesService } from "@/common/api.service";
import { SEARCH_ARTICLES, FETCH_ARTICLES, FETCH_TAGS } from "./actions.type";
import {
  FETCH_START,
  FETCH_END,
  SET_TAGS,
  UPDATE_ARTICLE_IN_LIST,
  SET_SEARCH_RESULTS
} from "./mutations.type";

const state = {
  tags: [],
  articles: [],
  isLoading: true,
  articlesCount: 0,
  searchResults: []
};

const getters = {
  articlesCount(state) {
    return state.articlesCount;
  },
  articles(state) {
    return state.articles;
  },
  isLoading(state) {
    return state.isLoading;
  },
  tags(state) {
    return state.tags;
  },
  searchResults(state){
    return state.searchResults;
  }
};

const actions = {
  [FETCH_ARTICLES]({ commit }, params) {
    commit(FETCH_START);
    return ArticlesService.query(params)
      .then(({ data }) => {
        commit(FETCH_END, { articles: data });
      })
      .catch(error => {
        throw new Error(error);
      });
  },
  [SEARCH_ARTICLES]({commit}, params) {
      return ArticlesService.search(params.text)
        .then(({ data }) => {
            commit(SET_SEARCH_RESULTS, data)
        })
        .catch(error => {
          throw new Error(error);
        });
  },
  [FETCH_TAGS]({ commit }) {
    return TagsService.get()
      .then(({ data }) => {
        commit(SET_TAGS, data.tags);
      })
      .catch(error => {
        throw new Error(error);
      });
  }
};

/* eslint no-param-reassign: ["error", { "props": false }] */
const mutations = {
  [FETCH_START](state) {
    state.articles = [];
    state.articlesCount = 0;
    state.isLoading = true;
  },
  [FETCH_END](state, { articles, articlesCount }) {
    state.articles = articles;
    state.articlesCount = articlesCount;
    state.isLoading = false;
  },
  [SET_TAGS](state, tags) {
    state.tags = tags;
  },
  [ SET_SEARCH_RESULTS ](state, articles) {
    state.searchResults = articles;
  },
  [UPDATE_ARTICLE_IN_LIST](state, data) {
    state.articles = state.articles.map(article => {
      if (article.slug !== data.slug) {
        return article;
      }
      // We could just return data, but it seems dangerous to
      // mix the results of different api calls, so we
      // protect ourselves by copying the information.
      article.favorited = data.favorited;
      article.favoritesCount = data.favoritesCount;
      return article;
    });
  }
};

export default {
  state,
  getters,
  actions,
  mutations
};
