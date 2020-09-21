import Vue from 'vue'

import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-vue/dist/bootstrap-vue.css'

import { 
    BootstrapVue, 
    BIcon, 
    BIconInfoSquare, 
    BIconInfoSquareFill,
} from 'bootstrap-vue'

Vue.use(BootstrapVue)
Vue.component('BIcon', BIcon)
Vue.component('BIconInfoSquare', BIconInfoSquare)
Vue.component('BIconInfoSquareFill', BIconInfoSquareFill)


// Optionally install the BootstrapVue icon components plugin