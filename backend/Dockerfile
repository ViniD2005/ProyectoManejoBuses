# Backend de Pasajes Ecuador (CC-18)
FROM node:22-alpine

# Zona horaria de Ecuador para fechas de viajes y boletos
RUN apk add --no-cache tzdata
ENV TZ=America/Guayaquil

WORKDIR /app

# Primero las dependencias (se reutilizan si package.json no cambia)
COPY package.json package-lock.json ./
RUN npm ci

COPY src ./src
RUN mkdir -p uploads

EXPOSE 3000
CMD ["npm", "start"]
