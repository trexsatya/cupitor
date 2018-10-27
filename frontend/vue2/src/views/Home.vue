<template>
  <div class="home-page">
    <div class="banner" style="background: #333;">
      <div class="container">
        <h1 class="logo-font">Keep Calm And Learn!</h1>
        <p>As much as possible.</p>
      </div>
    </div>
    <div class="container page">
      <div class="row">
       <HomePage />
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import HomePage from "@/components/HomePage";


export default {
  name: "home",
  components: {
    HomePage
  },
  mounted() {
    //this.$store.dispatch(FETCH_TAGS);
  },
  computed: {
    ...mapGetters(["isAuthenticated", "tags"]),
    tag() {
      return this.$route.params.tag;
    }
  }
};
</script>
<style>
  .banner {

  }
</style>