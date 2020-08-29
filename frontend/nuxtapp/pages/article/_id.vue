<template>
<div>
  <div class="article-container">
    <b-spinner style="width: 3rem; height: 3rem;" label="Large Spinner" v-if="!article" type="grow"></b-spinner>

    <div class="article" v-if="article">

      <div class="article-top">

        <h2 class="article-name" style="text-align: center;">{{ article.name }}</h2>

        <!-- <Breadcrumb :items='getBreadcrumbItems(article)' /> -->
        <span style="" class="last-updated">Last Updated: {{ getDateString(article.lastUpdated) }}</span>

        <div class="style">

        </div>
      </div>

      <client-only>
        <div class="content" style="max-width: 100%; overflow: auto;" v-html="article.content" >
        </div>
      </client-only>
      
      
    </div>
  </div>
</div>
</template>

<script>
import { Component, Inject, Model, Prop, Provide, Vue, Watch } from 'nuxt-property-decorator'

import {
  mapGetters,
  mapActions
} from 'vuex';
import {
  transformArticle
} from '@/plugins/utils'


@Component({
  components: { },
  methods: mapActions([
    'fetchArticles',
  ]),
})
export default class ArticleView extends Vue {
  beforeRouteUpdate(to, from, next) {
    console.log(this);
    next();
  }

  article = null;
  isMathjaxLoaded = false

  API_BASE_URL = "https://satyendra.online:8080/api/";
  IMAGES_BASE_URL = "https://storage.googleapis.com/cupitor-220103.appspot.com";

  mounted() {
    // if (process.client) {
      transformArticle(this.$router);
      this.randomCss()
    // }import Vue from 'vue'
import { BootstrapVue, IconsPlugin } from 'bootstrap-vue'
import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-vue/dist/bootstrap-vue.css'
import axios from 'axios';
import "@/assets/scss/custom.scss";
import "@/plugins/now-ui-kit.js";
import clickOutside from '../directives/click-outside.js';


import '@fortawesome/fontawesome-svg-core/styles.css'
import { library } from '@fortawesome/fontawesome-svg-core'
import { fas } from '@fortawesome/free-solid-svg-icons'
import { fab } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

import { dom } from '@fortawesome/fontawesome-svg-core'
import AOS from 'aos';
import 'aos/dist/aos.css'; 

dom.watch() //This is to make <i> tags convert into SVG by font-awesome

library.add(fas)

if (process.client) {
  AOS.init();
  //window.onerror = function (message, file, line, col, error) {
   //alert("Error occurred: " + error.message + " file=" + file);
   //return false;
  //};
}


library.add(fab) //TODO: Import specific icons used in the application, because importing fab,fas will create bundle size larger!

Vue.component('font-awesome-icon', FontAwesomeIcon)
Vue.directive('click-outside', clickOutside);

// Install BootstrapVue
Vue.use(BootstrapVue)
// Optionally install the BootstrapVue icon components plugin
Vue.use(IconsPlugin)


  }

  updated() {
    if (process.client) {
      transformArticle(this.$router);
      this.randomCss()
    }
  }

  relativeToAbsoluteUrl(url) {
    if (!url) return "/img/placeholder.svg";
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return this.IMAGES_BASE_URL + url;
  }

  rafAsync() {
    return new Promise(resolve => {
      requestAnimationFrame(resolve); //faster than set time out
    });
  }

  fetchOnServer = false

  async asyncData ({store, $axios, params}) {
    let article = await $axios.$get('article/' + params.id)
    return {article: article}
  }

  head() {
    // let transformArticle = this.transformArticle;
    return {
        title: this.article ? this.article.name : 'LivingToLearn' ,
        link: [
          {
            rel: 'stylesheet',
            href: 'https://cdn.jsdelivr.net/npm/katex@0.12.0/dist/katex.min.css'
          }
        ],
        script: [
            {
              hid: 'mathjax',
              src: 'https://cdn.jsdelivr.net/npm/katex@0.12.0/dist/katex.min.js',
              defer: true,
              // Changed after script load
              callback: () => { 
                // debugger
                // this.isMathjaxLoaded = true 
                // transformArticle(this.$router);
              } 
            }
        ]
    };
  }

  checkElement(selector) {
    if (document.querySelector(selector) === null) {
      return this.rafAsync().then(() => this.checkElement(selector));
    } else {
      return Promise.resolve(true);
    }
  }

  randomCss() {

    const randomIndex = () => Math.floor(Math.random() * ((Object.keys(this.gradientColors()).length - 1) - 0) + 0);

    const idx = randomIndex();

    this.fixCss(idx);
  }

