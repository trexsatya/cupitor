<template>
	<div class="blogstyle-cards">
        <div :class="index%2 == 0 ? 'blog-card' : 'blog-card alt'" v-for="(item, index) in items">
        	<div class="photo photo1" :style="getBgImgStyle(item.img)"></div>
        	<ul class="details">
        		<li class="author"><a href="#">{{ eitherOr(item.author, defaultName) }}</a></li>
        		<li class="date">{{ eitherOr( getDate(item.lastUpdated), defaultDate) }}</li>
        		<li class="tags">
        			
        		</li>
        	</ul>
        	<div class="description">
        		<h1>{{ item.name }}</h1>
        		<h2></h2>
        		<p class="summary">
        		    {{ eitherOr(item.summary, defaultSummary )}}
        		</p>
        		<router-link :to="'/article/'+(item._id || item.id )" >
        		    <a href="#">Read More..</a>
        		</router-link>
        	</div>
        </div>
   </div>
</template>

<script>
import { mapGetters } from "vuex";	
export default {
    name: "BlogStyleCards",
	props: {
        items: { type: Array }
	},
    data() {
        return {
            defaultName: 'Satyendra ',
            defaultDate: 'Jan 1, 2018',
            defaultSummary: 'This articles is under construction!!'
        }
    },
    updated() {

    },
    created() {

    },
    methods: {
        eitherOr: function(x, y){
            return x ? x : y;
        },
        getDate: function(x){
			if(x && typeof x == 'object' && x.$date){
                return new Date(x.$date).toDateString()
            }
			if(x && typeof x == 'number'){
				return new Date(x).toDateString()
			}
            return null;
        },
        getBgImgStyle: function(src){
            if(!src) return ''

            if(src.startsWith('/images/')){
               src = src.replace('/images/', window.imageCdnUrl)
            }
            return `background-image: url(${src}); background-size: cover;`
        }
    },
    computed: {
      
    }
};
</script>

<style>
 @media only screen and (min-width: 1000px) {

    .blog-card {
        max-width: 600px;
    }

    .articles{
        margin-left: 10%;
        margin-right: 15%;
    }

    #app {
        margin-left: 0;
    }
}

.blog-card {
  margin-bottom: 3% !important;
  transition: height 0.3s ease;
  -webkit-transition: height 0.3s ease;
  background: #fff;
  border-radius: 3px;
  box-shadow: 0 3px 7px -3px rgba(0, 0, 0, 0.3);
  margin: 0 auto 1.6%;
  overflow: hidden;
  position: relative;
  font-size: 14px;
  line-height: 1.45em;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-box-shadow: -11px 0px 0px 0px rgba(15,209,115,1);
  -moz-box-shadow: -11px 0px 0px 0px rgba(15,209,115,1);
  box-shadow: -11px 0px 0px 0px rgba(15,209,115,1);

}
.blog-card:hover .details {
  left: 0;
}
.blog-card:hover.alt .details {
  right: 0;
}
.blog-card.alt .details {
  right: -100%;
  left: inherit;
}
.blog-card .photo {
  height: 200px;
  position: relative;
}
.blog-card .photo.photo1 {
  
  background-size: cover;
}
.blog-card .photo.photo2 {
  background: url("") center no-repeat;
  background-size: cover;
}
.blog-card .details {
  transition: all 0.3s ease;
  -webkit-transition: all 0.3s ease;
  background: rgba(0, 0, 0, 0.6);
  box-sizing: border-box;
  color: #fff;
  font-family: "Open Sans";
  list-style: none;
  margin: 0;
  padding: 10px 15px;
  height: 200px;
  /*POSITION*/
  position: absolute;
  top: 0;
  left: -100%;
}
.blog-card .details > li {
  padding: 3px 0;
}
.blog-card .details li:before, .blog-card .details .tags ul:before {
  font-family: FontAwesome;
  margin-right: 10px;
  vertical-align: middle;
}
.blog-card .details .author:before {
  content: "\f007";
}
.blog-card .details .date:before {
  content: "\f133";
}
.blog-card .details .tags ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
.blog-card .details .tags ul:before {
  content: "\f02b";
}
.blog-card .details .tags li {
  display: inline-block;
  margin-right: 3px;
}
.blog-card .details a {
  color: inherit;
  border-bottom: 1px dotted;
}
.blog-card .details a:hover {
  color: #75D13B;
}
.blog-card .description {
  padding: 10px;
  box-sizing: border-box;
  position: relative;
}
.blog-card .description h1 {
  font-family: "Roboto";
  line-height: 1em;
  margin: 0 0 10px 0;
}
.blog-card .description h2 {
  color: #9b9b9b;
  font-family: "Open Sans";
  line-height: 1.2em;
  text-transform: uppercase;
  font-size: 1em;
  font-weight: 400;
  margin: 1.2% 0;
}
.blog-card .description p {
  position: relative;
  margin: 0;
  padding-top: 20px;
}
.blog-card .description p:after {
  content: "";
  background: #75D13B;
  height: 6px;
  width: 40px;
  /*POSITION*/
  position: absolute;
  top: 6px;
  left: 0;
}
.blog-card .description a {
  color: #75D13B;
  margin-bottom: 10px;
  float: right;
}
.blog-card .description a:after {
  transition: all 0.3s ease;
  -webkit-transition: all 0.3s ease;
  content: "\f061";
  font-family: FontAwesome;
  margin-left: -10px;
  opacity: 0;
  vertical-align: middle;
}
.blog-card .description a:hover:after {
  margin-left: 5px;
  opacity: 1;
}
.flex-card-listitem {
  cursor: pointer;
}

@media screen and (min-width: 600px) and (max-width: 1000px) {
    .blog-card {
        max-width: 900px;
    }
}

@media screen and (min-width: 600px) {
  .blog-card:hover .photo {
    -webkit-transform: rotate(5deg) scale(1.3);
            transform: rotate(5deg) scale(1.3);
  }
  .blog-card:hover.alt .photo {
    -webkit-transform: rotate(-5deg) scale(1.3);
            transform: rotate(-5deg) scale(1.3);
  }
  .blog-card.alt .details {
    padding-left: 30px;
  }
  .blog-card.alt .description {
    float: right;
  }
  .blog-card.alt .description:before {
    -webkit-transform: skewX(5deg);
            transform: skewX(5deg);
    right: -15px;
    left: inherit;
  }
  .blog-card.alt .photo {
    float: right;
  }
  .blog-card .photo {
    transition: all 0.5s ease;
    -webkit-transition: all 0.5s ease;
    float: left;
    width: 40%;
  }
  .blog-card .details {
    width: 40%;
  }
  .blog-card .description {
    float: left;
    width: 60%;
    z-index: 0;
    min-height: 200px;
  }
  .blog-card .description:before {
    -webkit-transform: skewX(-5deg);
            transform: skewX(-5deg);
    content: "";
    background: #fff;
    width: 100%;
    z-index: -1;
    /*POSITION*/
    position: absolute;
    left: -15px;
    top: 0;
    bottom: 0;
  }
}

</style>
