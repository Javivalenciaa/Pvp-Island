FROM node:22-alpine
WORKDIR /app
COPY shared ./shared
COPY server ./server
RUN cd server && npm ci --omit=dev
ENV PORT=8080 DATA_DIR=/data
VOLUME /data
EXPOSE 8080
CMD ["node", "server/src/index.js"]
