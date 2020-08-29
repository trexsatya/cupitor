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