FROM node:18-alpine
WORKDIR /app
COPY package.json ./
COPY backend/package.json ./backend/
RUN npm install
RUN npm install --prefix backend
COPY . .
EXPOSE 3000
CMD [ "node", "backend/server.js" ]