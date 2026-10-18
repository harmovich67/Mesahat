import { DataTypes as T } from 'sequelize';

const id = () => ({ type: T.UUID, defaultValue: T.UUIDV4, primaryKey: true });

export function defineIdentity(sequelize) {
  const User = sequelize.define('User', {
    id: id(),
    name: { type: T.STRING(120), allowNull: false },
    email: { type: T.STRING(190), allowNull: false, unique: true },
    phone: { type: T.STRING(30) },
    password_hash: { type: T.STRING(120), allowNull: false },
    locale: { type: T.STRING(5), defaultValue: 'ar' },
    status: { type: T.ENUM('active', 'suspended'), defaultValue: 'active' },
    is_staff: { type: T.BOOLEAN, defaultValue: false },
    avatar_url: { type: T.STRING(500) },
    company: { type: T.STRING(160) },
    last_login_at: { type: T.DATE },
  }, { tableName: 'users', indexes: [{ fields: ['is_staff'] }] });

  const Role = sequelize.define('Role', {
    id: id(),
    key: { type: T.STRING(40), allowNull: false, unique: true },
    name: { type: T.JSONB, allowNull: false },
    description: { type: T.JSONB },
    is_system: { type: T.BOOLEAN, defaultValue: false },
  }, { tableName: 'roles' });

  const Permission = sequelize.define('Permission', {
    id: id(),
    key: { type: T.STRING(60), allowNull: false, unique: true },
    group: { type: T.STRING(40), allowNull: false },
    description: { type: T.JSONB },
  }, { tableName: 'permissions' });

  const RolePermission = sequelize.define('RolePermission', {
    role_id: { type: T.UUID, primaryKey: true },
    permission_id: { type: T.UUID, primaryKey: true },
  }, { tableName: 'role_permissions', timestamps: false });

  const UserRole = sequelize.define('UserRole', {
    user_id: { type: T.UUID, primaryKey: true },
    role_id: { type: T.UUID, primaryKey: true },
  }, { tableName: 'user_roles', updatedAt: false });

  const RefreshToken = sequelize.define('RefreshToken', {
    id: id(),
    user_id: { type: T.UUID, allowNull: false },
    token_hash: { type: T.STRING(100), allowNull: false, unique: true },
    expires_at: { type: T.DATE, allowNull: false },
    revoked_at: { type: T.DATE },
    user_agent: { type: T.STRING(300) },
  }, { tableName: 'refresh_tokens', updatedAt: false, indexes: [{ fields: ['user_id'] }] });

  return { User, Role, Permission, RolePermission, UserRole, RefreshToken };
}
