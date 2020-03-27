<template>
	<div>
					
        <div class="articles" ref="articlesContainer">
            <loading  :active.sync="isLoading" 
                      :can-cancel="true" 
                      
                      :is-full-page="true"></loading>

            
            <BlogStyleCards :items="articles" />
            
          </div>
   </div>
</template>

<script>
import { mapGetters } from "vuex";
import { FETCH_ARTICLES } from "@/store/actions.type";
import BlogStyleCards from "@/components/BlogStyleCards"
import Loading from 'vue-loading-overlay';
import 'vue-loading-overlay/dist/vue-loading.css';

export default {
  name: "ArticlesList",
  components: {
     BlogStyleCards,
     Loading
  },
  props: {
    type: {
      type: String,
      required: false,
      default: "all"
    },
    subject: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      currentPage: 1
    };
  },
  computed: {
    listConfig() {
      const { type } = this;
      const filters = {
        offset: (this.currentPage - 1) * this.itemsPerPage,
        limit: this.itemsPerPage
      };
      
      return {
        type,
        filters
      };
    },
    pages() {
      if (this.isLoading || this.articlesCount <= this.itemsPerPage) {
        return [];
      }
      return [
        ...Array(Math.ceil(this.articlesCount / this.itemsPerPage)).keys()
      ].map(e => e + 1);
    },
    articles() { 
      var arts = this.$store.getters.articles;
      arts = arts.sort((a,b) => { 
        if(a.tags && !b.tags) return -1;
        if(b.tags && !a.tags) return 1;
        if(!a.tags && !b.tags) return 0;

        
          var priorityA = a.tags.find(t => (t+"").indexOf("prity=") >= 0);
          var priorityB = b.tags.find(t => (t+"").indexOf("prity=") >= 0);
          priorityA = _try(() => priorityA.split("prity=")[1], null);
          priorityB = _try(() => priorityB.split("prity=")[1], null);
          if(priorityA && !priorityB) return -1;
          if(priorityB && !priorityA) return 1;
          if(!priorityA && !priorityB) return 0;

          return  parseInt(priorityA) - parseInt(priorityB);
        
      });

      return arts; 
    },
    ...mapGetters(["articlesCount", "isLoading"])
  },
  mounted() {
    this.fetchArticles();
  },
  methods: {
    fetchArticles() {
      this.$store.dispatch(FETCH_ARTICLES, { subject: this.subject });
    },
    resetPagination() {
      this.listConfig.offset = 0;
      this.currentPage = 1;
    }
  }
};
</script>

<style>
  @media (max-width: 767px) {
    .articles {
      margin-left: 4%;
        margin-right: 2%;
    }
    
  }
</style>