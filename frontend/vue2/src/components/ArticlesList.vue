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
    ...mapGetters(["articlesCount", "isLoading", "articles"])
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