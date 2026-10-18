import { Sequelize } from 'sequelize';
import { config } from './env.js';

export const sequelize = new Sequelize(config.databaseUrl, {
  dialect: 'postgres',
  logging: false,
  define: { underscored: true, timestamps: true },
  pool: { max: 20, min: 0, idle: 10_000, acquire: 30_000 },
  timezone: '+00:00',
});
