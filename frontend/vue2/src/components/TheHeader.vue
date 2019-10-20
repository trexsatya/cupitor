<template>
  <nav class="navbar navbar-light" style="border-radius: 0;background: #333; padding-right: 0%;">
    <div class="container">
      <router-link class="navbar-brand"
        :to="{ name: 'home' }">
        LivingToLearn
      </router-link>

      <ul class="search-desktop nav navbar-nav"><Search /> </ul>

      <ul class="mobile-ui nav navbar-nav pull-xs-right"> 
        <li class="nav-item"> <img class="search-icon" src="http://icons.iconarchive.com/icons/papirus-team/papirus-apps/256/preferences-system-search-icon.png" v-on:click="showSearchOnMobile()"> </li>
        <li class="nav-item"> 
          <div class="menuToggle" v-on:click="openNav()">
            <div class="bar1"></div>
            <div class="bar2"></div>
            <div class="bar3"></div>
          </div>
        </li>
      
      </ul>

      <ul class="non-mobile-ui nav navbar-nav pull-xs-right">
        <li class="nav-item">
          <router-link class="nav-link"
            active-class="active"
            exact
            :to="{ name: 'aboutme' }">
            About Me
          </router-link>
        </li>
        <li class="nav-item">
          <a class="nav-link" href="https://github.com/trexsatya/cupitor" target="_blank"> Code
          </a>
        </li>
      </ul>

      <ul class="pull-xs-right">
        <div id="mySidenav" class="sidenav">
          <a href="javascript:void(0)" class="closebtn" v-on:click="closeNav()">&times;</a>
          <router-link class="nav-link"
            active-class="active"
            exact
            :to="{ name: 'aboutme' }">
            About Me
          </router-link>
          <a class="nav-link" href="https://github.com/trexsatya/cupitor" target="_blank"> Code
          </a>
        </div>
      </ul>
    </div>
    <div class="search-mobile"> <Search @onSelect="hideSearchOnMobile()"/> </div>
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
    //$(window).resize(e=>{  $('.search-mobile').hide(); })
  },
  methods: {
    showSearchOnMobile(){
      $('.search-mobile').toggle();
      $('input.search').focus();

    },

    hideSearchOnMobile(){
      $('.search-mobile').hide();
    },

    toggle(){
      
    },

    openNav() {
      document.getElementById("mySidenav").style.width = "250px";
    },

    closeNav(){
      document.getElementById("mySidenav").style.width = "0";
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

  .mobile-ui {
    display: none;
  }

  @media only screen and (max-width: 500px) {
    .search-desktop {
      display: none;
    }

    .search-icon {
      display: inline-block;
    }

    .mobile-ui {
      display: block;
    }

    .non-mobile-ui {
      display: none;
    }

    .menuToggle {
       display: inline-block;
       cursor: pointer;
    }

    .bar1, .bar2, .bar3 {
      width: 30px;
      height: 5px;
      background-color: white;
      margin: 6px 0;
      transition: 0.4s;
    }

    .change .bar1 {
      -webkit-transform: rotate(-45deg) translate(-9px, 6px);
      transform: rotate(-45deg) translate(-9px, 6px);
    }

    .change .bar2 {opacity: 0;}

    .change .bar3 {
      -webkit-transform: rotate(45deg) translate(-8px, -8px);
      transform: rotate(45deg) translate(-8px, -8px);
    }
  }

  .sidenav {
    height: 100%;
    width: 0; /* 0 width - change this with JavaScript */
    position: fixed; /* Stay in place */
    z-index: 10000; /* Stay on top */
    top: 0; /* Stay at the top */
    left: 0;
    background-color: #111; /* Black*/
    overflow-x: hidden; /* Disable horizontal scroll */
    padding-top: 60px; /* Place content 60px from the top */
    transition: 0.5s; /* 0.5 second transition effect to slide in the sidenav */
  }

  /* The navigation menu links */
  .sidenav a {
    padding: 8px 8px 8px 32px;
    text-decoration: none;
    font-size: 25px;
    color: #818181;
    display: block;
    transition: 0.3s;
  }

  /* Position and style the close button (top right corner) */
  .sidenav .closebtn {
    position: absolute;
    top: 0;
    right: 25px;
    font-size: 36px;
    margin-left: 50px;
  }

  /* When you mouse over the navigation links, change their color */
  .sidenav a:hover {
    color: #f1f1f1;
  }

  /* On smaller screens, where height is less than 450px, change the style of the sidenav (less padding and a smaller font size) */
  @media screen and (max-height: 450px) {
    .sidenav {padding-top: 15px;}
    .sidenav a {font-size: 18px;}
  }
  .search-icon {
    width: 36px;
    height: 36px;
    margin-left: 10px;
    cursor: pointer;
    border-radius: 100%;
  }
</style>