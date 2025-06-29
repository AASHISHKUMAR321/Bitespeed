import { mysqlTable, int, varchar, datetime, index } from 'drizzle-orm/mysql-core';

export const contacts = mysqlTable('contacts', {
    id: int('id').primaryKey().autoincrement(),
    phoneNumber: varchar('phone_number', { length: 20 }),
    email: varchar('email', { length: 255 }),
    linkedId: int('linked_id'),
    linkPrecedence: varchar('link_precedence', { length: 10, enum: ['primary', 'secondary'] }).notNull(),
    createdAt: datetime('created_at', { mode: 'date' }).notNull().default(new Date()),
    updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(new Date()),
    deletedAt: datetime('deleted_at', { mode: 'date' }),
}, (table) => ({
    emailIdx: index('email_idx').on(table.email),
    phoneIdx: index('phone_idx').on(table.phoneNumber),
    linkedIdIdx: index('linked_id_idx').on(table.linkedId),
}));

// Define types for TypeScript
export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;