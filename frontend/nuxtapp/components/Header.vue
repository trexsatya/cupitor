<template>
  <b-navbar toggleable="lg" type="dark" variant="info">
    <b-navbar-brand href="/">LivingToLearn</b-navbar-brand>

    <b-navbar-toggle target="nav-collapse"></b-navbar-toggle>

    <b-collapse id="nav-collapse" is-nav>
      <b-navbar-nav>
        <!-- <b-nav-item href="#">Link</b-nav-item> -->
      </b-navbar-nav>

      <!-- Right aligned nav items -->
      <b-navbar-nav class="ml-auto">

        <b-navbar-nav style="width: 15em;">
          
          <b-nav-item href="/search">Search</b-nav-item>
            
          <b-nav-item href="/about">About</b-nav-item>
        </b-navbar-nav>

        
      </b-navbar-nav>
    </b-collapse>
  </b-navbar>
</template>

<script lang="ts">
import Vue from 'vue'

import Multiselect from 'vue-multiselect'
import { Component, Prop } from 'nuxt-property-decorator'
import "vue-multiselect/dist/vue-multiselect.min.css";


@Component({
  components: {
    Multiselect
  }
})
export default class Header extends Vue {
  selected: string = ''
  options: Array<string> = []
  toggleSearchBar = true
  selectedsearchResult = []
  searchResult = []
  isLoading = false

  showingModalFor: string = "Login"
  @Prop() transparent?: boolean
  @Prop() colorOnScroll?: number

  @Prop({default: 'white'}) type? : string

  asyncFind (query) {

    if(!query) return;

    this.isLoading = true

    //debugger

    // @ts-ignore
    fetch('http://satyendra.online:8080/api/search/' + query)
    .then(x => x.json())
    .then(resp => {
        let apiRes = resp.map(it => ({ name: it.name, id: it.id }))
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

  searchItemLabel(props) {
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

  searchResultSelected(item){
      this.$router.push("/article/" + item.id )
  }

  searchIconClicked() {

  }
}
</script>

<style lang="scss">
.nav-item  {
  width: 100%;
}

.multiselect {
    position: absolute;
    max-width: 15em !important;
    height: 40px;
    display: inline-block;
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

</style>