<template>
	<div style="width: 100%">
		<div class="carousel" ref="carouselRoot" :data-gap="gap">
		    <figure>
		  	  <img v-for="t in items" :src="t.src" :alt="t.alt">
			</figure>
		    <nav>
		        <button class="nav prev">Prev</button>
		        <button class="nav next">Next</button>
		    </nav>
		</div>
    </div>
</template>

<script>
	export default {
	    name: "Carousel",
	    props: {
	    	items: {
	    		type: Array,
	    		required: true
	    	},
	    	gap: { type: String, required: false }
	    },
	    data() {
	    	return {
	    		autorotate: true,
	    		currImage: 0,
	    		direction: +1
	    	}
	    },
	    updated() {
	    	console.log('update')
	    },

	    created() {
	    	console.log('created')
	    },

	    mounted() {
	    	console.log('mounted')
	    	const carousel = this.carousel(this.$refs.carouselRoot);
	    	const me = this;
	    	const N = this.$props.items.length;
			
	    	this.timer = setInterval(() => {
	    		/*if(me.currImage == N-1) {
	    			me.direction = -1;
	    		}
	    		if(me.currImage == 0) me.direction = +1;*/

	    		me.currImage = me.currImage + me.direction;
	    		me.currImage = me.currImage % N;
	    		carousel.rotate(me.currImage);
	    	}, 2000)
	    },

	    methods: {
	    	carousel(root) {
			    var
			        figure = root.querySelector('figure'),
			        nav = root.querySelector('nav'),
			        images = figure.children,
			        n = images.length,
			        gap = root.dataset.gap || 0,
			        bfc = 'bfc' in root.dataset,
			        
			        theta =  2 * Math.PI / n,
			        currImage = 0
			    ;
			    
			    setupCarousel(n, parseFloat(getComputedStyle(images[0]).width));
			    window.addEventListener('resize', () => { 
			        setupCarousel(n, parseFloat(getComputedStyle(images[0]).width)) 
			    });

			    setupNavigation();

			    function setupCarousel(n, s) {
			        var 
			            apothem = s / (2 * Math.tan(Math.PI / n))
			        ;
			        
			        figure.style.transformOrigin = `50% 50% ${- apothem}px`;

			        for (var i = 0; i < n; i++)
			            images[i].style.padding = `${gap}px`;
			        for (i = 1; i < n; i++) {
			            images[i].style.transformOrigin = `50% 50% ${- apothem}px`;
			            images[i].style.transform = `rotateY(${i * theta}rad)`;
			        }
			        if (bfc)
			            for (i = 0; i < n; i++)
			                 images[i].style.backfaceVisibility = 'hidden';
			        
			        rotateCarousel(currImage);
			    }

			    function setupNavigation() {
			        nav.addEventListener('click', onClick, true);
			        
			        function onClick(e) {
			            e.stopPropagation();
			            
			            var t = e.target;
			            if (t.tagName.toUpperCase() != 'BUTTON')
			                return;
			            
			            if (t.classList.contains('next')) {
			                currImage++;
			            }
			            else {
			                currImage--;
			            }
			            
			            rotateCarousel(currImage);
			        }
			            
			    }

			    function rotateCarousel(imageIndex) {
			        figure.style.transform = `rotateY(${imageIndex * -theta}rad)`;
			    }
			    
			    return {
			    	rotate: rotateCarousel
			    }
			}
	    }
	};

</script>

<style>
	.carousel {
	  padding: 20px;
	  -webkit-perspective: 500px;
	          perspective: 500px;
	  overflow: hidden;
	  display: flex;
	  flex-direction: column;
	  align-items: center;
	}
	.carousel > * {
	  flex: 0 0 auto;
	}
	.carousel figure {
	  margin: 0;
	  width: 40%;
	  -webkit-transform-style: preserve-3d;
	          transform-style: preserve-3d;
	  transition: -webkit-transform 0.5s;
	  transition: transform 0.5s;
	  transition: transform 0.5s, -webkit-transform 0.5s;
	}
	.carousel figure img {
	  width: 100%;
	  box-sizing: border-box;
	  padding: 0 0px;
	}
	.carousel figure img:not(:first-of-type) {
	  position: absolute;
	  left: 0;
	  top: 0;
	}
	.carousel nav {
	  display: flex;
	  justify-content: center;
	  margin: 20px 0 0;
	}
	.carousel nav button {
	  flex: 0 0 auto;
	  margin: 0 5px;
	  cursor: pointer;
	  color: #333;
	  background: none;
	  border: 1px solid;
	  letter-spacing: 1px;
	  padding: 5px 10px;
	}   
</style>
