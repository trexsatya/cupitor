
Run these commands on command line:
		npm i -g yarn 
		./gradlew dockerBuild
		docker tag frontend:latest trexsatya/cupitor-frontend-vuejs:latest
		docker push trexsatya/cupitor-frontend-vuejs:latest

[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

This project is started using RealWorld github repository [RealWorld](https://github.com/gothinkster/realworld) VueJS project.

VueJS Lifecycle:
	[![VueJS Documentation](https://vuejs.org/v2/guide/instance.html)]


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


