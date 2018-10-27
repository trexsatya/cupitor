<template>
  <div style="">
     <ul class="mybreadcrumb">
       <li v-for="item in items">
        <router-link :to="item.route">
            {{ item.name }}
        </router-link>
       </li>
     </ul>
   </div>
</template>

<script>
export default {
    name: "breadcrumb",
    props: [ 'items', 'onClick' ],
    data() {
        return {
          counter: 0
        }
    },
    updated() {
        // Fired every second, should always be true
        //console.log(this.counter)
    },
    created() {

    }
};
</script>

<style>
.mybreadcrumb {
    list-style: none;
    overflow: hidden;
    font: 12px Sans-Serif;
    padding-left: 0;
}
.mybreadcrumb li {
    float: left;
}
.mybreadcrumb li a {
    color: white;
    text-decoration: none;
    padding: 10px 0 10px 65px;
    background: brown; /* fallback color */
    background: hsla(34,85%,35%,1);
    position: relative;
    display: block;
    float: left;
}
.mybreadcrumb li a::after {
  content: " ";
  display: block;
  width: 0;
  height: 0;
  border-top: 50px solid transparent; /* Go big on the size, and let overflow hide */
  border-bottom: 50px solid transparent;
  border-left: 30px solid hsla(34,85%,35%,1);
  position: absolute;
  top: 50%;
  margin-top: -50px;
  left: 100%;
  z-index: 2;
}
.mybreadcrumb li a::before {
  content: " ";
  display: block;
  width: 0;
  height: 0;
  border-top: 50px solid transparent;
  border-bottom: 50px solid transparent;
  border-left: 30px solid white;
  position: absolute;
  top: 50%;
  margin-top: -50px;
  margin-left: 1px;
  left: 100%;
  z-index: 1;
}
.mybreadcrumb li:first-child a {
  padding-left: 10px;
}
.mybreadcrumb li:nth-child(2) a       { background:        hsla(34,85%,45%,1); }
.mybreadcrumb li:nth-child(2) a:after { border-left-color: hsla(34,85%,45%,1); }
.mybreadcrumb li:nth-child(3) a       { background:        hsla(34,85%,55%,1); }
.mybreadcrumb li:nth-child(3) a:after { border-left-color: hsla(34,85%,55%,1); }
.mybreadcrumb li:nth-child(4) a       { background:        hsla(34,85%,65%,1); }
.mybreadcrumb li:nth-child(4) a:after { border-left-color: hsla(34,85%,65%,1); }
.mybreadcrumb li:nth-child(5) a       { background:        hsla(34,85%,75%,1); }
.mybreadcrumb li:nth-child(5) a:after { border-left-color: hsla(34,85%,75%,1); }
.mybreadcrumb li:last-child a {
  background: transparent !important;
  color: black;
  pointer-events: none;
  cursor: default;
}
.mybreadcrumb li:last-child a::after {
  border: 0;
}
.mybreadcrumb li a:hover {
  background: hsla(34, 85%, 25%, 1);
}
.mybreadcrumb li a:hover:after {
  border-left-color: hsla(34, 85%, 25%, 1) !important;
}


</style>