FROM nginx:stable
COPY ./dist/ /var/www
COPY ./create-config-file.sh /root/
RUN chmod +x /root/create-config-file.sh
RUN /root/create-config-file.sh
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
RUN echo "daemon off;" >> /etc/nginx/nginx.conf
CMD [ "/root/create-config-file.sh" ]
