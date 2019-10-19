<template>
	<div style="width: 100%">
		<Carousel autoplay>
			<slide class="slide" v-for="(t,index) in items" :index="index" :key="t.key" onMainSlideClick="onClick">
				<img :src="t.src">
				<div class="centerize">
					<router-link :to="t.route"  :key="t.key"class="slide-btn">Explore
					</router-link>
				</div>
			</slide>
		</Carousel>
    </div>
</template>

<script>
import { Carousel3d, Slide } from 'vue-carousel-3d';

export default {
  name: "HomePage",
  components:  {
  	Carousel: Carousel3d,
  	Slide: Slide
  },
  props: [  ],
    data() {
        return {
          items : [
	          	{src: "https://storage.googleapis.com/cupitor-220103.appspot.com/images/java_800x500.jpg", route: '/articles/java', key: 'java'},
	          	{src: "https://storage.googleapis.com/cupitor-220103.appspot.com/images/devops_800x500.jpg", route: '/articles/devops', key: 'devops'},
	          	{src: "https://storage.googleapis.com/cupitor-220103.appspot.com/images/algorithms_800x500.jpg", route: '/articles/algos', key: 'algos'},
	          	{src: "https://storage.googleapis.com/cupitor-220103.appspot.com/design_800x500.jpg", route: '/articles/architecture', key: 'architecture'},
	          	{src: "https://storage.googleapis.com/cupitor-220103.appspot.com/images/ai_800x500.jpg", route: '/articles/ai', key: 'ai'},
	          	{src: "https://storage.googleapis.com/cupitor-220103.appspot.com/images/philosophy_800x500.jpg", route: '/articles/philosophy', key: 'phil'},
	          	{src: "https://storage.googleapis.com/cupitor-220103.appspot.com/images/psychology_800x500.jpg", route: '/articles/psychology', key: 'psy'}
	          ]
        }
    },
    updated() {

    },
    mounted() {

    },
    methods: {
    	onClick(){
    		console.log()
    	}
    }
};
</script>

<style>
    .list1{
        float: left;
        clear: both;
    }
    .list-item-1{
        clear: left;
    }
    .floatleft{
        float: left;
    }
    .list-item-2{
        margin-top: 20px;
        float: left;
        clear: right;
        margin: 20px;
        padding: 5px;
        cursor: pointer;
        text-align: center;
    }
	.list-item-2 .caption{
		border-radius: 8px;
		background: #f8f8f9;
		border: 0.4px solid grey;
		-webkit-box-shadow: -12px 10px 5px 0px rgba(153,150,153,1);
        -moz-box-shadow: -12px 10px 5px 0px rgba(153,150,153,1);
        box-shadow: -12px 10px 5px 0px rgba(153,150,153,1);
		padding: 10px;
		margin-top: 30px;
	}
    
    .list-item-2>img:hover{
		-webkit-box-shadow: 0px -10px 44px 12px rgba(162,190,232,1);
		-moz-box-shadow: 0px -10px 44px 12px rgba(162,190,232,1);
		box-shadow: 0px -10px 44px 12px rgba(162,190,232,1);
		transform: scale(1.3);
		transition: all .2s ease-in-out; 
    }
    .noliststyle{
        list-style: none;
    }

    @media (max-width: 767px) {
    	.list-item-2 {
    		width: 70%;
    	}
    }

    .slide-btn {
    	position: absolute;
    	top: 0;
	    margin-top: 30%;
	    padding: 10px;
	    background: white;
	    border: 1px solid black;
	    margin-left: 40%;
	    margin-right: auto;
	    display: none;
    }

    .centerize {
	    display: block;
	    margin: 0 auto;
	    text-align: center;
	}

	.slide.current:hover .slide-btn {
		display: block;
	}
</style>
