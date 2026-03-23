// ---------------------------------------------------------------------------
// Messaging module API — channels, messages, reactions, DMs, search, presence
// ---------------------------------------------------------------------------

import { apiFetch } from "./client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Channels --------------------------------------------------------------------

export interface Channel {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_private: boolean;
  creator_id: string;
  created_at: string;
  updated_at: string;
}

export interface CreateChannelPayload {
  name: string;
  slug: string;
  description?: string;
  is_private?: boolean;
  workspace_id?: string;
}

export interface UpdateChannelPayload {
  name?: string;
  description?: string;
}

// Messages --------------------------------------------------------------------

export interface Message {
  id: string;
  channel_id: string;
  author_id: string;
  author_name: string | null;
  thread_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface SendMessagePayload {
  body: string;
  thread_id?: string;
}

export interface UpdateMessagePayload {
  body: string;
}

// Reactions -------------------------------------------------------------------

export interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

// DMs -------------------------------------------------------------------------

export interface DmGroupMember {
  user_id: string;
  display_name: string;
}

export interface DmGroup {
  id: string;
  created_at: string;
  members: DmGroupMember[];
}

export interface DmMessage {
  id: string;
  group_id: string;
  author_id: string;
  author_name: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

// Presence --------------------------------------------------------------------

export type PresenceStatus = "online" | "away" | "offline";

export interface UserPresence {
  user_id: string;
  status: PresenceStatus;
}

// ---------------------------------------------------------------------------
// Helper to throw on non-OK responses
// ---------------------------------------------------------------------------

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(
      (err as { message?: string }).message ?? `Request failed (${res.status})`,
    );
  }
  return res.json() as Promise<T>;
}

async function unwrapVoid(res: Response): Promise<void> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(
      (err as { message?: string }).message ?? `Request failed (${res.status})`,
    );
  }
}

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

export async function createChannel(
  payload: CreateChannelPayload,
): Promise<Channel> {
  const res = await apiFetch("/api/channels", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return unwrap<Channel>(res);
}

export async function listChannels(workspaceId?: string): Promise<Channel[]> {
  const params = new URLSearchParams();
  if (workspaceId) params.set("workspace_id", workspaceId);
  const qs = params.toString();
  const path = `/api/channels${qs ? `?${qs}` : ""}`;
  const res = await apiFetch(path);
  return unwrap<Channel[]>(res);
}

export async function getChannel(channelId: string): Promise<Channel> {
  const res = await apiFetch(`/api/channels/${channelId}`);
  return unwrap<Channel>(res);
}

export async function updateChannel(
  channelId: string,
  payload: UpdateChannelPayload,
): Promise<Channel> {
  const res = await apiFetch(`/api/channels/${channelId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return unwrap<Channel>(res);
}

export async function deleteChannel(channelId: string): Promise<void> {
  const res = await apiFetch(`/api/channels/${channelId}`, { method: "DELETE" });
  return unwrapVoid(res);
}

export async function joinChannel(channelId: string): Promise<void> {
  const res = await apiFetch(`/api/channels/${channelId}/join`, { method: "POST" });
  return unwrapVoid(res);
}

export async function leaveChannel(channelId: string): Promise<void> {
  const res = await apiFetch(`/api/channels/${channelId}/leave`, {
    method: "POST",
  });
  return unwrapVoid(res);
}

// ---------------------------------------------------------------------------
// Messages (nested under channels)
// ---------------------------------------------------------------------------

export async function sendMessage(
  channelId: string,
  payload: SendMessagePayload,
): Promise<Message> {
  const res = await apiFetch(`/api/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return unwrap<Message>(res);
}

export interface ListMessagesOptions {
  offset?: number;
  limit?: number;
}

export async function listMessages(
  channelId: string,
  options?: ListMessagesOptions,
): Promise<Message[]> {
  const params = new URLSearchParams();
  if (options?.offset !== undefined)
    params.set("offset", String(options.offset));
  if (options?.limit !== undefined)
    params.set("limit", String(options.limit));

  const qs = params.toString();
  const path = `/api/channels/${channelId}/messages${qs ? `?${qs}` : ""}`;
  const res = await apiFetch(path);
  return unwrap<Message[]>(res);
}

export async function getThread(messageId: string): Promise<Message[]> {
  const res = await apiFetch(`/api/messages/${messageId}/thread`);
  return unwrap<Message[]>(res);
}

export async function updateMessage(
  messageId: string,
  payload: UpdateMessagePayload,
): Promise<Message> {
  const res = await apiFetch(`/api/messages/${messageId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return unwrap<Message>(res);
}

export async function deleteMessage(messageId: string): Promise<void> {
  const res = await apiFetch(`/api/messages/${messageId}`, { method: "DELETE" });
  return unwrapVoid(res);
}

// ---------------------------------------------------------------------------
// Reactions
// ---------------------------------------------------------------------------

export async function addReaction(
  messageId: string,
  emoji: string,
): Promise<Reaction> {
  const res = await apiFetch(`/api/messages/${messageId}/reactions`, {
    method: "POST",
    body: JSON.stringify({ emoji }),
  });
  return unwrap<Reaction>(res);
}

export async function removeReaction(
  messageId: string,
  emoji: string,
): Promise<void> {
  const res = await apiFetch(
    `/api/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
    { method: "DELETE" },
  );
  return unwrapVoid(res);
}

// ---------------------------------------------------------------------------
// DMs (Direct Message groups)
// ---------------------------------------------------------------------------

export async function createDmGroup(userIds: string[]): Promise<DmGroup> {
  const res = await apiFetch("/api/dm", {
    method: "POST",
    body: JSON.stringify({ user_ids: userIds }),
  });
  return unwrap<DmGroup>(res);
}

export async function listDmGroups(): Promise<DmGroup[]> {
  const res = await apiFetch("/api/dm");
  return unwrap<DmGroup[]>(res);
}

export async function sendDm(
  groupId: string,
  body: string,
): Promise<DmMessage> {
  const res = await apiFetch(`/api/dm/${groupId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
  return unwrap<DmMessage>(res);
}

export interface ListDmsOptions {
  offset?: number;
  limit?: number;
}

export async function listDms(
  groupId: string,
  options?: ListDmsOptions,
): Promise<DmMessage[]> {
  const params = new URLSearchParams();
  if (options?.offset !== undefined)
    params.set("offset", String(options.offset));
  if (options?.limit !== undefined)
    params.set("limit", String(options.limit));

  const qs = params.toString();
  const path = `/api/dm/${groupId}/messages${qs ? `?${qs}` : ""}`;
  const res = await apiFetch(path);
  return unwrap<DmMessage[]>(res);
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export async function searchMessages(
  query: string,
  offset?: number,
  limit?: number,
): Promise<Message[]> {
  const params = new URLSearchParams({ q: query });
  if (offset !== undefined) params.set("offset", String(offset));
  if (limit !== undefined) params.set("limit", String(limit));

  const res = await apiFetch(`/api/messages/search?${params.toString()}`);
  return unwrap<Message[]>(res);
}

// ---------------------------------------------------------------------------
// Presence
// ---------------------------------------------------------------------------

export async function getPresence(userId: string): Promise<UserPresence> {
  const res = await apiFetch(`/api/presence/${userId}`);
  return unwrap<UserPresence>(res);
}
