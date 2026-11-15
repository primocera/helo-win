// The only bridge between the pages and the main process. It exposes a small,
// typed API (window.helo); pages never get ipcRenderer or Node access.
import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron';
import type { HeloApi } from '../shared/types';

function listen<T>(channel: string, fn: (value: T) => void): () => void {
  const handler = (_e: IpcRendererEvent, value: T) => fn(value);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

const api: HeloApi = {
  onState: (fn) => listen('state', fn),
  onSmoke: (fn) => listen('smoke', fn),
  onCursor: (fn) => listen('cursor', fn),
  onCollapse: (fn) => listen('island:collapse', () => fn()),
  onConvertJob: (fn) => listen('convert:job', fn),
  ready: () => ipcRenderer.send('island:ready'),
  hover: (on) => ipcRenderer.send('island:hover', Boolean(on)),
  panel: (open) => ipcRenderer.send('island:panel', Boolean(open)),
  size: (size) => ipcRenderer.send('island:size', size === 'full' ? 'full' : 'compact'),
  decide: (id, behavior) => ipcRenderer.send('decide', { id: String(id), behavior }),
  answer: (id, picks) => ipcRenderer.send('answer', { id: String(id), picks }),
  skip: (id) => ipcRenderer.send('skip', String(id)),
  media: (action, positionMs) => ipcRenderer.send('media', { action, positionMs }),
  timer: (action) => ipcRenderer.send('timer', action),
  clipCopy: (id) => ipcRenderer.send('clip:copy', String(id)),
  clipRemove: (id) => ipcRenderer.send('clip:remove', String(id)),
  clipClear: () => ipcRenderer.send('clip:clear'),
  clipPin: (id) => ipcRenderer.send('clip:pin', String(id)),
  saveNotes: (text) => ipcRenderer.send('notes:save', String(text)),
  // Dropped File objects only carry their real path through webUtils, in the preload.
  shelfAdd: (files) => ipcRenderer.send('shelf:add', Array.from(files, (f) => webUtils.getPathForFile(f)).filter(Boolean)),
  shelfRemove: (id) => ipcRenderer.send('shelf:remove', String(id)),
  shelfClear: () => ipcRenderer.send('shelf:clear'),
  shelfOpen: (id) => ipcRenderer.send('shelf:open', String(id)),
  shelfDrag: (id) => ipcRenderer.send('shelf:drag', String(id)),
  shelfConvert: (id, to) => ipcRenderer.invoke('shelf:convert', String(id), to),
  convertDone: (id, result) => ipcRenderer.send('convert:done', String(id), result),
  setKeepAwake: (on) => ipcRenderer.send('keepAwake', Boolean(on)),
  setVolume: (level) => ipcRenderer.send('volume:set', Number(level)),
  setMute: (on) => ipcRenderer.send('volume:mute', Boolean(on)),
  setDisplayBrightness: (index, level) => ipcRenderer.send('displays:set', Number(index), Number(level)),
  setDisplayContrast: (index, level) => ipcRenderer.send('displays:contrast', Number(index), Number(level)),
  setDisplayInput: (index, input) => ipcRenderer.send('displays:input', Number(index), Number(input)),
  refreshDisplays: () => ipcRenderer.send('displays:refresh'),
  bannerClick: () => ipcRenderer.send('banner:click'),
  listWindows: () => ipcRenderer.invoke('watch:windows'),
  startWatch: (pid, condition) => ipcRenderer.invoke('watch:start', Number(pid), condition),
  cancelWatch: () => ipcRenderer.send('watch:cancel'),
  openFinished: (id) => ipcRenderer.send('finished:open', String(id)),
  openSettings: (section) => ipcRenderer.send('settings:open', section ? String(section) : undefined),
  onSettingsSection: (fn) => listen('settings:section', fn),
  settingsInfo: () => ipcRenderer.invoke('settings:info'),
  updateSettings: (patch) => ipcRenderer.invoke('settings:update', patch),
  setStartWithWindows: (on) => ipcRenderer.invoke('settings:startWithWindows', Boolean(on)),
  connectAgent: (agent, on) => ipcRenderer.invoke('agents:connect', agent, Boolean(on)),
  activateLicense: (key) => ipcRenderer.invoke('license:activate', String(key)),
  deactivateLicense: () => ipcRenderer.invoke('license:deactivate'),
  buy: () => ipcRenderer.send('buy'),
  refreshCalendar: () => ipcRenderer.invoke('calendar:refresh'),
  listStartupApps: () => ipcRenderer.invoke('startup:list'),
  openExtensionFolder: () => ipcRenderer.send('web:openFolder'),
  setStartupApp: (id, enabled) => ipcRenderer.invoke('startup:set', String(id), Boolean(enabled)),
};

contextBridge.exposeInMainWorld('helo', api);
