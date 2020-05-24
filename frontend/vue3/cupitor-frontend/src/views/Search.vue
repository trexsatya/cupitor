<template>
<b-container class="top-container">
  <b-row class="search-container">
    <input id="searchText" class="form-control" type="text" :value="searchTerm" placeholder="Search (at least 3 letters)" aria-label="Search" v-on:keyup="fetchArticles()" />
  </b-row>
  <b-row class="">
    <b-spinner style="width: 3rem; height: 3rem;" label="Large Spinner" v-if="searching" type="grow"></b-spinner>
  </b-row>

  <div v-if="!articles">
    No articles found! Try some other search text.
  </div>
  <b-card-group deck>

    <b-card class="article-card" :to="{name: 'ArticleEdit', params: {id: item.id}}" action overlay :img-src="relativeToAbsoluteUrl(item.img)" style="margin-bottom: 5em;" bg-variant="dark" v-for="(item, index) in articles" :key="index"
      text-variant="white" :title="item.name" sub-title="-" v-on:click="onClick(item)" img-top>
      <b-card-text class="summary">
        {{item.summary}}
      </b-card-text>
      <template v-slot:footer>
        <small class="text-muted">{{ item.summary ?  'Last updated on ' + getDateString(item.lastUpdated) : 'Under construction!'}}</small>
      </template>
    </b-card>


  </b-card-group>
</b-container>
</template>

<script>
// @ is an alias to /src
import {
  Component,
  Prop,
  Vue,
} from 'vue-property-decorator';
import {
  mapGetters,
  mapActions
} from 'vuex';

@Component({
  methods: mapActions([]),
})
export default class SearchArticlesView extends Vue {
  beforeRouteUpdate(to, from, next) {
    console.log(this);
    next();
  }

  searched = false;
  searching = false;
  articles = [];
  searchTerm = null;

  API_BASE_URL = window.API_URL;
  IMAGES_BASE_URL = window.imageCdnUrl;

  onClick(item) {
    console.log(item);
    this.$router.push({
      path: '/article/' + item.id
    })
  }

  mounted() {
    console.log('mounted');
    this.articles = this.$store.state.searchPage.articles;
    this.searchTerm = this.$store.state.searchPage.searchTerm;
  }

  fetchArticles() {
    const el = document.getElementById("searchText");
    this.searching = true;
    this.searchTerm = el.value;

    this.searched = true;
    if (!el.value || el.value.trim().length == 0) {
      this.articles = [];
      this.searching = false;
      this.$store.commit("setSearchedArticles", {
        articles: [],
        searchTerm: ""
      });
    }

    if (el.value.length < 3) {
      this.searching = false;
      return;
    }

    console.log(el.value);
    fetch(this.API_BASE_URL + 'search/' + el.value)
      .then((res) => res.json())
      .then((articles) => {
        this.articles = articles;
        this.searching = false;
        this.$store.commit("setSearchedArticles", {
          articles: articles,
          searchTerm: el.value
        });
      }).catch((e) => {
        this.searching = false;
      });
  }

  getDateString(d) {
    if (!d) return "Jan 01, 2017";
    const ds = new Date(d).toDateString()
    if (ds.split(" ").length > 1) {
      const [mm, dd, yy] = ds.split(" ").slice(1)
      return `${mm} ${dd}, ${yy}`
    }
  }

  relativeToAbsoluteUrl(url) {
    if (!url) return "/img/placeholder.svg";
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return this.IMAGES_BASE_URL + url;
  }
}
</script>

<style lang="scss">
.article-card {
    max-height: 20rem;
    min-width: 30%;
    margin-bottom: 2em;
    max-width: 400px;
    cursor: pointer;
}

.summary {
    display: none;
}

.article-card:hover + .summary {
    display: block;
}

.card-img-top {
    max-height: 20rem;
    min-height: 5rem;
    height: 100%;
}

.article-card::after {
    content: "";
    border-radius: 5px;
    position: absolute;
    z-index: -1;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
    opacity: 0;
    -webkit-transition: all 0.6s cubic-bezier(0.165, 0.84, 0.44, 1);
    transition: all 0.6s cubic-bezier(0.165, 0.84, 0.44, 1);
}

.article-card:hover {
    -webkit-transform: scale(1.05, 1.05);
    transform: scale(1.05, 1.05);
}

.article-card:hover::after {
    opacity: 1;
    z-index: 1000;
}

.search-container {
    margin: 5vw;
}
</style>
