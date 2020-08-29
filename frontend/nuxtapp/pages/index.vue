<template>
<div class="home" style="margin-top: 2em;">
  <div class="img-container" ref="imgContainer">
    <img class="bg" src="https://images.pexels.com/photos/132037/pexels-photo-132037.jpeg" >
  </div>
  <div class="upper-container">
    <b-row class="header">
          <b-col style="" class="search-box-col">
            <div class="search-icon" ref="searchIcon"> <i class="fa fa-search" style="margin-top: 35%; margin-left: 28%;"></i> </div>
            <multiselect
              class="search-box-in-nav left"
              ref="searchBox"
              id="ajax"
              label="name"
              track-by="code"
              placeholder="Type to search" open-direction="bottom"
              :options="searchResult"
              :multiple="true"
              :searchable="true"
              :loading="isLoading"
              :internal-search="false"
              :clear-on-select="true"
              :close-on-select="true"
              :options-limit="300"
              selectLabel="Select"
              :limit="3"
              :max-height="600"
              :show-no-results="false"
              :hide-selected="true"
              group-values="results"
              group-label="entity"
              :group-select="false"
              @select="searchResultSelected"
              @search-change="asyncFind">
              <template slot="tag"
                slot-scope="{ option }">
                <span class="custom__tag">
                  <span>{{ option.name }}</span>
                  <!-- <span class="custom__remove" @click="remove(option)">❌</span> -->
                </span>
              </template>
              <template slot="clear" slot-scope="props">
                <div class="multiselect__clear" v-if="selectedsearchResult.length" @mousedown.prevent.stop="clearAll(props.search)"></div>
              </template>
              <!-- <template slot="singleLabel" slot-scope="props">
                <img class="option__image" :src="props.option.img" alt="No Man’s Sky">
                <span class="option__desc">
                  <span class="option__title">{{ props.option.name }}</span>
                </span>
              </template> -->
              <template slot="option" slot-scope="props">
                <!-- <img class="option__image" :src="props.option.img" alt="No Man’s Sky"> -->
                <div class="option__desc">
                  <span class="option__title" v-if="!props.option.fullSearchLink">{{ searchItemLabel(props) }}</span>

                  <span class="option__title" v-else><a href="/search" style="color: black">Users with name {{props.option.username}}</a></span>
                  <!-- <span class="option__small">{{ 'desc' }}</span> -->
                </div>
              </template>
              <!-- <span slot="noResult">Oops! No elements found. Consider changing the search query.</span> -->
            </multiselect>
          </b-col>
          <b-col cols="8" style="text-align: left;" class="logo-col">
            <span class="logo">Living to Learn </span>
          </b-col>
    </b-row>
    <div class="divider"></div>
    <b-container ref="cardsContainer">
      <b-card-group columns>
        <b-card no-body
          header="Computer Engineering"
        >
          <b-card-body>
            <b-list-group flush>
              <b-list-group-item > <router-link to="/articles/programming"> Programming </router-link> </b-list-group-item>
              <b-list-group-item ><router-link to="/articles/algos"> Algorithms & Problem-Solving </router-link></b-list-group-item>
              <b-list-group-item ><router-link to="/articles/devops"> DevOps </router-link></b-list-group-item>
              <b-list-group-item > <router-link to="/articles/ai"> Artificial Intelligence </router-link></b-list-group-item>
              <b-list-group-item > <router-link to="/articles/architecture"> Design & Architecture </router-link></b-list-group-item>
            </b-list-group>
          </b-card-body>
        </b-card>

        <b-card header="Science" no-body>
          <b-card-body>
            <b-list-group flush>
              <b-list-group-item > <router-link to="/articles/life-science"> "Science" of Life </router-link> </b-list-group-item>
              <b-list-group-item > <router-link to="/articles/psychology"> "Science" of Psyche </router-link></b-list-group-item>
              <b-list-group-item > <router-link to="/articles/natural-science"> Science of Matter </router-link></b-list-group-item>
            </b-list-group>
          </b-card-body>
        </b-card>


        <b-card bg-variant="primary" text-variant="white" style="background-color: rgb(0 123 255 / 0.2) !important;">
          <blockquote class="card-blockquote">
            <p>Life is a journey, without any destination.
            <br>To make sense of it is my little ambition.
            </p>
            <footer>
              <small>Anonymous</small>
            </footer>
          </blockquote>
        </b-card>

        <b-card no-body header="Philosophy">
          <b-card-body>
            <b-list-group flush>
              <b-list-group-item > <router-link to="/articles/philosophy"> Miscelleneous </router-link> </b-list-group-item>
            </b-list-group>
          </b-card-body>
        </b-card>

      </b-card-group>
    </b-container>
  </div>

</div>
</template>

<script lang="ts">
import Vue from 'vue'


import Multiselect from 'vue-multiselect'
import { Component, Prop } from 'vue-property-decorator'
import "vue-multiselect/dist/vue-multiselect.min.css";


