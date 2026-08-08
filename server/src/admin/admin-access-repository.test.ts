import { describe, expect, it, vi } from 'vitest';

import { AdminAccessRepository } from './admin-access-repository';

describe('AdminAccessRepository', () => {
  it('lists a bounded page of active access candidates including non-admin users', async () => {
    const query = vi.fn(async () => [[{
      user_id: 'user-id', email: 'member@example.com', account_status: 'active', admin_role: 'user', updated_at: new Date(),
    }]]);
    const repository = new AdminAccessRepository({ query } as never);

    await expect(repository.listAccessCandidates(25, 50)).resolves.toMatchObject([
      { userId: 'user-id', adminRole: 'user' },
    ]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("WHEN 'owner'"), [25, 50]);
  });

  it('updates role, revokes sessions, and appends audit in one transaction', async () => {
    const queries: string[] = [];
    const connection = {
      beginTransaction: vi.fn(async () => undefined),
      commit: vi.fn(async () => undefined),
      rollback: vi.fn(async () => undefined),
      release: vi.fn(),
      query: vi.fn(async (sql: string) => {
        queries.push(sql);
        if (sql.includes('LIMIT 1 FOR UPDATE')) return [[{
          user_id: 'user-id', email: 'editor@example.com', account_status: 'active', admin_role: 'editor', updated_at: new Date(),
        }]];
        if (sql.startsWith('UPDATE user_sessions')) return [{ affectedRows: 2 }];
        if (sql.includes('SELECT user_id') && sql.includes('WHERE user_id = ? LIMIT 1')) return [[{
          user_id: 'user-id', email: 'editor@example.com', account_status: 'active', admin_role: 'owner', updated_at: new Date(),
        }]];
        return [{ affectedRows: 1 }];
      }),
    };
    const repository = new AdminAccessRepository({ getConnection: vi.fn(async () => connection) } as never);

    const result = await repository.updateAdminRole('user-id', 'owner', 'actor-id');

    expect(result).toMatchObject({ status: 'updated', item: { adminRole: 'owner' }, revokedSessions: 2 });
    expect(connection.beginTransaction).toHaveBeenCalledOnce();
    expect(connection.commit).toHaveBeenCalledOnce();
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(queries.some((sql) => sql.startsWith('UPDATE user_sessions'))).toBe(true);
    expect(queries.some((sql) => sql.includes('INSERT INTO james_admin_audit_log'))).toBe(true);
  });

  it('refuses to demote the last active owner', async () => {
    const connection = {
      beginTransaction: vi.fn(async () => undefined),
      commit: vi.fn(async () => undefined),
      rollback: vi.fn(async () => undefined),
      release: vi.fn(),
      query: vi.fn(async (sql: string) => {
        if (sql.includes('LIMIT 1 FOR UPDATE')) return [[{
          user_id: 'owner-id', email: 'owner@example.com', account_status: 'active', admin_role: 'owner', updated_at: new Date(),
        }]];
        if (sql.includes('COUNT(*)')) return [[{ total: 1 }]];
        return [{}];
      }),
    };
    const repository = new AdminAccessRepository({ getConnection: vi.fn(async () => connection) } as never);
    await expect(repository.updateAdminRole('owner-id', 'editor', 'owner-id')).resolves.toEqual({ status: 'last_owner' });
    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.commit).not.toHaveBeenCalled();
  });
});