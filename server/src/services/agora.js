const SCREEN_UID_OFFSET = 2000000000;
const TOKEN_TTL = 3600;

function appId() {
  return process.env.AGORA_APP_ID || '';
}

function certificate() {
  return process.env.AGORA_APP_CERTIFICATE || '';
}

function rtcConfigured() {
  return Boolean(appId() && certificate());
}

function withHttps(value) {
  const raw = String(value || '').trim().replace(/\/$/, '');
  if (!raw) return '';
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function chatConfigured() {
  return rtcConfigured() && Boolean(chatHost());
}

function tokenBuilders() {
  const agoraToken = require('agora-token');
  return {
    RtcTokenBuilder: agoraToken.RtcTokenBuilder,
    RtcRole: agoraToken.RtcRole,
    ChatTokenBuilder: agoraToken.ChatTokenBuilder,
  };
}

function buildRtcToken(channelName, uid) {
  const { RtcTokenBuilder, RtcRole } = tokenBuilders();
  return RtcTokenBuilder.buildTokenWithUid(
    appId(),
    certificate(),
    channelName,
    Number(uid),
    RtcRole.PUBLISHER,
    TOKEN_TTL,
    TOKEN_TTL
  );
}

function buildChatUserToken(userId) {
  const { ChatTokenBuilder } = tokenBuilders();
  return ChatTokenBuilder.buildUserToken(appId(), certificate(), String(userId), TOKEN_TTL);
}

function buildChatAppToken() {
  const { ChatTokenBuilder } = tokenBuilders();
  return ChatTokenBuilder.buildAppToken(appId(), certificate(), TOKEN_TTL);
}

function screenUidFor(agoraUid) {
  return SCREEN_UID_OFFSET + Number(agoraUid);
}

function chatHost() {
  return withHttps(process.env.AGORA_CHAT_REST_HOST);
}

let chatDirectoryCache = null;

async function chatDirectory() {
  if (chatDirectoryCache && chatDirectoryCache.until > Date.now()) return chatDirectoryCache;
  const response = await fetch(
    `https://ars.chat.agora.io/easemob/server.json?app_id=${encodeURIComponent(appId())}&sdk_version=4.10.0&file_version=1`
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.app_key) {
    const error = new Error('Agora Chat could not resolve this app in data center 61.');
    error.status = 503;
    throw error;
  }
  const hosts = (data['msync-wx'] && data['msync-wx'].hosts) || [];
  const match = hosts.find((host) => String(host.port) === '443' && String(host.domain || '').endsWith('chat.agora.io'))
    || hosts.find((host) => String(host.port) === '443');
  const domain = match ? match.domain : 'im-api-wechat-61.chat.agora.io';
  chatDirectoryCache = {
    until: Date.now() + 10 * 60 * 1000,
    appKey: process.env.AGORA_CHAT_APP_KEY || data.app_key || '',
    apiUrl: chatHost(),
    url: `wss://${domain}/websocket`,
  };
  return chatDirectoryCache;
}

async function chatConnection() {
  const directory = await chatDirectory();
  return {
    appId: appId(),
    appKey: directory.appKey,
    apiUrl: directory.apiUrl,
    url: directory.url,
  };
}

async function chatRequest(method, path, body) {
  const response = await fetch(`${chatHost()}/app-id/${appId()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${buildChatAppToken()}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.error_description || data.error || data.exception || `Agora Chat request failed (${response.status})`);
    err.statusCode = response.status;
    err.body = data;
    throw err;
  }
  return data;
}

function isDuplicateUser(error) {
  const blob = JSON.stringify(error.body || {}).toLowerCase();
  return error.statusCode === 409 || blob.includes('duplicate') || blob.includes('unique');
}

function isAlreadyMember(error) {
  const blob = JSON.stringify(error.body || {}).toLowerCase();
  return blob.includes('already') || blob.includes('member');
}

async function ensureChatUser(userId) {
  try {
    await chatRequest('POST', '/users', { username: String(userId) });
  } catch (error) {
    if (!isDuplicateUser(error)) throw error;
  }
}

async function createChatGroup({ title, ownerId }) {
  const data = await chatRequest('POST', '/chatgroups', {
    groupname: title.slice(0, 128),
    description: 'Nexora room',
    public: false,
    maxusers: '50',
    allowinvites: false,
    membersonly: false,
    invite_need_confirm: false,
    owner: String(ownerId),
  });
  const groupId = data?.data?.groupid || data?.groupid;
  if (!groupId) throw new Error('Agora Chat did not return a group id.');
  return String(groupId);
}

async function addChatMember(groupId, userId) {
  try {
    await chatRequest('POST', `/chatgroups/${groupId}/users/${encodeURIComponent(String(userId))}`);
  } catch (error) {
    if (!isAlreadyMember(error)) throw error;
  }
}

function mediaCredentials(room, user) {
  return {
    appId: appId(),
    channel: room.channelName,
    uid: user.agoraUid,
    rtcToken: buildRtcToken(room.channelName, user.agoraUid),
    screenUid: screenUidFor(user.agoraUid),
    screenToken: buildRtcToken(room.channelName, screenUidFor(user.agoraUid)),
    encryption: {
      mode: 'aes-256-gcm2',
      key: room.encryptionKey,
      salt: room.encryptionSalt,
    },
  };
}

async function chatCredentials(room, user) {
  const { Room } = require('../models/Room');
  await ensureChatUser(user.id);
  if (!room.chatGroupId) {
    const groupId = await createChatGroup({ title: room.title, ownerId: room.host });
    room.chatGroupId = groupId;
    await Room.updateOne({ _id: room._id }, { chatGroupId: groupId });
  }
  if (String(room.host) !== String(user.id)) {
    await addChatMember(room.chatGroupId, user.id);
  }
  return {
    ...(await chatConnection()),
    userId: user.id,
    token: buildChatUserToken(user.id),
    groupId: room.chatGroupId,
  };
}

async function chatSession(user) {
  return {
    ...(await chatConnection()),
    userId: user.id,
    name: user.name,
    token: buildChatUserToken(user.id),
  };
}

module.exports = {
  SCREEN_UID_OFFSET,
  rtcConfigured,
  chatConfigured,
  ensureChatUser,
  createChatGroup,
  addChatMember,
  mediaCredentials,
  chatCredentials,
  chatSession,
};
