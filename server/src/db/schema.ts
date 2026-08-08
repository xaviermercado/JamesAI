import { sql } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { char, datetime, int, index, mysqlEnum, mysqlTable, primaryKey, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';

export const users = mysqlTable(
  'users',
  {
    userId: char('user_id', { length: 36 }).notNull(),
    email: varchar('email', { length: 254 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    emailVerifiedAt: datetime('email_verified_at', { mode: 'date', fsp: 3 }),
    accountStatus: mysqlEnum('account_status', ['pending_verification', 'active', 'disabled'])
      .notNull()
      .default('pending_verification'),
    adminRole: mysqlEnum('admin_role', ['user', 'editor', 'owner']).notNull().default('user'),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: datetime('updated_at', { mode: 'date', fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.userId] }),
    emailUnique: uniqueIndex('uq_users_email').on(table.email),
    statusEmailIndex: index('idx_users_account_status_email').on(table.accountStatus, table.email),
    adminRoleIndex: index('idx_users_admin_role').on(table.adminRole, table.accountStatus),
  }),
);

export const userSessions = mysqlTable(
  'user_sessions',
  {
    sessionId: char('session_id', { length: 36 }).notNull(),
    userId: char('user_id', { length: 36 }).notNull(),
    tokenHash: char('token_hash', { length: 64 }).notNull(),
    expiresAt: datetime('expires_at', { mode: 'date', fsp: 3 }).notNull(),
    revokedAt: datetime('revoked_at', { mode: 'date', fsp: 3 }),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    authenticatedAt: datetime('authenticated_at', { mode: 'date', fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    lastUsedAt: datetime('last_used_at', { mode: 'date', fsp: 3 }),
    deviceLabel: varchar('device_label', { length: 120 }),
    clientPlatform: mysqlEnum('client_platform', ['web', 'ios', 'android', 'unknown'])
      .notNull()
      .default('web'),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.sessionId] }),
    tokenHashUnique: uniqueIndex('uq_user_sessions_token_hash').on(table.tokenHash),
    userIndex: index('idx_user_sessions_user_id').on(table.userId),
    activeLookup: index('idx_user_sessions_active_lookup').on(table.tokenHash, table.revokedAt, table.expiresAt),
    cleanupIndex: index('idx_user_sessions_cleanup').on(table.expiresAt, table.revokedAt),
  }),
);

export const emailVerificationTokens = mysqlTable(
  'email_verification_tokens',
  {
    tokenId: char('token_id', { length: 36 }).notNull(),
    userId: char('user_id', { length: 36 }).notNull(),
    tokenHash: char('token_hash', { length: 64 }).notNull(),
    expiresAt: datetime('expires_at', { mode: 'date', fsp: 3 }).notNull(),
    usedAt: datetime('used_at', { mode: 'date', fsp: 3 }),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.tokenId] }),
    tokenHashUnique: uniqueIndex('uq_email_verification_tokens_token_hash').on(table.tokenHash),
    userIndex: index('idx_email_verification_tokens_user_id').on(table.userId),
    cleanupIndex: index('idx_email_verification_tokens_cleanup').on(table.expiresAt, table.usedAt),
  }),
);

export const passwordResetTokens = mysqlTable(
  'password_reset_tokens',
  {
    tokenId: char('token_id', { length: 36 }).notNull(),
    userId: char('user_id', { length: 36 }).notNull(),
    tokenHash: char('token_hash', { length: 64 }).notNull(),
    expiresAt: datetime('expires_at', { mode: 'date', fsp: 3 }).notNull(),
    usedAt: datetime('used_at', { mode: 'date', fsp: 3 }),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.tokenId] }),
    tokenHashUnique: uniqueIndex('uq_password_reset_tokens_token_hash').on(table.tokenHash),
    userIndex: index('idx_password_reset_tokens_user_id').on(table.userId),
    cleanupIndex: index('idx_password_reset_tokens_cleanup').on(table.expiresAt, table.usedAt),
  }),
);