  fixCss(idx) {

    const bgColors = this.gradientColors();

    const fgColors = {
      0: "white",
      2: "#5b5757",
      5: "#c4b2b2",
      11: "#5e5555"
    }

    let el = document.querySelector('.article-top .style')
    el.innerHTML = `<style>
                div.article-top { ${bgColors[idx]} }
                h2.article-name { color: ${fgColors[idx] || 'white'}; }
                </style>
              `
  }

  getDateString(d) {
    if (!d) return "Jan 01, 2017";
    const ds = new Date(d).toDateString()
    if (ds.split(" ").length > 1) {
      const [mm, dd, yy] = ds.split(" ").slice(1)
      return `${mm} ${dd}, ${yy}`
    }
  }

  gradientColors() {
    /* Copy paste from https://uigradients.com etc. */
    const bgColors = {
      0: `background: #232526;
background: -webkit-linear-gradient(to right, #414345, #232526);
background: linear-gradient(to right, #414345, #232526);
`,
      1: `
                background: #642B73;
                background: -webkit-linear-gradient(to right, #C6426E, #642B73);
                background: linear-gradient(to right, #C6426E, #642B73);
                `,

      2: `background: #36D1DC;
                  background: -webkit-linear-gradient(to right, #5B86E5, #36D1DC);
                  background: linear-gradient(to right, #5B86E5, #36D1DC);
                `,
      3: `background: #CB356B;
                background: -webkit-linear-gradient(to right, #BD3F32, #CB356B);
                background: linear-gradient(to right, #BD3F32, #CB356B);
                `,
      4: `background: #283c86;
                background: -webkit-linear-gradient(to right, #45a247, #283c86);
                background: linear-gradient(to right, #45a247, #283c86);
                `,
      5: `background: #c0392b;
                background: -webkit-linear-gradient(to right, #8e44ad, #c0392b);
                background: linear-gradient(to right, #8e44ad, #c0392b);
                `,
      6: `background: #EB5757;
                background: -webkit-linear-gradient(to right, #000000, #EB5757);
                background: linear-gradient(to right, #000000, #EB5757);
                `,
      7: `background: #C33764;
                background: -webkit-linear-gradient(to right, #1D2671, #C33764);
                background: linear-gradient(to right, #1D2671, #C33764);
                `,
      8: `background: #200122;
                background: -webkit-linear-gradient(to right, #6f0000, #200122);
                background: linear-gradient(to right, #6f0000, #200122);
                `,
      9: `background: #4568DC;
                background: -webkit-linear-gradient(to right, #B06AB3, #4568DC);
                background: linear-gradient(to right, #B06AB3, #4568DC);
                `,
      10: `background: #283048;
background: -webkit-linear-gradient(to right, #859398, #283048);
background: linear-gradient(to right, #859398, #283048);
`,
      11: `background: #DAE2F8;
background: -webkit-linear-gradient(to right, #D6A4A4, #DAE2F8);
background: linear-gradient(to right, #D6A4A4, #DAE2F8);
`,
      12: `background: #7474BF;
background: -webkit-linear-gradient(to right, #348AC7, #7474BF);
background: linear-gradient(to right, #348AC7, #7474BF);
`,
      13: `background: #5f2c82;
background: -webkit-linear-gradient(to right, #49a09d, #5f2c82);
background: linear-gradient(to right, #49a09d, #5f2c82);
`,
      14: `background: #C04848;
background: -webkit-linear-gradient(to right, #480048, #C04848);
background: linear-gradient(to right, #480048, #C04848);
`,
      15: `background: #FC354C;
background: -webkit-linear-gradient(to right, #0ABFBC, #FC354C);
background: linear-gradient(to right, #0ABFBC, #FC354C);
`,
      16: `background: #4b6cb7;
background: -webkit-linear-gradient(to right, #182848, #4b6cb7);
background: linear-gradient(to right, #182848, #4b6cb7);
`,
      17: `background: #1F1C2C;
background: -webkit-linear-gradient(to right, #928DAB, #1F1C2C);
background: linear-gradient(to right, #928DAB, #1F1C2C);
`,
      18: `background: #232526;
background: -webkit-linear-gradient(to right, #414345, #232526);
background: linear-gradient(to right, #414345, #232526);
`,
      19: `background: #16222A;
background: -webkit-linear-gradient(to right, #3A6073, #16222A);
background: linear-gradient(to right, #3A6073, #16222A);
`,
      20: `background: #4b6cb7;
background: -webkit-linear-gradient(to right, #182848, #4b6cb7);
background: linear-gradient(to right, #182848, #4b6cb7);
`,
      21: `background: #C04848;
background: -webkit-linear-gradient(to right, #480048, #C04848);
background: linear-gradient(to right, #480048, #C04848);
`,
      22: `background: #1e130c;
background: -webkit-linear-gradient(to right, #9a8478, #1e130c);
background: linear-gradient(to right, #9a8478, #1e130c);
`,
      23: `background: #360033;
background: -webkit-linear-gradient(to right, #0b8793, #360033);
background: linear-gradient(to right, #0b8793, #360033);
`,
      24: `background: #141E30;
background: -webkit-linear-gradient(to right, #243B55, #141E30);
background: linear-gradient(to right, #243B55, #141E30);
`,
      25: `background: #0f0c29;
background: -webkit-linear-gradient(to right, #24243e, #302b63, #0f0c29);
background: linear-gradient(to right, #24243e, #302b63, #0f0c29);
`,
      26: `background: #485563;
background: -webkit-linear-gradient(to right, #29323c, #485563);
background: linear-gradient(to right, #29323c, #485563);
`,
      27: `background: #333333;
background: -webkit-linear-gradient(to right, #dd1818, #333333);
background: linear-gradient(to right, #dd1818, #333333);
`,
      28: `background: #3C3B3F;
background: -webkit-linear-gradient(to right, #605C3C, #3C3B3F);
background: linear-gradient(to right, #605C3C, #3C3B3F);
`,
      29: `background: #ad5389;
background: -webkit-linear-gradient(to right, #3c1053, #ad5389);
background: linear-gradient(to right, #3c1053, #ad5389);
`,
      30: `background: #ff0084;
background: -webkit-linear-gradient(to right, #33001b, #ff0084);
background: linear-gradient(to right, #33001b, #ff0084);
`

    };

    return bgColors;
  }
}
</script>


