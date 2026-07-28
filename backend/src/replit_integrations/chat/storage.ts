import { db } from "../../db";
import { helpBotConversations, helpBotMessages } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IChatStorage {
  getConversation(id: number): Promise<typeof helpBotConversations.$inferSelect | undefined>;
  getAllConversations(): Promise<(typeof helpBotConversations.$inferSelect)[]>;
  createConversation(title: string, userId?: string): Promise<typeof helpBotConversations.$inferSelect>;
  deleteConversation(id: number): Promise<void>;
  getMessagesByConversation(conversationId: number): Promise<(typeof helpBotMessages.$inferSelect)[]>;
  createMessage(conversationId: number, role: string, content: string): Promise<typeof helpBotMessages.$inferSelect>;
}

export const chatStorage: IChatStorage = {
  async getConversation(id: number) {
    const [conversation] = await db.select().from(helpBotConversations).where(eq(helpBotConversations.id, id));
    return conversation;
  },

  async getAllConversations() {
    return db.select().from(helpBotConversations).orderBy(desc(helpBotConversations.createdAt));
  },

  async createConversation(title: string, userId?: string) {
    const [conversation] = await db.insert(helpBotConversations).values({ title, userId }).returning();
    return conversation;
  },

  async deleteConversation(id: number) {
    await db.delete(helpBotMessages).where(eq(helpBotMessages.conversationId, id));
    await db.delete(helpBotConversations).where(eq(helpBotConversations.id, id));
  },

  async getMessagesByConversation(conversationId: number) {
    return db.select().from(helpBotMessages).where(eq(helpBotMessages.conversationId, conversationId)).orderBy(helpBotMessages.createdAt);
  },

  async createMessage(conversationId: number, role: string, content: string) {
    const [message] = await db.insert(helpBotMessages).values({ conversationId, role, content }).returning();
    return message;
  },
};
