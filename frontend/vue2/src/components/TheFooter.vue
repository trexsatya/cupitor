<template>
  <footer>
    <div class="container">
      <span class="attribution">
        A personal project out of boredom from: 
      </span>
      <router-link class="logo-font"
        :to="{ name: 'home', params: {} }">
        Satyendra Kumar
      </router-link>
    </div>
  </footer>
</template>

<script>
export default {
  name: "rwvFooter"
};
</script>
