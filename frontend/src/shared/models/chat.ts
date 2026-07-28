import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

export const helpBotConversations = pgTable("help_bot_conversations", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const helpBotMessages = pgTable("help_bot_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => helpBotConversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertHelpBotConversationSchema = createInsertSchema(helpBotConversations).omit({
  id: true,
  createdAt: true,
});

export const insertHelpBotMessageSchema = createInsertSchema(helpBotMessages).omit({
  id: true,
  createdAt: true,
});

export type HelpBotConversation = typeof helpBotConversations.$inferSelect;
export type InsertHelpBotConversation = z.infer<typeof insertHelpBotConversationSchema>;
export type HelpBotMessage = typeof helpBotMessages.$inferSelect;
export type InsertHelpBotMessage = z.infer<typeof insertHelpBotMessageSchema>;
