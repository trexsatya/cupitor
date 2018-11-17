<template>
  <nav class="navbar navbar-light" style="border-radius: 0;background: #333;">
    <div class="container">
      <router-link class="navbar-brand"
        :to="{ name: 'home' }">
        LivingToLearn
      </router-link>

      <ul class="search-desktop nav navbar-nav"><Search /> </ul>

      <ul class="nav navbar-nav pull-xs-right"> <div class="search-icon" v-on:click="showSearchOnMobile()"/></ul>

      <ul v-if="!isAuthenticated" class="nav navbar-nav pull-xs-right">
        <li class="nav-item">
          <router-link class="nav-link"
            active-class="active"
            exact
            :to="{ name: 'home' }">
            Home
          </router-link>
        </li>
      </ul>

      <ul v-else class="nav navbar-nav pull-xs-right">
        <li class="nav-item">
          <router-link
            class="nav-link"
            active-class="active"
            exact
            :to="{ name: 'home' }">
            Home
          </router-link>
        </li>
      </ul>
    </div>
    <div class="search-mobile"> <Search @selected="hideSearchOnMobile()"/> </div>
  </nav>
</template>

<script>
import { mapGetters } from "vuex";
import Search  from '@/components/Search'

export default {
  name: "RwvHeader",
  components: {
    Search
  },
  computed: {
    ...mapGetters(["currentUser", "isAuthenticated"])
  },
  mounted() {
    $(window).resize(e=>{  $('.search-mobile').hide(); })
  },
  methods: {
    showSearchOnMobile(){
      $('.search-mobile').toggle();
    },
    hideSearchOnMobile(){
      $('.search-mobile').hide();
    }
  }
};
</script>

<style>
  .navbar-light .navbar-nav .nav-link.active {
    color: green;
  }

  .navbar-light .navbar-nav .nav-link{
    color: white;
  }

  .search-desktop {
    display: inline;
    width: 30%;
    margin-left: 15%;
  }

  @media only screen and (min-width: 501px) {
    .search-mobile {
      display: none;
    }
    .search-icon {
      display: none;
    }
  }

  .search-mobile {
      display: none;
  }

  @media only screen and (max-width: 500px) {
    .search-desktop {
      display: none;
    }
    .search-icon {
      display: inline-block;
    }
  }

  .search-icon {
    background: rgba(237, 237, 237, 0.4) url(https://static.tumblr.com/ftv85bp/MIXmud4tx/search-icon.png) no-repeat 9px center;
    width: 36px;
    height: 36px;
    margin-left: 10px;
    cursor: pointer;
    border-radius: 100%;
  }
</style>