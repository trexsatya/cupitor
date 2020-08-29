<template>
<b-container class="top-container" style="margin-top: 2em;">
  <b-spinner style="width: 3rem; height: 3rem;" label="Large Spinner" v-if="!articles" type="grow"></b-spinner>
  <b-card-group deck>

    <b-card class="article-card" overlay :img-src="relativeToAbsoluteUrl(item.img)" style="margin-bottom: 5em;" bg-variant="dark" v-for="(item, index) in articles" :key="index"
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
import { Component, Inject, Model, Prop, Provide, Vue, Watch } from 'nuxt-property-decorator'
import {
  Header
} from '@/components/Header'
import {
  mapGetters,
  mapActions
} from 'vuex';

@Component({
  methods: mapActions([
    'fetchArticles',
  ]),
})
export default class ArticlesView extends Vue {
  beforeRouteUpdate(to, from, next) {
    console.log(this);
    next();
  }

  articles = [];

  API_BASE_URL = "https://satyendra.online/api/";
  IMAGES_BASE_URL = "https://storage.googleapis.com/cupitor-220103.appspot.com";

  onClick(item) {
    console.log(item);
    this.$router.push({
      path: '/article/' + item.id
    })
  }

  async asyncData ({store, $axios, params}) {
    const _try = (toRun, def) => {
      try {
        return toRun();
      } catch (e) {
        return def;
      }
    };

    let articles = await $axios.$get('articles/' + params.subject)
    articles = articles.sort((a, b) => {
          if (a.tags && !b.tags) return -1;
          if (b.tags && !a.tags) return 1;
          if (!a.tags && !b.tags) return 0;


          let priorityA = a.tags.find(t => (t + "").indexOf("prity=") >= 0);
          let priorityB = b.tags.find(t => (t + "").indexOf("prity=") >= 0);
          priorityA = _try(() => priorityA.split("prity=")[1], null);
          priorityB = _try(() => priorityB.split("prity=")[1], null);
          if (priorityA && !priorityB) return -1;
          if (priorityB && !priorityA) return 1;
          if (!priorityA && !priorityB) return 0;

          return parseInt(priorityA) - parseInt(priorityB);

        });

    return {articles: articles}
  }

  mounted() {
    console.log('mounted');

    
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

  head () {
    //We can return title, meta[] for SEO
    return {
       title: this.$route.params.subject.toUpperCase() + ' Articles'
    }
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
.card-title:hover {
  
}
</style>
