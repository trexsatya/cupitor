<template>
  <div class="editor-page">
    <div class="container page">
      <div class="row">
        <div class="col-md-10 offset-md-1 col-xs-12">
          <RwvListErrors :errors="errors"/>
          <form v-on:submit.prevent="onPublish(article.id)">
            <fieldset :disabled="inProgress">
              <fieldset class="form-group">
                <input
                  type="text"
                  class="form-control form-control-lg"
                  v-model="article.name"
                  placeholder="Article Title">
              </fieldset>
              <fieldset class="form-group">
                <input
                  type="text"
                  class="form-control"
                  v-model="article.subject"
                  placeholder="Subject">
              </fieldset>
              <fieldset class="form-group">
                <textarea id="editor" name="editor"
                  class="form-control"
                  rows="8"
                  v-model="article.content"
                  placeholder="Write your article (in markdown)">
                </textarea>
                
              </fieldset>
              <fieldset class="form-group">
                <input
                  type="text"
                  class="form-control"
                  v-model="article.summary"
                  placeholder="Description">
              </fieldset>
              <fieldset class="form-group">
                <input
                  type="text"
                  class="form-control"
                  placeholder="Enter tags"
                  v-model="tagInput"
                  v-on:keypress.enter.prevent="addTag(tagInput)">
                <div class="tag-list">
                  <span
                    class="tag-default tag-pill"
                    v-for="(tag, index) of article.tagList"
                    :key="tag + index">
                  <i
                    class="ion-close-round"
                    v-on:click="removeTag(tag)">
                </i>
                {{ tag }}
              </span>
                </div>
              </fieldset>
            </fieldset>
            <button
              :disabled="inProgress"
              class="btn btn-lg pull-xs-left btn-primary"
              id="publishArticleButton"
              type="submit">
              Publish Article
            </button>

            <span
              v-on:click="onPreview()"
              :disabled="inProgress"
              class="btn btn-lg pull-xs-right btn-primary">
              Preview
            </span>
          </form>
        </div>
      </div>
    </div>
    <br><br>
    <ArticlePreview/>
  </div>

</template>

<script>
import { mapGetters } from "vuex";
import store from "@/store";
import RwvListErrors from "@/components/ListErrors";
import ArticlePreview from "@/views/ArticlePreview";
import { transformArticle } from '@/common/utils'
import {
  ARTICLE_PUBLISH,
  ARTICLE_EDIT,
  FETCH_ARTICLE,
  ARTICLE_EDIT_ADD_TAG,
  ARTICLE_EDIT_REMOVE_TAG,
  ARTICLE_RESET_STATE
} from "@/store/actions.type";

export default {
  name: "RwvArticleEdit",
  components: { 
    RwvListErrors: RwvListErrors, 
    ArticlePreview: ArticlePreview 
  },
  props: {
    previousArticle: {
      type: Object,
      required: false
    }
  },
  async beforeRouteUpdate(to, from, next) {
    // Reset state if user goes from /editor/:id to /editor
    // The component is not recreated so we use to hook to reset the state.
    await store.dispatch(ARTICLE_RESET_STATE);
    return next();
  },
  async beforeRouteEnter(to, from, next) {
    if(to.params.slug == 'new'){
      return next();
    }

    await store.dispatch(ARTICLE_RESET_STATE);
    if (to.params.slug !== undefined) {
      await store.dispatch(
        FETCH_ARTICLE,
        to.params.slug,
        to.params.previousArticle
      );
    }
    return next();
  },
  async beforeRouteLeave(to, from, next) {
    await store.dispatch(ARTICLE_RESET_STATE);
    next();
  },

  beforeRouteLeave(to, from, next){
    
    var yes = confirm('Are you sure you want to leave?')
    if(yes) {
      localStorage.setItem('articleEditing', CKEDITOR.instances['editor'].getData());
      return next();
    }
    else return next(false)
  },

  data() {
    return {
      tagInput: null,
      inProgress: false,
      errors: {}
    };
  },
  computed: {
    ...mapGetters(["article"])
  },
  updated() {
    if(!CKEDITOR.instances['editor']){
        CKEDITOR.replace( 'editor' , {
            entities: true,
            extraPlugins: 'mathematica,codesnippet',
            allowedContent: true,
        });
    }
  },
  mounted() {
    if(!CKEDITOR.instances['editor']){
        CKEDITOR.replace( 'editor' , {
            entities: true,
            extraPlugins: 'mathematica,codesnippet',
            allowedContent: true,
        });
    }

    window.onbeforeunload = function(){
      localStorage.setItem('articleEditing', CKEDITOR.instances['editor'].getData());
      return 'Are you sure you want to leave?';
    };

   var editor = CKEDITOR.instances['editor'];
      var isCtrl = false, isCtrlS = false;

      editor.on( 'key', function(event) {
          if(event.data.domEvent.$.keyCode == 17) isCtrl=false;
      });

      editor.on( 'key', function(event) {

          isCtrl = event.data.domEvent.$.keyCode == 17 || event.data.domEvent.$.metaKey || event.data.domEvent.$.ctrlKey;
          
          if(!isCtrl) isCtrl = (event.metaKey || event.ctrlKey);

          if(isCtrl && event.key == 's') isCtrlS = true;

          if(isCtrlS || (event.data.domEvent.$.keyCode == 83 && isCtrl == true)) {
              //The preventDefault() call prevents the browser's save popup to appear.
              //The try statement fixes a weird IE error.
              try {
                  event.data.domEvent.$.preventDefault();
              } catch(err) {}

              //Call to your save function

              try { $('#publishArticleButton').click(); } catch(e) {}

              isCtrl = false, isCtrlS = false;
              return false;
          }
      });

    window.document.addEventListener("keydown", function(e) {
      if ((window.navigator.platform.match("Mac") ? e.metaKey : e.ctrlKey)  && e.keyCode == 83) {
        e.preventDefault();
        // Process the event here (such as click on submit button)
        try { $('#publishArticleButton').click(); } catch(e) {}
      }
    }, false);  

  },
  methods: {
    validate(){
      console.log(this.article);
      var errors = {}
      if(!this.article.name){
        errors.title = ["Can't be empty"];
      }
      if(!this.article.subject){
       errors.subject = ["Can't be empty"];
      }
      this.errors = errors
      return Object.keys(errors).length == 0;
    },

    onPreview() {
      var name = this.article.name;
      var subject = this.article.subject;
      var summary = this.article.summary;

      this.$store.dispatch("articlePreview", {
        content: CKEDITOR.instances['editor'].getData(),
        name: name, subject: subject, summary: summary
      });
    },

    onPublish(slug) {
      if(!this.validate()) return;
      if(!window['X-Auth']){
        window['X-Auth'] = prompt('Enter auth header');
        if(!window['X-Auth']) return;
      }

      this.article.content = CKEDITOR.instances['editor'].getData()
      let action = slug ? ARTICLE_EDIT : ARTICLE_PUBLISH;
      this.inProgress = true;
      this.$store
        .dispatch(action)
        .then(({ data }) => {
          this.inProgress = false;
          this.$router.push({
            name: "article",
            params: { slug: data.article.slug }
          });
        })
        .catch(({ response }) => {
          this.inProgress = false;
          this.errors = response || {};
        });
    },
    removeTag(tag) {
      this.$store.dispatch(ARTICLE_EDIT_REMOVE_TAG, tag);
    },
    addTag(tag) {
      this.$store.dispatch(ARTICLE_EDIT_ADD_TAG, tag);
      this.tagInput = null;
    }
  }
};
</script>
