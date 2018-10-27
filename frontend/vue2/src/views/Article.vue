<template>
  <div style="padding-top: 10px;">
    <ArticlePage :articleId="articleId" :key="articleId" />
  </div>
   
</template>

<script>
import { mapGetters } from "vuex";
import marked from "marked";
import store from "@/store";
import Breadcrumb from "@/components/Breadcrumb"
import ArticlePage from "@/components/ArticlePage"
import { FETCH_ARTICLE, FETCH_COMMENTS } from "@/store/actions.type";

export default {
  name: "rwv-article",
  props: {
    id: {
      type: String,
      required: true
    }
  },
  components: {
    ArticlePage
  },
  /*beforeRouteEnter(to, from, next) {
    Promise.all([
      store.dispatch(FETCH_ARTICLE, to.params.id)
      //store.dispatch(FETCH_COMMENTS, to.params.id)
    ]).then(() => {
      next();
    });
  },*/
  computed: {
    articleId(){ return this.$route.params.id; }
  },
  unmounted(){
    console.log('unm') 
  },
  updated(){
      
  },
  methods: {
      
  }
};
</script>

<style>
.article .content {
  font-family: 'gidoleregular';
  font-size: 20px;
    line-height: 28px;
    line-height: 3.2rem;
}

blockquote {
  padding-left: 20px;
    padding-right: 8px;
    border-left-width: 5px;
  font-style: italic;
    font-family: Georgia, Times, "Times New Roman", serif;
    border-style: solid;
    border-color: #ccc;
    border-width: 0 0 0 10;
}

@media only screen and (min-width: 1000px) {
  .article-container {
    padding-left: 10%;
    padding-right: 10%;
    margin-right: 15%;
    margin-left: 5%;
  }
 
}

</style>