#!/bin/bash
echo "Creating config file using using environment variables $(env | grep __js_config__)"
for var in $(env | grep __js_config__ ); do
  echo $var | awk -F '__js_config__' '{ print $2}' | awk -F '=' '{ printf "%s=\x27%s\x27\n", $1, $2};' >> /var/www/config.js
done

nginx
