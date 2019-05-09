<template>
    <div class="profile-page">
        <div class="user-info">
            <div class="container">
                <div class="row">
                    <div class="col-xs-12 col-md-10 offset-md-1">
                        <img :src="profile.image" class="user-img"/>
                        <h4>Satyendra Kumar</h4>
                        <p style="color: black;">
I am a Software Engineer by profession. But I try not be limited to computers. All of engineering, science, philosophy, psychology is interesting to me.
                        </p>
                        
                        
                    </div>
                </div>
                <div class="row">

                  <div class="col-xs-12 col-md-10 offset-md-1" style="margin-top: 3%;">
                      My Online Presence:
                      <link rel="stylesheet" href="https://d1azc1qln24ryf.cloudfront.net/114779/Socicon/style-cf.css?rd5re8">    
                      <ul class="socicons-list">
                          <li>
                            <a href='https://www.linkedin.com/in/satyendra-kumar-54671058/' target='_blank'><span class="socicon-linkedin"></span></a> 
                          </li>
                            <li>
                            <a href='https://github.com/trexsatya' target='_blank'><span class="socicon-github"></span></a> 
                          </li> 
                          <li>
                            <a href='https://stackoverflow.com/users/5332993/satyendra-kumar' target='_blank'><span class="socicon-stackoverflow"></span></a> 
                          </li>
                          <li>
                            <a href='https://www.facebook.com/kumarsatya1990' target='_blank'><span class="socicon-facebook"></span></a> 
                          </li>   
                          <li>
                            <a href='https://stackexchange.com/users/5160541/satyendra-kumar' target='_blank'><span class="socicon-stackexchange"></span></a> 
                          </li>   
                          <li>
                            <a href='mailto:kumarsatya1990@gmail.com' target='_blank'><span class="socicon-google"></span></a> 
                          </li>
                      </ul>
                  </div>
                  <div class="col-xs-12 col-md-10 offset-md-1" style="margin-top: 3%;">
                    <h3>Things I would like to do before I die.</h3>
                    <p style="color: black;">
                      Apart from understanding how the world functions, I would also like to make a positive impact on this, genuinely positive(without any selfishness, and without prejudice).
                    </p>
                  </div>
                </div>
            </div>
        </div>
    </div>

</template>

<script>
import { mapGetters } from "vuex";
import {
  FETCH_PROFILE,
  FETCH_PROFILE_FOLLOW,
  FETCH_PROFILE_UNFOLLOW
} from "@/store/actions.type";

export default {
  name: "RwvProfile",
  mounted() {
    this.$store.dispatch(FETCH_PROFILE, this.$route.params);
  },
  computed: {
    ...mapGetters(["currentUser", "profile", "isAuthenticated"])
  },
  methods: {
    isCurrentUser() {
      if (this.currentUser.username && this.profile.username) {
        return this.currentUser.username === this.profile.username;
      }
      return false;
    },
    follow() {
      if (!this.isAuthenticated) return;
      this.$store.dispatch(FETCH_PROFILE_FOLLOW, this.$route.params);
    },
    unfollow() {
      this.$store.dispatch(FETCH_PROFILE_UNFOLLOW, this.$route.params);
    }
  },
  watch: {
    $route(to) {
      this.$store.dispatch(FETCH_PROFILE, to.params);
    }
  }
};
</script>

<style>
  .socicons-list{
    list-style: none;
    margin-left: auto;
    margin-right: auto;
    text-align: center;
    height: 100%;
  }

  .socicons-list li{
    display: inline-block;
    float: left;
    margin-left: 2%; 
    margin-right: 2%;
  }
  
</style>