@Component({
  components: {
    Multiselect
  }
})
export default class MainNavbar extends Vue {
  selected: string = ''
  options: Array<string> = []
  toggleSearchBar = true
  selectedsearchResult: Array<any> = []
  searchResult: Array<any> = []
  isLoading = false

  showingModalFor: string = "Login"
  @Prop() transparent?: boolean
  @Prop() colorOnScroll?: number

  @Prop({default: 'white'}) type? : string

  asyncFind (query: string) {

    if(!query) return;

    this.isLoading = true

    //debugger

    // @ts-ignore
    fetch('https://satyendra.online/api/search/' + query)
    .then(x => x.json())
    .then(resp => {
        let apiRes = resp.map((it: any) => ({ name: it.name, id: it.id }))
        this.searchResult = [
          {
            entity: 'articles',
            results: apiRes
          }
        ];

        this.isLoading = false
      })
    .catch(e => {
        this.isLoading = false
    })

  }

  searchItemLabel(props: any) {
    if(props.option.$groupLabel) {
     return props.option.$groupLabel
    }

    return props.option.name
  }

  clearAll () {
    this.selectedsearchResult = []
  }

  mounted() {
    try {
      //@ts-ignore
      this.$refs.searchBox.$refs.search.setAttribute("autocomplete", "off")
      //@ts-ignore
      this.$refs.searchBox.$refs.tags.style.borderRadius = 0

      let searchBox = this.$refs.searchBox;
      let showSearchBox = () => {
        //@ts-ignore
        let existing = searchBox.$el.style.visibility;
        //@ts-ignore
        searchBox.$el.style.visibility = (existing != 'visible' ? 'visible' : 'hidden');
      }

      //@ts-ignore
      this.$refs.searchIcon.onclick = showSearchBox;

      // @ts-ignore
      let imgCont = this.$refs.imgContainer

      // @ts-ignore
      this.$refs.cardsContainer.onmouseover = () => {
        // @ts-ignore
        imgCont.classList.add("more-visible")
      };

      // @ts-ignore
      this.$refs.cardsContainer.onmouseout = () => {
        // @ts-ignore
        imgCont.classList.remove("more-visible")
      };      


    } catch(e) {
      console.log(e)
    }
  }

  async signOut() {
    // @ts-ignore
    this.$auth.logout()
  }

  isLoggedIn(){
    // @ts-ignore
    return this.$auth.loggedIn
  }

  userName() {
    // @ts-ignore
    return this.$auth.user.username
  }

  signinClicked() {
    this.$bvModal.hide('signup-modal');
    this.$bvModal.show('signin-modal')
  }

  profileLink() {
    // @ts-ignore
    return '/users/' + this.$auth.user.username
  }

  searchResultSelected(item: any){
      this.$router.push("/article/" + item.id )
  }

  searchIconClicked() {

  }
}

</script>

<style scoped>


.multiselect {
    position: absolute;
    width: 50%;
    height: 40px;
    display: inline-block;
    visibility: hidden;
}

.multiselect .multiselect__tags {
  max-height: 100% !important;
  border-radius: 0 !important;
}

.search-icon {
  display: inline-block;
  width: 40px;
  height: 45px;
  background: black;
  color: white;
  cursor: pointer;
}

.search-icon:hover {

}

.card, .list-group-item {
  background: none;
  color: white;
  text-align: left;
}

.card {
  border: none;
}

.list-group-item a {
  color: #fedbdb;
}

.list-group-item {
  padding-left: 0;
}

.card-header {
  font-size: larger;
  color: aliceblue;
  font-weight: bold;
}

img.bg {
  width: 100%;
  height: 100%;
  position: fixed;
  top: 0;
  left: 0;
}

.upper-container {
  z-index: 2;
  margin-top: -5em;
}

.img-container::after {
  content: '-';
  background: red;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0.5;
}

.img-container.more-visible::after {
  opacity: 0.9;
  transition: 1s;
}

.header {
  margin-bottom: 5em;
}

.prefix {
  margin: 2vw;
  color: blue;
  font-size: 5vw;
  font-family: myFirstFont;
}

.logo {
  font-family: myFirstFont;
  font-size: 5vw;
  font-weight: 900;
  color: #fadfdf;
}

.subject {
  font-size: 8vw;
  font-weight: bold;

}

.header-minor {
  font-weight: bolder;
  font-size: 1rem;
}

.tablist {
  width: 60vw;
  margin: auto;
}

.search-box-col {
  padding-top: 2em; 
  text-align: left; 
  padding-left: 8em;
}


.divider {
    background: radial-gradient(circle, #1e24d6 0%, #0f151b 100%);
    height: 3px;
}

@media (max-width: 767px) {
  .tablist {
    width: 80vw;
    margin: auto;
  }

  .logo-col {
    margin-top: -2.5em;
    margin-left: 35%;
    z-index: 1;
  }

  .search-box-col {
    padding-left: 5em;
    z-index: 2;
  }
}
</style>
