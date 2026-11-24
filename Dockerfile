FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/nginx.conf
COPY dist/ /srv/atlas/
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=3s CMD wget -q -O /dev/null http://127.0.0.1:8080/index.html || exit 1
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
