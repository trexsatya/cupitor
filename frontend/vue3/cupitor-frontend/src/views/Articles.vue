<template>
<b-container class="top-container articles-list" ref="container">
  <b-spinner style="width: 3rem; height: 3rem;" label="Large Spinner" v-if="!articles" type="grow"></b-spinner>
  <b-card-group deck>

    <!-- <b-card class="article-card circle" overlay :img-src="relativeToAbsoluteUrl(item.img)" style="margin-bottom: 5em;" bg-variant="dark" v-for="(item, index) in articles" :key="index"
      text-variant="white" :title="item.name" sub-title="-" v-on:click="onClick(item)" img-top>
      <b-card-text class="summary">
        {{item.summary}}
      </b-card-text>
      <template v-slot:footer>
        <small class="text-muted">{{ item.summary ?  'Last updated on ' + getDateString(item.lastUpdated) : 'Under construction!'}}</small>
      </template>
    </b-card> -->

    <div id="hex1" class="octagon-wrapper" v-for="(item, index) in articles" :key="index" style="text-align: center;" :ref="'octagon'">

        <div id="color1" class="octagon" v-on:click="onClick(item)">
          <span class="article-name">{{item.name}}</span>
          <span class="sub-title">{{ item.lastUpdated ? getDateString(item.lastUpdated): 'not ready'}}</span>
          <!-- <svg viewBox="0 0 500 500">
            <path id="curve" d="M73.2,148.6c4-6.1,65.5-96.8,178.6-95.6c111.3,1.2,170.8,90.3,175.1,97" />
            <text width="500">
              <textPath xlink:href="#curve">
                {{item.name}}
              </textPath>
            </text>
          </svg> -->
        </div>
    </div>

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

    const _try = (toRun, def) => {
      try {
        return toRun();
      } catch (e) {
        return def;
      }
    };

    fetch(this.API_BASE_URL + 'articles/' + this.$route.params.subject)
      .then((res) => res.json())
      .then((articles) => {
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
        this.articles = articles;
      });

      this.applyRandomTheme()
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

  updated() {
    this.applyRandomTheme()
  }

  applyRandomTheme() {
    function contrastingColor(color, lighter){
          return (luma(color) >= 165) ? (lighter ? '#000': '#000') : (lighter ? '#fff': '#fff');
    }

    function luma(color) { // color can be a hx string or an array of RGB values 0-255
        var rgb = (typeof color === 'string') ? hexToRGBArray(color) : color;
        return (0.2126 * rgb[0]) + (0.7152 * rgb[1]) + (0.0722 * rgb[2]); // SMPTE C, Rec. 709 weightings
    }

    function hexToRGBArray(color){
        // if (color.length === 3)
        //     color = color.charAt(0) + color.charAt(0) + color.charAt(1) + color.charAt(1) + color.charAt(2) + color.charAt(2);
        // else if (color.length !== 6)
        //     throw('Invalid hex color: ' + color);
        // var rgb = [];
        // for (var i = 0; i <= 2; i++)
        //     rgb[i] = parseInt(color.substr(i * 2, 2), 16);
        // return rgb;

        return color
    }

    function random_rgba() {
        var o = Math.round, r = Math.random, s = 255;

        let ar = [o(r()*s), o(r()*s), o(r()*s)]
        return {
          array: ar,
          code: `rgba(${ar.join(",")},1)`
        };
    }

    function adjustMargin(component) {
      try {
        var numOfOctasInRow = 3;
        //@ts-ignore
        if(window.outerWidth < 980) {
          numOfOctasInRow = 2;
        }
        //@ts-ignore
        if(window.outerWidth < 770) {
          numOfOctasInRow = 1;
        }
        //@ts-ignore
        component.$refs.container.style["margin-left"] = `${Math.max(0, (window.outerWidth - numOfOctasInRow*310)/2)}px`;
        component.$refs.container.style["padding-left"] = 0;
      } catch(e) {
        console.log(e)
      }
    }

    adjustMargin(this);
    //@ts-ignore
    window.onresize = function(e) { adjustMargin(this) }.bind(this)

    this.$refs.octagon?.forEach(oct => {
      let cntnr = oct.firstChild
      let name = oct.firstChild.firstChild
      let sub = oct.firstChild.children[1]
      let bg = random_rgba()
      cntnr.style["background-color"] = bg.code;
      name.style["color"] = contrastingColor(bg.array);
      sub.style["color"] = contrastingColor(bg.array, true);
      name.style["transform"] = "rotate(-45deg)"
    });

    // debugger
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

.circle {
  width: 500px;
  height: 500px;
  line-height: 500px;
  border-radius: 50%;
  font-size: 50px;
  color: #fff;
  text-align: center;
  background: #000
}

#hex1 {
  width: 300px;
  height: 300px;
}

#color1 {
  background-color: #39D;
}


.hexagon-wrapper {
  text-align: center;
  margin: 20px;
  position: relative;
  display: inline-block;
}

.hexagon {
  height: 100%;
  width: calc(100% * 0.57735);
  display: inline-block;
}

.hexagon:before {
  position: absolute;
  top: 0;
  right: calc((100% / 2) - ((100% * 0.57735) / 2));
  background-color: inherit;
  height: inherit;
  width: inherit;
  content: '';
  transform: rotateZ(60deg);
}

.hexagon:after {
  position: absolute;
  top: 0;
  right: calc((100% / 2) - ((100% * 0.57735) / 2));
  background-color: inherit;
  height: inherit;
  width: inherit;
  content: '';
  transform: rotateZ(-60deg);
}


.octagon-wrapper {
    width:200px;
    height:200px;
    float: left;
    position: relative;
    overflow: hidden;
    margin-bottom: 10px;
    margin-right: 10px;
}
.octagon {
    cursor: pointer;
    position: absolute;
    top: 0; right: 0; bottom: 0; left: 0;
    overflow: hidden;
    transform: rotate(45deg);
    background: #777;
    border: 2px solid grey;
    -webkit-transition: all 0.6s cubic-bezier(0.165, 0.84, 0.44, 1);
    transition: all 0.6s cubic-bezier(0.165, 0.84, 0.44, 1);
}

.octagon:hover {
  -webkit-transform: scale(1.05, 1.05);
    transform: scale(1.05, 1.05);
}

.octagon:hover + .sub-title {
  display: inline-block;
}

.octagon:before {
    position: absolute;
    /* There needs to be a negative value here to cancel
     * out the width of the border. It's currently -3px,
     * but if the border were 5px, then it'd be -5px.
     */
    top: -3px; right: -3px; bottom: -3px; left: -3px;
    transform: rotate(45deg);
    content: '';
    border: inherit;
}

.octagon .article-name {
  font-size: larger;
  font-weight: bolder;
  display: inline-block;
  margin-top: 40%;
}

.octagon .sub-title {
  font-size: smaller;
  transform: rotate(-45deg);
  display: none;
}
</style>
