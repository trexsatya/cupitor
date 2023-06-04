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

  beforeRouteLeave(to, from, next) {
    const yes = confirm('Are you sure you want to leave?')
    if (yes) {
      localStorage.setItem('articleEditing', window.CKEDITOR.instances['editor'].getData());
      return next();
    } else return next(false)
  }

  mounted() {
    console.log('mounted');

    const el = document.createElement('script');
    el.async = false;
    el.src = "/ckeditor/ckeditor.js";
    document.head.append(el);

    window.onload = (e) => {
      window.CKEDITOR.replace('editor', {
        entities: true,
        extraPlugins: 'mathematica,codesnippet,title',
        allowedContent: true,
      });

      this.setupEditor();
      fetch(window.API_URL + 'article/' + this.$route.params.id)
        .then((res) => res.json())
        .then((article) => {
          this.article = article;
          setTimeout(() => {
            CKEDITOR.instances['editor'].setData(this.article.content);
          }, 1000);
        });
    };
  }

  setupEditor() {
    window.onbeforeunload = function() {
      localStorage.setItem('articleEditing', window.CKEDITOR.instances['editor'].getData());
      return 'Are you sure you want to leave?';
    };

    const editor = window.CKEDITOR.instances['editor'];

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
          document.getElementById('publishArticleButton').click();
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
          document.getElementById('publishArticleButton').click();
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

  onPublish(id) {
    if (!this.validate()) return;
    if (!window['X-Auth']) {
      window['X-Auth'] = prompt('Enter auth header');
      if (!window['X-Auth']) return;
    }

    this.article.content = window.CKEDITOR.instances['editor'].getData()
    // const method = id ? 'PUT' : 'POST';
    const method = 'POST';
    const url = id ? window.WRITE_API_URL + "article/" + id : window.WRITE_API_URL + "article";

    this.inProgress = true;
    fetch(url + "?x-auth=" + window['X-Auth'], {
      method: method,
      mode: 'no-cors',
      body: JSON.stringify(this.article),
      headers: {
        'X-Auth': window['X-Auth'],
        'Content-Type': 'application/json'
      }
    }).then(response => {
      this.inProgress = false;
      return response.json();
    });

    // this.callApi(url, method, this.article, resp => {
    //   this.inProgress = false;
    //   console.log(resp)
    // }, err => {
    //   this.inProgress = false;
    //   console.log(err)
    // });

  }
}
</script>
