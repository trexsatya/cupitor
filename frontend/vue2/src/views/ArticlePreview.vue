<template>
  <div>
        <div class="article-container">
            
               <div class="article" v-if="article">
               
                <div>
                 <!-- <Breadcrumb :items='getBreadcrumbItems(article)' /> -->
                   <span style="float: right;
                              margin-top: 10px;
                              background-color: #85ccf3;
                              color: white;padding-left: 10px;
                              padding-right: 10px;
                              border-radius: 10px;
                              font-size: 12px;
                              font-weight: bold;"> Date </span>
                </div>                  
                <h2 style="text-align: center;">{{ article.name }}</h2>
   <hr>
                
                <div class="content" v-html="article.content">
                </div>
            </div>
        </div>
   </div>
</template>

<script>
import { mapGetters, mapState } from "vuex";
import marked from "marked";
import { transformArticle } from '@/common/utils'

export default {
  name: "rwv-article",
  props: {
    
  },
  components: {
    
  },
  computed: mapState({
    // passing the string value 'count' is same as `state => state.count`
    countAlias: 'count',

    // to access local state with `this`, a normal function must be used
    article (state) {
      return state.article.articlePreview
    }
  }),

  unmounted(){
    
  },
  updated(){
      console.log('updated');
      transformArticle(this.$router);
  },
  methods: {
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
