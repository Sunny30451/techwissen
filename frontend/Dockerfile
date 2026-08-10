FROM node:24.18.1-bookworm-slim AS build
WORKDIR /app
ARG APP_BASE_URL=/
ENV APP_BASE_URL=${APP_BASE_URL}
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.29-alpine
ENV APP_BASE_URL=/ \
    NGINX_ENVSUBST_FILTER=APP_BASE_PATH_REGEX
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY 15-app-base-url.envsh /docker-entrypoint.d/15-app-base-url.envsh
RUN chmod +x /docker-entrypoint.d/15-app-base-url.envsh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]