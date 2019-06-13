<template>
	<div>
        <div class="article-container">
            
              <loading  :active.sync="isLoading" 
                      :can-cancel="true" 
                      
                      :is-full-page="true"></loading>

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
                              font-weight: bold;"> {{ getDateString(article.lastUpdated) }}</span>
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
import { mapGetters } from "vuex";
import { FETCH_ARTICLE } from "@/store/actions.type";
import Breadcrumb from "@/components/Breadcrumb"
import Loading from 'vue-loading-overlay';
import 'vue-loading-overlay/dist/vue-loading.css';
import { transformArticle } from '@/common/utils'

export default {
  name: "ArticlePage",
  components: {
     Breadcrumb, Loading
  },
  props: {
    articleId: {
      type: String,
      required: false,
      default: "all"
    }
  },
  data() {
    return {
     
    };
  },
  computed: {
    ...mapGetters(["article", "isLoading", "currentUser", "comments", "isAuthenticated"])
  },
  mounted() {
    this.fetchArticle();
  },
  updated(){
      transformArticle(this.$router);
      try {
        const name = this.article && this.article.name || 'LivingToLearn'
        document.title = name;

      } catch(e){}
  },
  methods: {
      fetchArticle() {
        this.$store.dispatch(FETCH_ARTICLE,  this.articleId );
      },

      parseMarkdown(content) {
          return marked(content);
      },

      
      getBreadcrumbItems: function(article){
          const sub = s => s.startsWith('hidden') ? '>>>' : s;
          return [ {name: "Home", route: "/"}, {name: "articles", route: "/"}, 
          {name:  sub(article.subject), 
            route: "/articles/"+ sub(article.subject) }, 
          {name: "", route: "/" }]
      },

      getDateString: function(d){
      	  if(!d) return "Jan 01 2008";
          var ds = new Date(d).toDateString()
          if(ds.split(" ").length > 1){
            return ds.split(" ").slice(1).join(" ")
          }
      }
  }
};
</script>

<style>
	

  @media (max-width: 767px) {
    .article {
      margin-left: 4%;
      margin-right: 4%;
    }
  }

  .article {
  
  }
</style>
