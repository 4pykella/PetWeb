FROM nginx:latest
WORKDIR /
RUN apt install npm
RUN npm install
COPY html /var/www/
COPY nginx.conf /etc/nginx/nginx.conf
WORKDIR /var/www/miki
RUN npm run generate
RUN nginx -t
RUN sudo systemctl reload nginx
EXPOSE 80 443
