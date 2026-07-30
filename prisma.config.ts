import { defineConfig } from 'prisma/config';
import { config } from 'dotenv';

config();

export default defineConfig({
  schema: 'src/prisma/',
  datasource: {
    url: process.env.DATABASE_URL!,
  },
  migrations: {
    path: 'src/prisma/migrations',
  },
});
