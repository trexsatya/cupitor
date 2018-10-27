<template>
  <nav class="navbar navbar-light" style="border-radius: 0;background: #333;">
    <div class="container">
      <router-link class="navbar-brand"
        :to="{ name: 'home' }">
        LivingToLearn
      </router-link>

      <Search />
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
</style>