export const profiles = mysqlTable(
  'profiles',
  {
    userId: char('user_id', { length: 36 }).notNull(),
    firstName: varchar('first_name', { length: 80 }),
    lastName: varchar('last_name', { length: 80 }),
    displayName: varchar('display_name', { length: 80 }).notNull(),
    countryCode: char('country_code', { length: 2 }).notNull(),
    avatarUrl: varchar('avatar_url', { length: 2048 }),
    avatarId: varchar('avatar_id', { length: 32 }),
    letterboxdUsername: varchar('letterboxd_username', { length: 100 }),
    letterboxdProfileUrl: varchar('letterboxd_profile_url', { length: 2048 }),
    tvtimeUsername: varchar('tvtime_username', { length: 100 }),
    tvtimeProfileUrl: varchar('tvtime_profile_url', { length: 2048 }),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: datetime('updated_at', { mode: 'date', fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.userId] }),
    countryIndex: index('idx_profiles_country_code').on(table.countryCode),
  }),
);

export const userStreamingServices = mysqlTable(
  'user_streaming_services',
  {
    userStreamingServiceId: char('user_streaming_service_id', { length: 36 }).notNull(),
    userId: char('user_id', { length: 36 }).notNull(),
    tmdbProviderId: int('tmdb_provider_id', { unsigned: true }).notNull(),
    providerName: varchar('provider_name', { length: 255 }).notNull(),
    logoPath: varchar('logo_path', { length: 255 }),
    countryCode: char('country_code', { length: 2 }).notNull(),
    sortOrder: int('sort_order', { unsigned: true }).notNull().default(0),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.userStreamingServiceId] }),
    uniqueSelection: uniqueIndex('uq_user_streaming_services_user_provider_country').on(
      table.userId,
      table.tmdbProviderId,
      table.countryCode,
    ),
    userIndex: index('idx_user_streaming_services_user_id').on(table.userId),
    userSortIndex: index('idx_user_streaming_services_user_sort').on(table.userId, table.sortOrder),
    providerLookup: index('idx_user_streaming_services_provider_lookup').on(table.countryCode, table.tmdbProviderId),
  }),
);

export const userTitleFeedback = mysqlTable(
  'user_title_feedback',
  {
    userTitleFeedbackId: char('user_title_feedback_id', { length: 36 }).notNull(),
    userId: char('user_id', { length: 36 }).notNull(),
    tmdbId: int('tmdb_id', { unsigned: true }).notNull(),
    mediaType: mysqlEnum('media_type', ['movie', 'tv']).notNull(),
    feedbackType: mysqlEnum('feedback_type', ['liked', 'disliked', 'watched']).notNull(),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: datetime('updated_at', { mode: 'date', fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.userTitleFeedbackId] }),
    uniqueFeedback: uniqueIndex('uq_user_title_feedback').on(table.userId, table.tmdbId, table.mediaType),
    userIndex: index('idx_user_title_feedback_user_id').on(table.userId),
    exclusionLookup: index('idx_user_title_feedback_exclusions').on(
      table.userId,
      table.mediaType,
      table.feedbackType,
      table.tmdbId,
    ),
  }),
);

export const userLibraryTitles = mysqlTable(
  'user_library_titles',
  {
    userLibraryTitleId: char('user_library_title_id', { length: 36 }).notNull(),
    userId: char('user_id', { length: 36 }).notNull(),
    tmdbId: int('tmdb_id', { unsigned: true }).notNull(),
    mediaType: mysqlEnum('media_type', ['movie', 'tv']).notNull(),
    libraryStatus: mysqlEnum('library_status', ['watchlist', 'watched']).notNull(),
    addedAt: datetime('added_at', { mode: 'date', fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    watchedAt: datetime('watched_at', { mode: 'date', fsp: 3 }),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: datetime('updated_at', { mode: 'date', fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.userLibraryTitleId] }),
    uniqueTitle: uniqueIndex('uq_user_library_titles_user_tmdb_media').on(table.userId, table.tmdbId, table.mediaType),
    userStatusLookup: index('idx_user_library_titles_user_status_updated').on(table.userId, table.libraryStatus, table.updatedAt),
    watchedLookup: index('idx_user_library_titles_watched_filter').on(table.userId, table.mediaType, table.libraryStatus, table.updatedAt),
  }),
);

export type UserRow = InferSelectModel<typeof users>;
export type NewUserRow = InferInsertModel<typeof users>;
export type UserSessionRow = InferSelectModel<typeof userSessions>;
export type ProfileRow = InferSelectModel<typeof profiles>;
export type UserLibraryTitleRow = InferSelectModel<typeof userLibraryTitles>;
