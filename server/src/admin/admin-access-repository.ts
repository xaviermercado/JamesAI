import { randomUUID } from 'node:crypto';

import type { Pool } from 'mysql2';

import type { AdminRole, AuthAccountStatus } from '../auth/auth-types';

type PromisePool = ReturnType<Pool['promise']>;

export interface AdminAccessItem {
  userId: string;
  email: string;
  accountStatus: AuthAccountStatus;
  adminRole: AdminRole;
  updatedAt: Date;
}

export type AdminRoleUpdateResult =
  | { status: 'updated'; item: AdminAccessItem; revokedSessions: number }
  | { status: 'not_found' | 'last_owner' };

export interface AdminAccessRepositoryLike {
  listAccessCandidates(limit: number, offset: number): Promise<AdminAccessItem[]>;
  updateAdminRole(targetUserId: string, role: AdminRole, actorUserId: string | null): Promise<AdminRoleUpdateResult>;
  provisionOwnerByEmail(email: string): Promise<AdminRoleUpdateResult>;
}

function mapItem(row: Record<string, unknown>): AdminAccessItem {
  return {
    userId: String(row.user_id),
    email: String(row.email),
    accountStatus: row.account_status as AuthAccountStatus,
    adminRole: row.admin_role as AdminRole,
    updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(String(row.updated_at)),
  };
}

export class AdminAccessRepository implements AdminAccessRepositoryLike {
  constructor(private readonly pool: PromisePool) {}

  async listAccessCandidates(limit: number, offset: number): Promise<AdminAccessItem[]> {
    const [rows] = await this.pool.query(
      `SELECT user_id, email, account_status, admin_role, updated_at
       FROM users
       WHERE account_status = 'active'
       ORDER BY CASE admin_role WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END, email ASC
       LIMIT ? OFFSET ?`,
      [limit, offset],
    );
    return (rows as Array<Record<string, unknown>>).map(mapItem);
  }

  updateAdminRole(targetUserId: string, role: AdminRole, actorUserId: string | null): Promise<AdminRoleUpdateResult> {
    return this.updateRole('user_id = ?', targetUserId, role, actorUserId);
  }

  provisionOwnerByEmail(email: string): Promise<AdminRoleUpdateResult> {
    return this.updateRole('email = ?', email, 'owner', null);
  }

  private async updateRole(
    selector: 'user_id = ?' | 'email = ?',
    selectorValue: string,
    role: AdminRole,
    actorUserId: string | null,
  ): Promise<AdminRoleUpdateResult> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query(
        `SELECT user_id, email, account_status, admin_role, updated_at FROM users WHERE ${selector} LIMIT 1 FOR UPDATE`,
        [selectorValue],
      );
      const currentRow = (rows as Array<Record<string, unknown>>)[0];
      if (!currentRow) {
        await connection.rollback();
        return { status: 'not_found' };
      }
      const current = mapItem(currentRow);
      if (current.adminRole === 'owner' && role !== 'owner') {
        const [ownerRows] = await connection.query(
          "SELECT COUNT(*) AS total FROM users WHERE admin_role = 'owner' AND account_status = 'active' FOR UPDATE",
        );
        if (Number((ownerRows as Array<Record<string, unknown>>)[0]?.total ?? 0) <= 1) {
          await connection.rollback();
          return { status: 'last_owner' };
        }
      }

      await connection.query('UPDATE users SET admin_role = ?, updated_at = NOW(3) WHERE user_id = ?', [role, current.userId]);
      const [revokeResult] = await connection.query(
        'UPDATE user_sessions SET revoked_at = NOW(3) WHERE user_id = ? AND revoked_at IS NULL',
        [current.userId],
      );
      await connection.query(
        `INSERT INTO james_admin_audit_log
          (audit_id, actor_user_id, action, target_type, target_id, outcome, summary_json, occurred_at)
         VALUES (?, ?, 'admin_role_changed', 'administrator', ?, 'succeeded', ?, NOW(3))`,
        [randomUUID(), actorUserId, current.userId, JSON.stringify({ previousRole: current.adminRole, role })],
      );
      const [updatedRows] = await connection.query(
        'SELECT user_id, email, account_status, admin_role, updated_at FROM users WHERE user_id = ? LIMIT 1',
        [current.userId],
      );
      await connection.commit();
      return {
        status: 'updated',
        item: mapItem((updatedRows as Array<Record<string, unknown>>)[0]!),
        revokedSessions: (revokeResult as { affectedRows?: number }).affectedRows ?? 0,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}