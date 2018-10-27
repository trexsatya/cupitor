<template>
   <div style="padding-top: 10px;">
       <ArticlesList :subject="subject" />
   </div>
</template>

<script>
import { mapGetters } from "vuex";
import marked from "marked";
import store from "@/store";
import ArticlesList from "@/components/ArticlesList"

export default {
  name: "ltl-articles",
  props: {
    
  },
  components: {
    ArticlesList
  },
/*  beforeRouteEnter(to, from, next) {
    Promise.all([
      store.dispatch(FETCH_ARTICLES, {subject: to.params.slug})
    ]).then(() => {
      next();
    });
  },*/
  computed: {
    subject() { return this.$route.params.slug }
  },
  methods: {
    parseMarkdown(content) {
      return marked(content);
    }
  }
};
</script>

<style>
 @media only screen and (min-width: 1000px) {
    .articles{
        margin-left: 10%;
        margin-right: 15%;
    }
}
<style>