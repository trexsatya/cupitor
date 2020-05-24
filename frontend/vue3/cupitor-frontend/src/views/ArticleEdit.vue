<template>
<div class="editor-page">
  <div class="container page">
    <div class="row">
      <div class="col-md-10 offset-md-1 col-xs-12">

        <form v-on:submit.prevent="onPublish(article.id)">
          <fieldset :disabled="inProgress">
            <fieldset class="form-group">
              <input type="text" class="form-control form-control-lg" v-model="article.name" placeholder="Article Title">
            </fieldset>
            <fieldset class="form-group">
              <input type="text" class="form-control" v-model="article.subject" placeholder="Subject">
            </fieldset>
            <fieldset class="form-group">
              <textarea id="editor" name="editor" class="form-control" rows="8" v-model="article.content" placeholder="Write your article (in markdown)">
                </textarea>

            </fieldset>
            <fieldset class="form-group">
              <input type="text" class="form-control" v-model="article.summary" placeholder="Description">
            </fieldset>

          </fieldset>
          <button :disabled="inProgress" class="btn btn-lg pull-xs-left btn-primary" id="publishArticleButton" type="submit">
            Publish Article
          </button>

          <span v-on:click="onPreview()" :disabled="inProgress" class="btn btn-lg pull-xs-right btn-primary">
            Preview
          </span>
        </form>
      </div>
    </div>
  </div>
  <br><br>

</div>
</template>

<script>
// @ is an alias to /src
import {
  Component,
  Prop,
  Vue,
} from 'vue-property-decorator';
import {
  mapGetters,
  mapActions
} from 'vuex';

@Component({
  methods: mapActions([
    'fetchArticles',
  ]),
})
export default class ArticleEditView extends Vue {

  article = {};

  errors = [];
  inProgress = false;
  CKEDITOR = window.CKEDITOR;

  API_BASE_URL = window.API_URL;
  IMAGES_BASE_URL = window.imageCdnUrl;

  beforeRouteLeave(to, from, next) {

    const yes = confirm('Are you sure you want to leave?')
    if (yes) {
      localStorage.setItem('articleEditing', this.CKEDITOR.instances['editor'].getData());
      return next();
    } else return next(false)
  }

  mounted() {
    console.log('mounted');

    const el = document.createElement('script');
    el.src = "/ckeditor/ckeditor.js";
    document.head.append(el);

    const setup = this.setupEditor;

    const timeout = this.CKEDITOR ? 0 : 10000;

    setTimeout(() => {
      setup();
    }, timeout);
  }

  setupEditor() {
    fetch(this.API_BASE_URL + 'article/' + this.$route.params.id)
      .then((res) => res.json())
      .then((article) => {
        this.article = article;
        this.CKEDITOR.replace('editor', {
          entities: true,
          extraPlugins: 'mathematica,codesnippet',
          allowedContent: true,
        });
      });

    window.onbeforeunload = function() {
      localStorage.setItem('articleEditing', this.CKEDITOR.instances['editor'].getData());
      return 'Are you sure you want to leave?';
    };

    let editor = this.CKEDITOR.instances['editor'];
    if(!editor) editor = { on: (e) => { console.log('dumb'); }};

    let isCtrl = false,
      isCtrlS = false;

    editor.on('key', function(event) {
      if (event.data.domEvent.$.keyCode == 17) isCtrl = false;
    });

    editor.on('key', function(event) {

      isCtrl = event.data.domEvent.$.keyCode == 17 || event.data.domEvent.$.metaKey || event.data.domEvent.$.ctrlKey;

      if (!isCtrl) isCtrl = (event.metaKey || event.ctrlKey);

      if (isCtrl && event.key == 's') isCtrlS = true;

      if (isCtrlS || (event.data.domEvent.$.keyCode == 83 && isCtrl == true)) {
        //The preventDefault() call prevents the browser's save popup to appear.
        //The try statement fixes a weird IE error.
        try {
          event.data.domEvent.$.preventDefault();
        } catch (err) {}

        //Call to your save function

        try {
          $('#publishArticleButton').click();
        } catch (e) {}

        isCtrl = false, isCtrlS = false;
        return false;
      }
    });

    window.document.addEventListener("keydown", function(e) {
      if ((window.navigator.platform.match("Mac") ? e.metaKey : e.ctrlKey) && e.keyCode == 83) {
        e.preventDefault();
        // Process the event here (such as click on submit button)
        try {
          $('#publishArticleButton').click();
        } catch (e) {}
      }
    }, false);
  }

  validate() {
    console.log(this.article);
    const errors = {}
    if (!this.article.name) {
      errors.title = ["Can't be empty"];
    }
    if (!this.article.subject) {
      errors.subject = ["Can't be empty"];
    }
    this.errors = errors
    return Object.keys(errors).length == 0;
  }

  onPreview() {
    const name = this.article.name;
    const subject = this.article.subject;
    const summary = this.article.summary;

    this.$store.dispatch("articlePreview", {
      content: CKEDITOR.instances['editor'].getData(),
      name: name,
      subject: subject,
      summary: summary
    });
  }

  onPublish(slug) {
    if (!this.validate()) return;
    if (!window['X-Auth']) {
      window['X-Auth'] = prompt('Enter auth header');
      if (!window['X-Auth']) return;
    }

    this.article.content = this.CKEDITOR.instances['editor'].getData()
    const action = slug ? ARTICLE_EDIT : ARTICLE_PUBLISH;
    this.inProgress = true;
    this.$store
      .dispatch(action)
      .then(({
        data
      }) => {
        this.inProgress = false;
        this.$router.push({
          name: "article",
          params: {
            slug: data.article.slug
          }
        });
      })
      .catch(({
        response
      }) => {
        this.inProgress = false;
        this.errors = response || {};
      });
  }
}
</script>
