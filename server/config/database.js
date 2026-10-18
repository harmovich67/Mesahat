import { Sequelize } from 'sequelize';
import { config } from './env.js';

const isLocal = config.databaseUrl.includes('127.0.0.1') || config.databaseUrl.includes('localhost');

export const sequelize = new Sequelize(config.databaseUrl, {
  dialect: 'postgres',
  logging: false,
  define: { underscored: true, timestamps: true },
  pool: { max: 20, min: 0, idle: 10_000, acquire: 30_000 },
  timezone: '+00:00',
  dialectOptions: isLocal ? {} : {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
});
