FROM node:14

ENV APP_ROOT /src

RUN mkdir -p ${APP_ROOT}
WORKDIR ${APP_ROOT}
ADD . ${APP_ROOT}
COPY package.json /src

RUN yarn install
RUN yarn build

ENV HOST 0.0.0.0
