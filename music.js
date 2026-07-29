// XM/MOD playback via BassoonTracker (lib/bassoonplayer.js).

window.Music = {
  player: null,
  isPlaying: false,
  isInitialized: false,
  pendingPlay: null,
  audioContextResumed: false,
  volume: 0.3,
  currentFilePath: null,
  _playStartTime: null,
  _nowPlayingTimer: null,
  _nowPlayingEl: null,
  /** 'menu' | 'match' | null — avoids restarting when showMenu() fires repeatedly */
  mode: null,

  TRACKS: [
    'music/agressor 8.mod',
    'music/Blur Vision.mod',
    'music/Sensual Deliria.mod',
    'music/silent movement.mod',
    'music/the trick top hat.mod',
    'music/time trap.mod',
    'music/waveform courier.mod'
  ],

  songTitleFromPath(filePath) {
    const base = String(filePath || '').replace(/\\/g, '/').split('/').pop() || '';
    return base.replace(/\.(mod|xm)$/i, '').trim() || 'unknown';
  },

  showNowPlaying(filePath) {
    let el = this._nowPlayingEl;
    if (!el) {
      el = document.getElementById('now-playing');
      this._nowPlayingEl = el;
    }
    if (!el) return;
    const title = this.songTitleFromPath(filePath);
    el.textContent = 'NeuroDancer - ' + title;
    el.classList.remove('fade');
    // restart shine / fade cycle
    void el.offsetWidth;
    el.classList.add('show');
    if (this._nowPlayingTimer) clearTimeout(this._nowPlayingTimer);
    this._nowPlayingTimer = setTimeout(() => {
      el.classList.add('fade');
      el.classList.remove('show');
      this._nowPlayingTimer = setTimeout(() => {
        el.classList.remove('fade');
        el.textContent = '';
        this._nowPlayingTimer = null;
      }, 600);
    }, 5200);
  },

  normalizePath(filePath) {
    if (filePath == null) return '';
    return String(filePath).replace(/\\/g, '/').toLowerCase();
  },

  isSameTrack(filePathA, filePathB) {
    const a = this.normalizePath(filePathA);
    const b = this.normalizePath(filePathB);
    return a.length > 0 && a === b;
  },

  isAlreadyPlaying(filePath) {
    return this.isPlaying && this.isSameTrack(this.currentFilePath, filePath);
  },

  canAutoplay() {
    return this.audioContextResumed;
  },

  loadVolume() {
    try {
      const saved = localStorage.getItem('asteroidsMusicVolume');
      if (saved !== null) {
        this.volume = Math.max(0, Math.min(1, parseFloat(saved)));
      }
    } catch (e) {}
  },

  saveVolume() {
    try {
      localStorage.setItem('asteroidsMusicVolume', String(this.volume));
    } catch (e) {}
  },

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.saveVolume();
    this.applyVolume();
  },

  applyVolume() {
    if (typeof window.BassoonTracker === 'undefined' || !window.BassoonTracker.audio || !window.BassoonTracker.audio.masterVolume) return;
    const gain = window.BassoonTracker.audio.masterVolume.gain;
    const ctx = window.BassoonTracker.audio.context;
    const t = (ctx && ctx.currentTime) || 0;
    gain.cancelScheduledValues(t);
    gain.setValueAtTime(this.volume, t);
  },

  init() {
    if (this.isInitialized) return;
    this.volume = 0.3;
    this.saveVolume();
    this.isInitialized = true;
    this._buildPlayerAdapter();
    this.applyVolume();
    if (this.pendingPlay) {
      const { filePath, callback, sequenceIndex } = this.pendingPlay;
      this.pendingPlay = null;
      this.play(filePath, callback, sequenceIndex);
    }
  },

  _buildPlayerAdapter() {
    const self = this;
    this.player = {
      currentPlayingNode: { modulePtr: 0 },
      getCurrentOrder() {
        if (typeof window.BassoonTracker !== 'undefined' && window.BassoonTracker.getCurrentSongPosition) {
          return window.BassoonTracker.getCurrentSongPosition();
        }
        return null;
      },
      pause() {
        if (typeof window.BassoonTracker !== 'undefined' && window.BassoonTracker.stop) {
          window.BassoonTracker.stop();
        }
        self.isPlaying = false;
      }
    };
  },

  _loadFileAsArrayBuffer(filePath) {
    const url = String(filePath).split('/').map(encodeURIComponent).join('/');
    return fetch(url).then((res) => {
      if (!res.ok) throw new Error('Load failed: ' + res.status);
      return res.arrayBuffer();
    });
  },

  pickRandomTrack(excludePath) {
    const list = this.TRACKS;
    if (!list.length) return null;
    if (list.length === 1) return list[0];
    const ex = this.normalizePath(excludePath);
    let pick = list[Math.floor(Math.random() * list.length)];
    if (ex && this.normalizePath(pick) === ex) {
      pick = list[Math.floor(Math.random() * list.length)];
      if (this.normalizePath(pick) === ex) {
        const alt = list.filter((p) => this.normalizePath(p) !== ex);
        if (alt.length) pick = alt[Math.floor(Math.random() * alt.length)];
      }
    }
    return pick;
  },

  async play(xmFilePath, callback, sequenceIndex) {
    if (!this.isInitialized) {
      this.pendingPlay = { filePath: xmFilePath, callback: callback, sequenceIndex: sequenceIndex };
      this.init();
      return;
    }
    if (!this.canAutoplay() && !this.audioContextResumed) {
      this.pendingPlay = { filePath: xmFilePath, callback: callback, sequenceIndex: sequenceIndex };
      return;
    }

    if (typeof window.BassoonTracker === 'undefined') {
      if (callback) callback(new Error('BassoonTracker not loaded'));
      return;
    }

    if (this.isAlreadyPlaying(xmFilePath)) {
      this.applyVolume();
      if (callback) callback(null);
      return;
    }

    this.stop();
    this.currentFilePath = xmFilePath;

    try {
      window.BassoonTracker.ensureAudio();
      await this.resumeAudioContext();
      const arrayBuffer = await this._loadFileAsArrayBuffer(xmFilePath);
      if (!arrayBuffer || !(arrayBuffer instanceof ArrayBuffer)) {
        throw new Error('Invalid response');
      }
      const filename = xmFilePath.split('/').pop() || 'module';
      await window.BassoonTracker.loadFromArrayBuffer(arrayBuffer, filename);
      if (typeof sequenceIndex === 'number' && sequenceIndex >= 0 && window.BassoonTracker.setCurrentSongPosition) {
        window.BassoonTracker.setCurrentSongPosition(sequenceIndex);
      }
      this.applyVolume();
      this.player.currentPlayingNode.modulePtr = 1;
      this._playStartTime = window.BassoonTracker.audio && window.BassoonTracker.audio.context
        ? window.BassoonTracker.audio.context.currentTime
        : null;
      window.BassoonTracker.play();
      this.isPlaying = true;
      this.applyVolume();
      this.showNowPlaying(xmFilePath);
      setTimeout(() => this.applyVolume(), 50);
      if (callback) callback(null);
    } catch (err) {
      this.isPlaying = false;
      this.currentFilePath = null;
      this.player.currentPlayingNode.modulePtr = 0;
      if (callback) callback(err || new Error('Failed to load music'));
    }
  },

  stop() {
    if (typeof window.BassoonTracker !== 'undefined' && window.BassoonTracker.stop &&
        window.BassoonTracker.audio && window.BassoonTracker.audio.context) {
      window.BassoonTracker.stop();
    }
    this.isPlaying = false;
    this.currentFilePath = null;
    this._playStartTime = null;
    if (this.player) this.player.currentPlayingNode.modulePtr = 0;
  },

  resumeAudioContext() {
    this.audioContextResumed = true;
    if (typeof window.BassoonTracker !== 'undefined' && window.BassoonTracker.audio &&
        window.BassoonTracker.audio.context && window.BassoonTracker.audio.context.resume) {
      return window.BassoonTracker.audio.context.resume();
    }
    return Promise.resolve();
  },

  playAfterInteraction(xmFilePath, callback, sequenceIndex) {
    this.pendingPlay = { filePath: xmFilePath, callback: callback, sequenceIndex: sequenceIndex };
    if (this.audioContextResumed) {
      this.resumeAudioContext().then(() => {
        setTimeout(() => this.play(xmFilePath, callback, sequenceIndex), 100);
      });
    }
  },

  _startTrack(filePath, mode) {
    if (!filePath) return;
    this.mode = mode;
    const onDone = (err) => {
      if (err) console.warn('[Music] play failed:', err);
    };
    if (!this.isInitialized) this.init();
    if (this.canAutoplay()) this.play(filePath, onDone);
    else this.playAfterInteraction(filePath, onDone);
  },

  /** Random track for the menu. Keeps current track if already in menu mode. */
  playMenu() {
    if (this.mode === 'menu' && this.isPlaying) return;
    const path = this.pickRandomTrack(this.currentFilePath);
    this._startTrack(path, 'menu');
  },

  /** New random track at the start of a real match. */
  playMatch() {
    const path = this.pickRandomTrack(this.currentFilePath);
    this._startTrack(path, 'match');
  }
};

(function () {
  let interactionHandlerAdded = false;
  function setupUserInteractionHandler() {
    if (interactionHandlerAdded) return;
    interactionHandlerAdded = true;
    const resumeAudio = () => {
      if (typeof window.BassoonTracker !== 'undefined' && window.BassoonTracker.ensureAudio) {
        window.BassoonTracker.ensureAudio();
      }
      if (window.Music && window.Music.pendingPlay) {
        window.Music.resumeAudioContext().then(() => {
          const pending = window.Music.pendingPlay;
          if (!pending) return;
          window.Music.pendingPlay = null;
          const { filePath, callback, sequenceIndex } = pending;
          setTimeout(() => window.Music.play(filePath, callback, sequenceIndex), 150);
        });
      } else if (window.Music) {
        window.Music.resumeAudioContext();
      }
    };
    const clickHandler = () => {
      resumeAudio();
      document.removeEventListener('click', clickHandler);
      document.removeEventListener('touchstart', clickHandler);
    };
    document.addEventListener('click', clickHandler, { once: true });
    document.addEventListener('touchstart', clickHandler, { once: true });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupUserInteractionHandler);
  } else {
    setupUserInteractionHandler();
  }
})();
