(window["webpackJsonp"]=window["webpackJsonp"]||[]).push([["chunk-51a4a012"],{"04d0":function(t,e,r){"use strict";r.r(e);var n=function(){var t=this,e=t.$createElement,r=t._self._c||e;return r("div",{staticClass:"editor-page"},[r("div",{staticClass:"container page"},[r("div",{staticClass:"row"},[r("div",{staticClass:"col-md-10 offset-md-1 col-xs-12"},[r("RwvListErrors",{attrs:{errors:t.errors}}),r("form",{on:{submit:function(e){e.preventDefault(),t.onPublish(t.article.id)}}},[r("fieldset",{attrs:{disabled:t.inProgress}},[r("fieldset",{staticClass:"form-group"},[r("input",{directives:[{name:"model",rawName:"v-model",value:t.article.name,expression:"article.name"}],staticClass:"form-control form-control-lg",attrs:{type:"text",placeholder:"Article Title"},domProps:{value:t.article.name},on:{input:function(e){e.target.composing||t.$set(t.article,"name",e.target.value)}}})]),r("fieldset",{staticClass:"form-group"},[r("input",{directives:[{name:"model",rawName:"v-model",value:t.article.subject,expression:"article.subject"}],staticClass:"form-control",attrs:{type:"text",placeholder:"Subject"},domProps:{value:t.article.subject},on:{input:function(e){e.target.composing||t.$set(t.article,"subject",e.target.value)}}})]),r("fieldset",{staticClass:"form-group"},[r("textarea",{directives:[{name:"model",rawName:"v-model",value:t.article.content,expression:"article.content"}],staticClass:"form-control",attrs:{id:"editor",name:"editor",rows:"8",placeholder:"Write your article (in markdown)"},domProps:{value:t.article.content},on:{input:function(e){e.target.composing||t.$set(t.article,"content",e.target.value)}}})]),r("fieldset",{staticClass:"form-group"},[r("input",{directives:[{name:"model",rawName:"v-model",value:t.tagInput,expression:"tagInput"}],staticClass:"form-control",attrs:{type:"text",placeholder:"Enter tags"},domProps:{value:t.tagInput},on:{keypress:function(e){if(!("button"in e)&&t._k(e.keyCode,"enter",13,e.key,"Enter"))return null;e.preventDefault(),t.addTag(t.tagInput)},input:function(e){e.target.composing||(t.tagInput=e.target.value)}}}),r("div",{staticClass:"tag-list"},t._l(t.article.tagList,function(e,n){return r("span",{key:e+n,staticClass:"tag-default tag-pill"},[r("i",{staticClass:"ion-close-round",on:{click:function(r){t.removeTag(e)}}}),t._v("\n              "+t._s(e)+"\n            ")])}))])]),r("button",{staticClass:"btn btn-lg pull-xs-right btn-primary",attrs:{disabled:t.inProgress,type:"submit"}},[t._v("\n            Publish Article\n          ")])])],1)])])])},o=[],i=(r("7f7f"),r("a481"),r("c93e"));r("96cf");function a(t){return function(){var e=this,r=arguments;return new Promise(function(n,o){var i=t.apply(e,r);function a(t,e){try{var r=i[t](e),a=r.value}catch(t){return void o(t)}r.done?n(a):Promise.resolve(a).then(s,c)}function s(t){a("next",t)}function c(t){a("throw",t)}s()})}}var s=r("2f62"),c=r("4360"),u=function(){var t=this,e=t.$createElement,r=t._self._c||e;return r("ul",{staticClass:"error-messages"},t._l(t.errors,function(e,n){return r("li",{key:n},[t._v("\n    "+t._s(n)+"\n    "),t._l(e,function(e){return r("span",{key:e},[t._v(t._s(e))])})],2)}))},l=[],f={name:"RwvListErorrs",props:{errors:{type:Object,required:!0}}},p=f,h=r("2877"),d=Object(h["a"])(p,u,l,!1,null,null,null);d.options.__file="ListErrors.vue";var v=d.exports,m=r("6c33"),g={name:"RwvArticleEdit",components:{RwvListErrors:v},props:{previousArticle:{type:Object,required:!1}},beforeRouteUpdate:function(){var t=a(regeneratorRuntime.mark(function t(e,r,n){return regeneratorRuntime.wrap(function(t){while(1)switch(t.prev=t.next){case 0:return t.next=2,c["a"].dispatch(m["f"]);case 2:return t.abrupt("return",n());case 3:case"end":return t.stop()}},t,this)}));return function(e,r,n){return t.apply(this,arguments)}}(),beforeRouteEnter:function(){var t=a(regeneratorRuntime.mark(function t(e,r,n){return regeneratorRuntime.wrap(function(t){while(1)switch(t.prev=t.next){case 0:if("new"!=e.params.slug){t.next=2;break}return t.abrupt("return",n());case 2:return t.next=4,c["a"].dispatch(m["f"]);case 4:if(void 0===e.params.slug){t.next=7;break}return t.next=7,c["a"].dispatch(m["l"],e.params.slug,e.params.previousArticle);case 7:return t.abrupt("return",n());case 8:case"end":return t.stop()}},t,this)}));return function(e,r,n){return t.apply(this,arguments)}}(),beforeRouteLeave:function(){var t=a(regeneratorRuntime.mark(function t(e,r,n){return regeneratorRuntime.wrap(function(t){while(1)switch(t.prev=t.next){case 0:return t.next=2,c["a"].dispatch(m["f"]);case 2:n();case 3:case"end":return t.stop()}},t,this)}));return function(e,r,n){return t.apply(this,arguments)}}(),data:function(){return{tagInput:null,inProgress:!1,errors:{}}},computed:Object(i["a"])({},Object(s["b"])(["article"])),updated:function(){CKEDITOR.instances["editor"]||CKEDITOR.replace("editor",{entities:!0,extraPlugins:"mathematica,codesnippet",allowedContent:!0})},mounted:function(){CKEDITOR.instances["editor"]||CKEDITOR.replace("editor",{entities:!0,extraPlugins:"mathematica,codesnippet",allowedContent:!0})},methods:{validate:function(){console.log(this.article);var t={};this.article.name||(t.title=["Can't be empty"]),this.article.subject||(t.subject=["Can't be empty"]),this.errors=t},onPublish:function(t){var e=this;if(this.validate()){var r=t?m["b"]:m["e"];this.inProgress=!0,this.$store.dispatch(r).then(function(t){var r=t.data;e.inProgress=!1,e.$router.push({name:"article",params:{slug:r.article.slug}})}).catch(function(t){var r=t.response;e.inProgress=!1,e.errors=r.errors||[]})}},removeTag:function(t){this.$store.dispatch(m["d"],t)},addTag:function(t){this.$store.dispatch(m["c"],t),this.tagInput=null}}},y=g,w=Object(h["a"])(y,n,o,!1,null,null,null);w.options.__file="ArticleEdit.vue";e["default"]=w.exports},"96cf":function(t,e){!function(e){"use strict";var r,n=Object.prototype,o=n.hasOwnProperty,i="function"===typeof Symbol?Symbol:{},a=i.iterator||"@@iterator",s=i.asyncIterator||"@@asyncIterator",c=i.toStringTag||"@@toStringTag",u="object"===typeof t,l=e.regeneratorRuntime;if(l)u&&(t.exports=l);else{l=e.regeneratorRuntime=u?t.exports:{},l.wrap=b;var f="suspendedStart",p="suspendedYield",h="executing",d="completed",v={},m={};m[a]=function(){return this};var g=Object.getPrototypeOf,y=g&&g(g(T([])));y&&y!==n&&o.call(y,a)&&(m=y);var w=_.prototype=E.prototype=Object.create(m);L.prototype=w.constructor=_,_.constructor=L,_[c]=L.displayName="GeneratorFunction",l.isGeneratorFunction=function(t){var e="function"===typeof t&&t.constructor;return!!e&&(e===L||"GeneratorFunction"===(e.displayName||e.name))},l.mark=function(t){return Object.setPrototypeOf?Object.setPrototypeOf(t,_):(t.__proto__=_,c in t||(t[c]="GeneratorFunction")),t.prototype=Object.create(w),t},l.awrap=function(t){return{__await:t}},C(k.prototype),k.prototype[s]=function(){return this},l.AsyncIterator=k,l.async=function(t,e,r,n){var o=new k(b(t,e,r,n));return l.isGeneratorFunction(e)?o:o.next().then(function(t){return t.done?t.value:o.next()})},C(w),w[c]="Generator",w[a]=function(){return this},w.toString=function(){return"[object Generator]"},l.keys=function(t){var e=[];for(var r in t)e.push(r);return e.reverse(),function r(){while(e.length){var n=e.pop();if(n in t)return r.value=n,r.done=!1,r}return r.done=!0,r}},l.values=T,I.prototype={constructor:I,reset:function(t){if(this.prev=0,this.next=0,this.sent=this._sent=r,this.done=!1,this.delegate=null,this.method="next",this.arg=r,this.tryEntries.forEach(R),!t)for(var e in this)"t"===e.charAt(0)&&o.call(this,e)&&!isNaN(+e.slice(1))&&(this[e]=r)},stop:function(){this.done=!0;var t=this.tryEntries[0],e=t.completion;if("throw"===e.type)throw e.arg;return this.rval},dispatchException:function(t){if(this.done)throw t;var e=this;function n(n,o){return s.type="throw",s.arg=t,e.next=n,o&&(e.method="next",e.arg=r),!!o}for(var i=this.tryEntries.length-1;i>=0;--i){var a=this.tryEntries[i],s=a.completion;if("root"===a.tryLoc)return n("end");if(a.tryLoc<=this.prev){var c=o.call(a,"catchLoc"),u=o.call(a,"finallyLoc");if(c&&u){if(this.prev<a.catchLoc)return n(a.catchLoc,!0);if(this.prev<a.finallyLoc)return n(a.finallyLoc)}else if(c){if(this.prev<a.catchLoc)return n(a.catchLoc,!0)}else{if(!u)throw new Error("try statement without catch or finally");if(this.prev<a.finallyLoc)return n(a.finallyLoc)}}}},abrupt:function(t,e){for(var r=this.tryEntries.length-1;r>=0;--r){var n=this.tryEntries[r];if(n.tryLoc<=this.prev&&o.call(n,"finallyLoc")&&this.prev<n.finallyLoc){var i=n;break}}i&&("break"===t||"continue"===t)&&i.tryLoc<=e&&e<=i.finallyLoc&&(i=null);var a=i?i.completion:{};return a.type=t,a.arg=e,i?(this.method="next",this.next=i.finallyLoc,v):this.complete(a)},complete:function(t,e){if("throw"===t.type)throw t.arg;return"break"===t.type||"continue"===t.type?this.next=t.arg:"return"===t.type?(this.rval=this.arg=t.arg,this.method="return",this.next="end"):"normal"===t.type&&e&&(this.next=e),v},finish:function(t){for(var e=this.tryEntries.length-1;e>=0;--e){var r=this.tryEntries[e];if(r.finallyLoc===t)return this.complete(r.completion,r.afterLoc),R(r),v}},catch:function(t){for(var e=this.tryEntries.length-1;e>=0;--e){var r=this.tryEntries[e];if(r.tryLoc===t){var n=r.completion;if("throw"===n.type){var o=n.arg;R(r)}return o}}throw new Error("illegal catch attempt")},delegateYield:function(t,e,n){return this.delegate={iterator:T(t),resultName:e,nextLoc:n},"next"===this.method&&(this.arg=r),v}}}function b(t,e,r,n){var o=e&&e.prototype instanceof E?e:E,i=Object.create(o.prototype),a=new I(n||[]);return i._invoke=j(t,r,a),i}function x(t,e,r){try{return{type:"normal",arg:t.call(e,r)}}catch(t){return{type:"throw",arg:t}}}function E(){}function L(){}function _(){}function C(t){["next","throw","return"].forEach(function(e){t[e]=function(t){return this._invoke(e,t)}})}function k(t){function e(r,n,i,a){var s=x(t[r],t,n);if("throw"!==s.type){var c=s.arg,u=c.value;return u&&"object"===typeof u&&o.call(u,"__await")?Promise.resolve(u.__await).then(function(t){e("next",t,i,a)},function(t){e("throw",t,i,a)}):Promise.resolve(u).then(function(t){c.value=t,i(c)},a)}a(s.arg)}var r;function n(t,n){function o(){return new Promise(function(r,o){e(t,n,r,o)})}return r=r?r.then(o,o):o()}this._invoke=n}function j(t,e,r){var n=f;return function(o,i){if(n===h)throw new Error("Generator is already running");if(n===d){if("throw"===o)throw i;return N()}r.method=o,r.arg=i;while(1){var a=r.delegate;if(a){var s=P(a,r);if(s){if(s===v)continue;return s}}if("next"===r.method)r.sent=r._sent=r.arg;else if("throw"===r.method){if(n===f)throw n=d,r.arg;r.dispatchException(r.arg)}else"return"===r.method&&r.abrupt("return",r.arg);n=h;var c=x(t,e,r);if("normal"===c.type){if(n=r.done?d:p,c.arg===v)continue;return{value:c.arg,done:r.done}}"throw"===c.type&&(n=d,r.method="throw",r.arg=c.arg)}}}function P(t,e){var n=t.iterator[e.method];if(n===r){if(e.delegate=null,"throw"===e.method){if(t.iterator.return&&(e.method="return",e.arg=r,P(t,e),"throw"===e.method))return v;e.method="throw",e.arg=new TypeError("The iterator does not provide a 'throw' method")}return v}var o=x(n,t.iterator,e.arg);if("throw"===o.type)return e.method="throw",e.arg=o.arg,e.delegate=null,v;var i=o.arg;return i?i.done?(e[t.resultName]=i.value,e.next=t.nextLoc,"return"!==e.method&&(e.method="next",e.arg=r),e.delegate=null,v):i:(e.method="throw",e.arg=new TypeError("iterator result is not an object"),e.delegate=null,v)}function O(t){var e={tryLoc:t[0]};1 in t&&(e.catchLoc=t[1]),2 in t&&(e.finallyLoc=t[2],e.afterLoc=t[3]),this.tryEntries.push(e)}function R(t){var e=t.completion||{};e.type="normal",delete e.arg,t.completion=e}function I(t){this.tryEntries=[{tryLoc:"root"}],t.forEach(O,this),this.reset(!0)}function T(t){if(t){var e=t[a];if(e)return e.call(t);if("function"===typeof t.next)return t;if(!isNaN(t.length)){var n=-1,i=function e(){while(++n<t.length)if(o.call(t,n))return e.value=t[n],e.done=!1,e;return e.value=r,e.done=!0,e};return i.next=i}}return{next:N}}function N(){return{value:r,done:!0}}}(function(){return this}()||Function("return this")())},a481:function(t,e,r){r("214f")("replace",2,function(t,e,r){return[function(n,o){"use strict";var i=t(this),a=void 0==n?void 0:n[e];return void 0!==a?a.call(n,i,o):r.call(String(i),n,o)},r]})}}]);
//# sourceMappingURL=chunk-51a4a012.872a780e.js.map