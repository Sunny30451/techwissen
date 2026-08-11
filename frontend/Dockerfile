FROM node:24.18.1-bookworm-slim AS build
WORKDIR /app

ARG APP_BASE_PATH=/tech-prod
ENV APP_BASE_PATH=${APP_BASE_PATH}

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.29-alpine
ENV APP_BASE_PATH=/tech-prod
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
