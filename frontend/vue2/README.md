[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

This project is started using RealWorld github repository [RealWorld](https://github.com/gothinkster/realworld) VueJS project.

## Getting started

Before contributing please read the following:

1. [RealWorld guidelines](https://github.com/gothinkster/realworld/tree/master/spec) for implementing a new framework,
2. [RealWorld frontend instructions](https://github.com/gothinkster/realworld-starter-kit/blob/master/FRONTEND_INSTRUCTIONS.md)
3. [Realworld API endpoints](https://github.com/gothinkster/realworld/tree/master/api)
4. [Vue.js styleguide](https://vuejs.org/v2/style-guide/index.html). Priority A and B categories must be respected.

The stack is built using [vue-cli webpack](https://github.com/vuejs-templates/webpack) so to get started all you have to do is:

``` bash
# install dependencies
> yarn install
# serve with hot reload at localhost:8080
> yarn serve
```

Other commands available are:

``` bash
# build for production with minification
yarn run build

# run unit tests
yarn run test:unit
```

I have put a build.gradle that can create a docker image to serve this JS application using nginx server.

gradle clean dockerBuild

clean.sh file is there to make life easy while you are experimenting.
create-config-file.sh file is there so that it will create a config.js file in target directory which is then included into index.html, so that you can pass API_URL etc from environment variables.

# To know

Current arbitrary choices are:

- Vuex modules for store
- Vue-axios for ajax requests
- 'rwv' as prefix for components

These can be changed when the contributors reach a consensus.


