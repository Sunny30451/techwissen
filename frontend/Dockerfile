FROM node:24.18.1-bookworm-slim AS build
WORKDIR /workspace/frontend

ARG APP_BASE_URL
ENV APP_BASE_URL=${APP_BASE_URL}

COPY frontend/package*.json ./
RUN npm install

WORKDIR /workspace
COPY . .

WORKDIR /workspace/frontend
RUN npm run build \
    && mkdir -p /tmp/techwissen \
    && node scripts/app-base-url.mjs --path > /tmp/techwissen/app-base-path

FROM nginx:1.29-alpine
ARG APP_BASE_URL
ENV APP_BASE_URL=${APP_BASE_URL}

RUN rm -f /etc/nginx/conf.d/default.conf \
    && mkdir -p /etc/techwissen

COPY frontend/nginx.conf /etc/techwissen/nginx.conf.template
COPY frontend/docker-entrypoint.d/40-techwissen-app-base-url.sh /docker-entrypoint.d/40-techwissen-app-base-url.sh
COPY --from=build /workspace/frontend/dist /usr/share/nginx/html
COPY --from=build /tmp/techwissen/app-base-path /etc/techwissen/app-base-path

RUN chmod +x /docker-entrypoint.d/40-techwissen-app-base-url.sh

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
