<template>
  <footer>
    <div class="container">
      <span class="attribution">
        A personal project out of boredom from: 
      </span>
      <router-link class="logo-font"
        :to="{ name: 'aboutme', params: {} }">
        Satyendra Kumar
      </router-link>
      <span class="attribution"> See this project on <a class="logo-font" href="" target="_blank">Github </a>. </span>
    </div>
  </footer>
</template>

<script>
export default {
  name: "rwvFooter"
};
</script>