<style lang="scss">
.article .content {
  --x-height-multiplier: 0.375;
  --baseline-multiplier: 0.17;
  font-family: 'Raleway', sans-serif;
  font-weight: 400;
  font-style: normal;
  font-size: 1.25em;
  line-height: 1.91;
  letter-spacing: 0.02em;
  color: #483e3e;
  margin-right: 23vw;
  margin-left: 23vw;
}

blockquote {
  font-style: italic;
  font-family: Georgia, Times, "Times New Roman", serif;
  padding: 2px 0;
  border-style: solid;
  border-color: #ccc;
  border-width: 0;
  padding-left: 20px;
  padding-right: 8px;
  border-left-width: 5px;
  margin-left: 28px;

}

.article-container {}

.show-comment-btn,
.hide-comment-btn {
  margin-top: 1%;
  width: 98%;
  margin-left: 1%;
}

.hide-comment-btn {
  display: none;
}

.article-name {
  text-align: center;
  font-size: 50px;
  font-family: "albaregular";
  font-weight: bolder;
  padding-top: 5%;
  padding-bottom: 5%;
  letter-spacing: 4px;
}

.article-container h2 {
  font-family: "Source Sans Pro", sans-serif;
  font-size: 26px;
  font-weight: 800;
  line-height: 100%;
  padding-bottom: 1%;
  color: #7d6d6d;
  margin-top: 2rem;
  margin-right: 5vw;
}

.article-top {
  text-align: center;
}

.comments {
  margin: 2%;
  margin-top: 2%;
}

pre[class*="language-"] {
  margin-bottom: 2rem;
}


@media only screen and (min-width: 1000px) {
  .article-container {
    -webkit-box-shadow: -1px 1px 134px -42px rgb(187, 216, 202);
    -moz-box-shadow: -1px 1px 134px -42px rgb(187, 216, 202);
    box-shadow: -1px 1px 134px -42px rgb(187, 216, 202);
  }

  div.article-top {
    padding-left: 8%;
    padding-right: 8%;
  }

  .comments {
    margin-left: 12%;
    margin-right: 12%;
  }

  .show-comment-btn,
  .hide-comment-btn {
    margin-left: 14%;
    width: 72%;
  }
}

.btn {
  color: #fff;
  background-color: #337ab7;
  border-color: #2e6da4;
}

.last-updated {
  margin-top: 10px;
  color: #514444;
  padding-left: 10px;
  padding-right: 10px;
  margin-left: 2%;
  border-radius: 10px;
  font-size: smaller;
  font-weight: bold;
  margin-right: 10px;
}

h2.article-name {
  text-align: center;
  font-size: 95px;
  font-family: "albaregular", Arial, sans-serif;
  font-weight: bolder;
  padding-top: 1%;
  padding-bottom: 5%;
  letter-spacing: 1px;
  color: #666262;
  line-height: 7rem;
  padding-left: 2px;
  padding-right: 2px;
}

div.article-top {
  padding-top: 5%;
  padding-bottom: 2%;
  margin-bottom: 5%;
}

.math {
  width: 100%;
  overflow-x: auto;
}

@media (max-width: 767px) {
  .article .content {
    font-family: 'Open Sans', sans-serif;
    letter-spacing: -.03em;
    font-size: 19px;
    margin-right: 6vw;
    margin-left: 6vw;
  }

  h2.article-name {
    font-size: 50px;
  }
}

.content,
code {
  text-align: left;
}
</style>
