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
  workspace_id: string;
  name: string;
  description: string | null;
  is_private: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateChannelPayload {
  workspace_id: string;
  name: string;
  description?: string;
  is_private?: boolean;
}

export interface UpdateChannelPayload {
  name?: string;
  description?: string;
  is_private?: boolean;
}

// Messages --------------------------------------------------------------------

export interface Message {
  id: string;
  channel_id: string;
  sender_id: string;
  body: string;
  thread_id: string | null;
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

export interface PaginatedMessages {
  messages: Message[];
  has_more: boolean;
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

export interface DmGroup {
  id: string;
  participant_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface DmMessage {
  id: string;
  group_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface PaginatedDms {
  messages: DmMessage[];
  has_more: boolean;
}

// Search ----------------------------------------------------------------------

export interface SearchResult {
  messages: Message[];
  total: number;
}

// Presence --------------------------------------------------------------------

export type PresenceStatus = "online" | "away" | "offline";

export interface UserPresence {
  user_id: string;
  status: PresenceStatus;
  last_seen: string;
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
  const res = await apiFetch("/channels", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return unwrap<Channel>(res);
}

export async function listChannels(workspaceId: string): Promise<Channel[]> {
  const res = await apiFetch(`/channels?workspace_id=${workspaceId}`);
  return unwrap<Channel[]>(res);
}

export async function getChannel(channelId: string): Promise<Channel> {
  const res = await apiFetch(`/channels/${channelId}`);
  return unwrap<Channel>(res);
}

export async function updateChannel(
  channelId: string,
  payload: UpdateChannelPayload,
): Promise<Channel> {
  const res = await apiFetch(`/channels/${channelId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return unwrap<Channel>(res);
}

export async function deleteChannel(channelId: string): Promise<void> {
  const res = await apiFetch(`/channels/${channelId}`, { method: "DELETE" });
  return unwrapVoid(res);
}

export async function joinChannel(channelId: string): Promise<void> {
  const res = await apiFetch(`/channels/${channelId}/join`, { method: "POST" });
  return unwrapVoid(res);
}

export async function leaveChannel(channelId: string): Promise<void> {
  const res = await apiFetch(`/channels/${channelId}/leave`, {
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
  const res = await apiFetch(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return unwrap<Message>(res);
}

export interface ListMessagesOptions {
  before?: string;
  after?: string;
  limit?: number;
}

export async function listMessages(
  channelId: string,
  options?: ListMessagesOptions,
): Promise<PaginatedMessages> {
  const params = new URLSearchParams();
  if (options?.before) params.set("before", options.before);
  if (options?.after) params.set("after", options.after);
  if (options?.limit !== undefined)
    params.set("limit", String(options.limit));

  const qs = params.toString();
  const path = `/channels/${channelId}/messages${qs ? `?${qs}` : ""}`;
  const res = await apiFetch(path);
  return unwrap<PaginatedMessages>(res);
}

export async function getThread(messageId: string): Promise<Message[]> {
  const res = await apiFetch(`/messages/${messageId}/thread`);
  return unwrap<Message[]>(res);
}

export async function updateMessage(
  messageId: string,
  payload: UpdateMessagePayload,
): Promise<Message> {
  const res = await apiFetch(`/messages/${messageId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return unwrap<Message>(res);
}

export async function deleteMessage(messageId: string): Promise<void> {
  const res = await apiFetch(`/messages/${messageId}`, { method: "DELETE" });
  return unwrapVoid(res);
}

// ---------------------------------------------------------------------------
// Reactions
// ---------------------------------------------------------------------------

export async function addReaction(
  messageId: string,
  emoji: string,
): Promise<Reaction> {
  const res = await apiFetch(`/messages/${messageId}/reactions`, {
    method: "POST",
    body: JSON.stringify({ emoji }),
  });
  return unwrap<Reaction>(res);
}

export async function removeReaction(
  messageId: string,
  emoji: string,
): Promise<void> {
  const res = await apiFetch(`/messages/${messageId}/reactions`, {
    method: "DELETE",
    body: JSON.stringify({ emoji }),
  });
  return unwrapVoid(res);
}

// ---------------------------------------------------------------------------
// DMs (Direct Message groups)
// ---------------------------------------------------------------------------

export async function createDmGroup(userIds: string[]): Promise<DmGroup> {
  const res = await apiFetch("/dm-groups", {
    method: "POST",
    body: JSON.stringify({ user_ids: userIds }),
  });
  return unwrap<DmGroup>(res);
}

export async function listDmGroups(): Promise<DmGroup[]> {
  const res = await apiFetch("/dm-groups");
  return unwrap<DmGroup[]>(res);
}

export async function sendDm(
  groupId: string,
  body: string,
): Promise<DmMessage> {
  const res = await apiFetch(`/dm-groups/${groupId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
  return unwrap<DmMessage>(res);
}

export interface ListDmsOptions {
  before?: string;
  after?: string;
  limit?: number;
}

export async function listDms(
  groupId: string,
  options?: ListDmsOptions,
): Promise<PaginatedDms> {
  const params = new URLSearchParams();
  if (options?.before) params.set("before", options.before);
  if (options?.after) params.set("after", options.after);
  if (options?.limit !== undefined)
    params.set("limit", String(options.limit));

  const qs = params.toString();
  const path = `/dm-groups/${groupId}/messages${qs ? `?${qs}` : ""}`;
  const res = await apiFetch(path);
  return unwrap<PaginatedDms>(res);
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export async function searchMessages(
  query: string,
  offset?: number,
  limit?: number,
): Promise<SearchResult> {
  const params = new URLSearchParams({ q: query });
  if (offset !== undefined) params.set("offset", String(offset));
  if (limit !== undefined) params.set("limit", String(limit));

  const res = await apiFetch(`/messages/search?${params.toString()}`);
  return unwrap<SearchResult>(res);
}

// ---------------------------------------------------------------------------
// Presence
// ---------------------------------------------------------------------------

export async function getPresence(userId: string): Promise<UserPresence> {
  const res = await apiFetch(`/users/${userId}/presence`);
  return unwrap<UserPresence>(res);
}
