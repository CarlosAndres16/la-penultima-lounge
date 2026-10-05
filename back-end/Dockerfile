FROM node:20
WORKDIR /app

COPY package*.json ./
COPY gateway/package.json gateway/
COPY services/auth/package.json services/auth/
COPY services/sedes/package.json services/sedes/
COPY packages/common/package.json packages/common/
RUN npm install

COPY . .