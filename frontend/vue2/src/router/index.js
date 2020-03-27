import Vue from "vue";
import Router from "vue-router";

Vue.use(Router);

export default new Router({
  mode: 'history',
  routes: [
    {
      path: "/",
      component: () => import("@/views/Home"),
      children: [
        /*{
          path: "my-feed",
          name: "home-my-feed",
          component: () => import("@/views/HomeMyFeed")
        }*/
      ]
    },
    {
      name: "home",
      path: "/",
      component: () => import("@/views/Home")
    },
    {
      name: "login",
      path: "/login",
      component: () => import("@/views/Login")
    },
    {
      name: "register",
      path: "/register",
      component: () => import("@/views/Register")
    },
    {
      name: "settings",
      path: "/settings",
      component: () => import("@/views/Settings")
    },
    {
     name: 'aboutme', 
     path: '/aboutme',
     component: () => import("@/views/Aboutme"),
     props: true
    },
    // Handle child routes with a default, by giving the name to the
    // child.
    // SO: https://github.com/vuejs/vue-router/issues/777
    
    {
      name: 'profile',
      path: "/@:username",
      component: () => import("@/views/Profile"),
      children: [
        // {
        //   path: "",
        //   name: "profileArticles",
        //   component: () => import("@/views/ProfileArticles")
        // },
        // {
        //   name: "profile-favorites",
        //   path: "favorites",
        //   component: () => import("@/views/ProfileFavorited")
        // }
      ]
    },
    {
      name: "articles",
      path: "/articles/:slug",
      component: () => import("@/views/Articles"),
      props: true
    },
    {
      name: "article",
      path: "/article/:id",
      component: () => import("@/views/Article"),
      props: true
    },
    {
      name: "article-preview",
      path: "/preview/article",
      component: () => import("@/views/ArticlePreview"),
      props: true
    },
    {
      name: "article-edit",
      path: "/editor/:slug?",
      props: true,
      component: () => import("@/views/ArticleEdit")
    }
  ]
});
