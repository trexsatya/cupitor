<template>
      <div style="display:inline-flex; width: 30%;margin-left:20%">
            <model-list-select :list="searchResults"
                             option-value="id"
                             option-text="name"
                             :custom-text="customName"
                             v-model="selectedArticle"
                             placeholder="Search..."
                             @searchchange="searchArticles"
                             >
            </model-list-select>
     
      </div>
        
</template>
 
<script>
  import { ModelListSelect } from 'vue-search-select'
  import { SEARCH_ARTICLES } from "@/store/actions.type";
  import { mapGetters } from "vuex";

  export default {
    name: 'Search',
    data () {
      return {
        selectedArticle: {},
        searchText: ''
      }
    },
    methods: {
      customName(item){ 
        return item.name; 
      },
      searchArticles(searchText){
        if(!searchText) return;
        this.$store.dispatch(SEARCH_ARTICLES, { text: searchText });
      },

    },
    computed: {
      ...mapGetters(["searchResults"])
    },
    components: {
      ModelListSelect
    },
    watch: {
       selectedArticle(){
         console.log(this.selectedArticle.id);
         if(!this.selectedArticle || !this.selectedArticle.id) return;
         this.$router.push("/article/"+this.selectedArticle.id);
         //this.selectedArticle = {}
       }
    }
  }
</script> 

<style>
  .ui.fluid.dropdown{
    background: rgb(51, 51, 51) !important;
    border-color: gray !important;
    color: whitesmoke !important;
  }
  .ui.search.dropdown > .text{
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
    width: 100% !important;
    overflow: hidden !important;
    line-height: 1.3em !important;
  }
</style>