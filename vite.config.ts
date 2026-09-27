import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { createHealthMiddleware } from './server/healthMiddleware.ts';
import { createEmbeddingMiddleware } from './server/embeddingMiddleware.ts';
import { createSearchMiddleware } from './server/searchMiddleware.ts';
import { createAnswerMiddleware } from './server/answerMiddleware.ts';
import { createChatMiddleware } from './server/chatMiddleware.ts';
import { createTopicMiddleware } from './server/topicMiddleware.ts';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      {
        name: 'server-embedding-api',
        configureServer(server) {
          server.middlewares.use(createHealthMiddleware(env));
          server.middlewares.use(createEmbeddingMiddleware(env));
          server.middlewares.use(createSearchMiddleware(env));
          server.middlewares.use(createAnswerMiddleware(env));
          server.middlewares.use(createChatMiddleware(env));
          server.middlewares.use(createTopicMiddleware(env));
        },
        configurePreviewServer(server) {
          server.middlewares.use(createHealthMiddleware(env));
          server.middlewares.use(createEmbeddingMiddleware(env));
          server.middlewares.use(createSearchMiddleware(env));
          server.middlewares.use(createAnswerMiddleware(env));
          server.middlewares.use(createChatMiddleware(env));
          server.middlewares.use(createTopicMiddleware(env));
        },
      },
    ],
  };
});
