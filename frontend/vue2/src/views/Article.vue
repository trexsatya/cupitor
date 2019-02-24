<template>
  <div style="padding-top: 10px;padding-top: 3%; padding-bottom: 3%;">
    <ArticlePage :articleId="articleId" :key="articleId" />

    <div class="btn show-comment-btn" v-on:click="showComments()">Show Comments</div>
    <div class="btn hide-comment-btn" v-on:click="hideComments()">Hide Comments</div>
    <div class="comments">
      <vue-disqus shortname="livintolearn" :identifier="articleId" :url="url"></vue-disqus>
    </div>
    
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
    articleId(){ return this.$route.params.id; },
    url(){ return "http://cupitor.online/article/"+this.$route.params.id ; }
  },
  unmounted(){
    console.log('unm') 
  },
  updated(){
      
  },
  methods: {
      showComments(){
        $('.comments').show();
        $('.show-comment-btn').hide()
        $('.hide-comment-btn').show();
      },
      hideComments(){
        $('.comments').hide();
        $('.show-comment-btn').show()
        $('.hide-comment-btn').hide();
      },
  }
};
</script>

<style>

.article .content {
      --x-height-multiplier: 0.375;
      --baseline-multiplier: 0.17;
      font-family: 'Raleway', sans-serif;
      font-weight: 400;
      font-style: normal;
      font-size: 19px;
      line-height: 1.8;
      letter-spacing: 0.02rem;
      color: #5f4b4b;
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

.article-container {
    padding-left: 2%;
    padding-right: 2%;
    padding-top: 10px;
    

}

.show-comment-btn, .hide-comment-btn {
  margin-top: 1%;
  width: 98%;
  margin-left: 1%;
}

.hide-comment-btn {
  display: none;
}

.article-container h2{
	  font-family: "Source Sans Pro", sans-serif;
    font-size: 26px;
    font-weight: 800;
    line-height: 100%;
    padding-bottom: 1%;
    color: #404ceb;
}

.comments {
  margin: 2%;
  margin-top: 2%;
  display: none;
}

@media (max-width: 767px) {
  .article .content {
    font-family: 'Padauk', sans-serif;
    letter-spacing: .01rem;
    font-size: 20px;
  }
}

@media only screen and (min-width: 1000px) {
  .article-container {
    padding-left: 5%;
    padding-right: 8%;
    margin-right: 15%;
    margin-left: 15%;
    -webkit-box-shadow: -1px 1px 134px -42px rgb(187, 216, 202);
    -moz-box-shadow: -1px 1px 134px -42px rgb(187, 216, 202);
    box-shadow: -1px 1px 134px -42px rgb(187, 216, 202);
  }

  .comments {
    margin-left: 12%;
    margin-right: 12%;
  }
 
  .show-comment-btn, .hide-comment-btn {
    margin-left: 14%;
    width: 72%;
  }
}

 .btn {
   color: #fff;
    background-color: #337ab7;
    border-color: #2e6da4;
 }

</style>
