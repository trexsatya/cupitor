<template>
  <div style="padding-top: 10px;padding-top: 3%; padding-bottom: 3%;background-color: #424950;">
    <ArticlePage :articleId="articleId" :key="articleId" />

    <span class="btn show-comment-btn" v-on:click="showComments()">Show Comments</span>
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
        $('.comments').toggle('slide');
      }
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
.article-container {
    padding-left: 2%;
    padding-right: 2%;
    padding-top: 10px;
    

}

.show-comment-btn {
  margin-top: 1%;
  width: 98%;
  margin-left: 1%;
}

.comments {
  margin: 2%;
  margin-top: 2%;
  display: none;
}

@media only screen and (min-width: 1000px) {
  .article-container {
    padding-left: 8%;
    padding-right: 8%;
    margin-right: 15%;
    margin-left: 15%;

    -webkit-box-shadow: -11px -11px 0px 0px rgba(15,209,115,1);
    -moz-box-shadow: -11px -11px 0px 0px rgba(15,209,115,1);
    box-shadow: -11px -11px 0px 0px rgba(15,209,115,1);
  }

  .comments {
    margin-left: 12%;
    margin-right: 12%;
  }
 
  .show-comment-btn {
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
