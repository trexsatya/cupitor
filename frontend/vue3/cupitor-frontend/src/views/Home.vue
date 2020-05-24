<template>
<div class="home">
  <b-container class="top-container">
    <b-row class="header">
      <b-col style="">
        <span class="prefix"> simply</span>
        <span class="logo">Living to Learn </span> </b-col>
    </b-row>
    <div role="tablist" class="tablist">
      <b-card no-body class="mb-1">
        <b-card-header header-tag="header" class="p-1" role="tab">
          <b-button block v-b-toggle.accordion-1 variant="info" style="padding:0; margin:0">

            <span class="subject"> Engineering</span>
          </b-button>

        </b-card-header>
        <b-collapse id="accordion-1" visible accordion="my-accordion" role="tabpanel">
          <b-card-body>
            <b-card header="Computer Engineering">
              <b-list-group class="header-minor">
                <b-list-group-item>
                  <b-link to="articles/java">Programming </b-link>
                </b-list-group-item>
                <b-list-group-item>
                  <b-link to="articles/algos">Algorithms & Problem-Solving </b-link>
                </b-list-group-item>
                <b-list-group-item>
                  <b-link to="articles/devops">DevOps </b-link>
                </b-list-group-item>
                <b-list-group-item>
                  <b-link to="articles/ai">Artificial Intelligence </b-link>
                </b-list-group-item>
                <b-list-group-item>
                  <b-link to="articles/architecture">Design & Architecture </b-link>
                </b-list-group-item>
              </b-list-group>
              <p class="card-text mt-2">
              </p>
            </b-card>
          </b-card-body>
        </b-collapse>
      </b-card>

      <b-card no-body class="mb-1">
        <b-card-header header-tag="header" class="p-1" role="tab">
          <b-button block v-b-toggle.accordion-2 variant="info" style="padding:0; margin:0">

            <span class="subject"> Science</span>
          </b-button>
        </b-card-header>
        <b-collapse id="accordion-2" accordion="my-accordion" role="tabpanel">
          <b-card-body>
            <b-list-group class="header-minor">
              <b-list-group-item href="#">
                <b-link to="articles/life-science">Science of Life </b-link>
              </b-list-group-item>

              <b-list-group-item href="#">
                <b-link to="articles/psychology">Science of Psyche</b-link>
              </b-list-group-item>

            </b-list-group>

            <p class="card-text mt-2">
            </p>
          </b-card-body>
        </b-collapse>
      </b-card>

      <b-card no-body class="mb-1">
        <b-card-header header-tag="header" class="p-1" role="tab">
          <b-button block v-b-toggle.accordion-3 variant="info" style="padding:0; margin:0">

            <span class="subject"> Philosophy</span>
          </b-button>

        </b-card-header>
        <b-collapse id="accordion-3" accordion="my-accordion" role="tabpanel">
          <b-card-body>
            <b-list-group class="header-minor">

              <b-list-group-item href="#">
                <b-link to="articles/philosophy">Miscellaneous</b-link>
              </b-list-group-item>
            </b-list-group>
          </b-card-body>
        </b-collapse>
      </b-card>
    </div>
  </b-container>
</div>
</template>

<script>
// @ is an alias to /src

export default {
  name: 'Home',
  components: {

  },
};
</script>

<style scoped>
.header {
  margin-bottom: 2%;
}

.prefix {
  margin: 2vw;
  color: blue;
  font-size: 5vw;
  font-family: myFirstFont;
}

.logo {
  font-family: myFirstFont;
  font-size: 14vw;
  font-weight: 900;
  color: #1e5384;
}

.subject {
  font-size: 8vw;
  font-weight: bold;

}

.header-minor {
  font-weight: bolder;
  font-size: 1rem;
}

.tablist {
  width: 60vw;
  margin: auto;
}

@media (max-width: 767px) {
  .tablist {
    width: 80vw;
    margin: auto;
  }
}
</style>
