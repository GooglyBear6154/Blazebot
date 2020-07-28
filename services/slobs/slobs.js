const SockJS = require('sockjs-client');
const settings = require('./slobs.json');

let slobs = null;

if (settings.active) {
  slobs = new SockJS('http://127.0.0.1:59650/api');
}

// ID's
const ID_CONNECT = 1;
const ID_STREAMSTATUS = 2;
const ID_STREAMSTATUS_CHANGED = 3;
const ID_SCENES = 4;

let isStreaming = 'offline';
const scenesMap = new Map(); // SceneName , SourcesMap;

function subscribeStreaming() {
  const message = JSON.stringify({
    id: ID_STREAMSTATUS_CHANGED,
    jsonrpc: '2.0',
    method: 'streamingStatusChange',
    params: { resource: 'StreamingService' },
  });
  slobs.send(message);
}

function streamingStatus() {
  const message = JSON.stringify({
    id: ID_STREAMSTATUS,
    jsonrpc: '2.0',
    method: 'getModel',
    params: { resource: 'StreamingService' },
  });
  slobs.send(message);
}

function getScenes() {
  const message = JSON.stringify({
    id: ID_SCENES,
    jsonrpc: '2.0',
    method: 'getScenes',
    params: { resource: 'ScenesService' },
  });
  slobs.send(message);
}

function toggleSource(sceneName, sourceName) {
  const source = scenesMap.get(sceneName).get(sourceName);
  const message = JSON.stringify({
    id: 10,
    jsonrpc: '2.0',
    method: 'setVisibility',
    params: { resource: source.resourceId, args: [!source.visible] },
  });
  slobs.send(message);
  source.visible = !source.visible;
}
function activeScene(sceneName) {
  const scene = scenesMap.get(sceneName).values().next().value;
  const message = JSON.stringify({
    id: 10,
    jsonrpc: '2.0',
    method: 'makeSceneActive',
    params: { resource: 'ScenesService', args: [scene.sceneId] },
  });
  slobs.send(message);
}

module.exports = {
  name: 'slobs-controller-module',
  varname: 'slobs',
  output: slobs,
  activate() {
    console.log('active');
  },
  getStreamingStatus() {
    return isStreaming;
  },
  getSourceInfo(sceneName, sourceName) {
    return scenesMap.get(sceneName).get(sourceName);
  },
  toggleSourceVisible(sceneName, sourceName) {
    toggleSource(sceneName, sourceName);
  },
  setActiveScene(sceneName) {
    activeScene(sceneName);
  },
};

if (settings.active) {
  // SEND AUTH WHEN SOCKET OPENS
  slobs.onopen = () => {
    const connectMessage = JSON.stringify({
      jsonrpc: '2.0',
      id: ID_CONNECT,
      method: 'auth',
      params: {
        resource: 'TcpServerService',
        args: [settings.token],
      },
    });
    slobs.send(connectMessage);
  };

  // HANDLE MESSAGES RECEIVED
  slobs.onmessage = (d) => {
    const a = JSON.parse(d.data);
    if (d.type === 'message') {
      if (a.result) {
        if (a.id === ID_STREAMSTATUS) module.exports.streaming = a.result.streamingStatus;

        if (a.result._type !== undefined && a.result._type === 'EVENT') {
          if (a.result.emitter === 'STREAM') {
            isStreaming = a.result.data;
          }
        }
      }

      if (a.id === ID_CONNECT) {
        subscribeStreaming();
        streamingStatus();
        getScenes();
      }
      if (a.id === ID_SCENES) {
        for (let i = 0; i < a.result.length; i++) {
          const sources = new Map();
          for (let j = 0; j < a.result[i].nodes.length; j++) {
            sources.set(a.result[i].nodes[j].name, a.result[i].nodes[j]);
          }
          const sceneName = a.result[i].name;
          scenesMap.set(sceneName, sources);
        }
      }
    }
  };

  // EVENT TRIGGERED IF LOOSE CONNECTION TO SLOBS
  slobs.onclose = () => {
    console.log('slobs closed connection');
  };
}