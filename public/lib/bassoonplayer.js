var EVENT = {
  instrumentChange: 1,
  patternChange: 2,
  patternPosChange: 3,
  patternTableChange: 4,
  cursorPositionChange: 6,
  trackStateChange: 7,
  playingChange: 8,
  playTypeChange: 9,
  songPositionChange: 10,
  songSpeedChange: 11,
  songBPMChange: 12,
  samplePlay: 13,
  songPropertyChange: 16,
  command: 18,
  pianoNoteOn: 19,
  pianoNoteOff: 20,
  statusChange: 21,
  trackCountChange: 24,
  songLoaded: 26,
  songLoading: 27,
  trackerModeChanged: 28,
  instrumentListChange: 29,
  filterChainCountChange: 33,
  samplePropertyChange: 35,
  sampleIndexChange: 36,
  second: 37,
  minute: 38,
  skipFrameChanged: 43,
  clockEventExpired: 46,
  songEnd: 53,
  patternEnd: 54,
  songSpeedChangeIgnored: 55,
  songBPMChangeIgnored: 56,
  commandProcessSample: 57,
  playListLoaded: 62,
  playListIndexChanged: 63
};
var PLAYTYPE = {
  song: 1,
  pattern: 2
};
var FILETYPE = {
  unknown: 0,
  module: 1,
  sample: 2,
  pattern: 3,
  track: 4,
  instrument: 5,
  plugin: 6,
  playlist: 7
};
var STEREOSEPARATION = {
  FULL: 1,
  BALANCED: 2,
  NONE: 3
};
var LOOPTYPE = {
  NONE: 0,
  FORWARD: 1,
  PINGPONG: 2
};
var AMIGA_PALFREQUENCY = 7093790;
var PC_FREQUENCY = 7158728;
var AMIGA_PALFREQUENCY_HALF = AMIGA_PALFREQUENCY / 2;
var PC_FREQUENCY_HALF = PC_FREQUENCY / 2;
var NOTEPERIOD = {
  C1: { period: 856, name: "C-1", tune: [907, 900, 894, 887, 881, 875, 868, 862, 856, 850, 844, 838, 832, 826, 820, 814] },
  Cs1: { period: 808, name: "C#1", tune: [856, 850, 844, 838, 832, 826, 820, 814, 808, 802, 796, 791, 785, 779, 774, 768] },
  D1: { period: 762, name: "D-1", tune: [808, 802, 796, 791, 785, 779, 774, 768, 762, 757, 752, 746, 741, 736, 730, 725] },
  Ds1: { period: 720, name: "D#1", tune: [762, 757, 752, 746, 741, 736, 730, 725, 720, 715, 709, 704, 699, 694, 689, 684] },
  E1: { period: 678, name: "E-1", tune: [720, 715, 709, 704, 699, 694, 689, 684, 678, 674, 670, 665, 660, 655, 651, 646] },
  F1: { period: 640, name: "F-1", tune: [678, 675, 670, 665, 660, 655, 651, 646, 640, 637, 632, 628, 623, 619, 614, 610] },
  Fs1: { period: 604, name: "F#1", tune: [640, 636, 632, 628, 623, 619, 614, 610, 604, 601, 597, 592, 588, 584, 580, 575] },
  G1: { period: 570, name: "G-1", tune: [604, 601, 597, 592, 588, 584, 580, 575, 570, 567, 563, 559, 555, 551, 547, 543] },
  Gs1: { period: 538, name: "G#1", tune: [570, 567, 563, 559, 555, 551, 547, 543, 538, 535, 532, 528, 524, 520, 516, 513] },
  A1: { period: 508, name: "A-1", tune: [538, 535, 532, 528, 524, 520, 516, 513, 508, 505, 502, 498, 495, 491, 487, 484] },
  As1: { period: 480, name: "A#1", tune: [508, 505, 502, 498, 494, 491, 487, 484, 480, 477, 474, 470, 467, 463, 460, 457] },
  B1: { period: 453, name: "B-1", tune: [480, 477, 474, 470, 467, 463, 460, 457, 453, 450, 447, 444, 441, 437, 434, 431] },
  C2: { period: 428, name: "C-2", tune: [453, 450, 447, 444, 441, 437, 434, 431, 428, 425, 422, 419, 416, 413, 410, 407] },
  Cs2: { period: 404, name: "C#2", tune: [428, 425, 422, 419, 416, 413, 410, 407, 404, 401, 398, 395, 392, 390, 387, 384] },
  D2: { period: 381, name: "D-2", tune: [404, 401, 398, 395, 392, 390, 387, 384, 381, 379, 376, 373, 370, 368, 365, 363] },
  Ds2: { period: 360, name: "D#2", tune: [381, 379, 376, 373, 370, 368, 365, 363, 360, 357, 355, 352, 350, 347, 345, 342] },
  E2: { period: 339, name: "E-2", tune: [360, 357, 355, 352, 350, 347, 345, 342, 339, 337, 335, 332, 330, 328, 325, 323] },
  F2: { period: 320, name: "F-2", tune: [339, 337, 335, 332, 330, 328, 325, 323, 320, 318, 316, 314, 312, 309, 307, 305] },
  Fs2: { period: 302, name: "F#2", tune: [320, 318, 316, 314, 312, 309, 307, 305, 302, 300, 298, 296, 294, 292, 290, 288] },
  G2: { period: 285, name: "G-2", tune: [302, 300, 298, 296, 294, 292, 290, 288, 285, 284, 282, 280, 278, 276, 274, 272] },
  Gs2: { period: 269, name: "G#2", tune: [285, 284, 282, 280, 278, 276, 274, 272, 269, 268, 266, 264, 262, 260, 258, 256] },
  A2: { period: 254, name: "A-2", tune: [269, 268, 266, 264, 262, 260, 258, 256, 254, 253, 251, 249, 247, 245, 244, 242] },
  As2: { period: 240, name: "A#2", tune: [254, 253, 251, 249, 247, 245, 244, 242, 240, 239, 237, 235, 233, 232, 230, 228] },
  B2: { period: 226, name: "B-2", tune: [240, 238, 237, 235, 233, 232, 230, 228, 226, 225, 224, 222, 220, 219, 217, 216] },
  C3: { period: 214, name: "C-3", tune: [226, 225, 223, 222, 220, 219, 217, 216, 214, 213, 211, 209, 208, 206, 205, 204] },
  Cs3: { period: 202, name: "C#3", tune: [214, 212, 211, 209, 208, 206, 205, 203, 202, 201, 199, 198, 196, 195, 193, 192] },
  D3: { period: 190, name: "D-3", tune: [202, 200, 199, 198, 196, 195, 193, 192, 190, 189, 188, 187, 185, 184, 183, 181] },
  Ds3: { period: 180, name: "D#3", tune: [190, 189, 188, 187, 185, 184, 183, 181, 180, 179, 177, 176, 175, 174, 172, 171] },
  E3: { period: 170, name: "E-3", tune: [180, 179, 177, 176, 175, 174, 172, 171, 170, 169, 167, 166, 165, 164, 163, 161] },
  F3: { period: 160, name: "F-3", tune: [170, 169, 167, 166, 165, 164, 163, 161, 160, 159, 158, 157, 156, 155, 154, 152] },
  Fs3: { period: 151, name: "F#3", tune: [160, 159, 158, 157, 156, 155, 154, 152, 151, 150, 149, 148, 147, 146, 145, 144] },
  G3: { period: 143, name: "G-3", tune: [151, 150, 149, 148, 147, 146, 145, 144, 143, 142, 141, 140, 139, 138, 137, 136] },
  Gs3: { period: 135, name: "G#3", tune: [143, 142, 141, 140, 139, 138, 137, 136, 135, 134, 133, 132, 131, 130, 129, 128] },
  A3: { period: 127, name: "A-3", tune: [135, 134, 133, 132, 131, 130, 129, 128, 127, 126, 125, 125, 124, 123, 122, 121] },
  As3: { period: 120, name: "A#3", tune: [127, 126, 125, 125, 123, 123, 122, 121, 120, 119, 118, 118, 117, 116, 115, 114] },
  B3: { period: 113, name: "B-3", tune: [120, 119, 118, 118, 117, 116, 115, 114, 113, 113, 112, 111, 110, 109, 109, 108] }
};
var FTNOTEPERIOD = {
  None: { name: "---" },
  C0: { name: "C-0", period: 6848 },
  Cs0: { name: "C#0", period: 6464 },
  D0: { name: "D-0", period: 6096 },
  Ds0: { name: "D#0", period: 5760 },
  E0: { name: "E-0", period: 5424 },
  F0: { name: "F-0", period: 5120 },
  Fs0: { name: "F#0", period: 4832 },
  G0: { name: "G-0", period: 4560 },
  Gs0: { name: "G#0", period: 4304 },
  A0: { name: "A-0", period: 4064 },
  As0: { name: "A#0", period: 3840 },
  B0: { name: "B-0", period: 3624 },
  C1: { name: "C-1", period: 3424 },
  Cs1: { name: "C#1", period: 3232 },
  D1: { name: "D-1", period: 3048 },
  Ds1: { name: "D#1", period: 2880 },
  E1: { name: "E-1", period: 2712 },
  F1: { name: "F-1", period: 2560 },
  Fs1: { name: "F#1", period: 2416 },
  G1: { name: "G-1", period: 2280 },
  Gs1: { name: "G#1", period: 2152 },
  A1: { name: "A-1", period: 2032 },
  As1: { name: "A#1", period: 1920 },
  B1: { name: "B-1", period: 1812 },
  C2: { name: "C-2", period: 1712 },
  Cs2: { name: "C#2", period: 1616 },
  D2: { name: "D-2", period: 1524 },
  Ds2: { name: "D#2", period: 1440 },
  E2: { name: "E-2", period: 1356 },
  F2: { name: "F-2", period: 1280 },
  Fs2: { name: "F#2", period: 1208 },
  G2: { name: "G-2", period: 1140 },
  Gs2: { name: "G#2", period: 1076 },
  A2: { name: "A-2", period: 1016 },
  As2: { name: "A#2", period: 960 },
  B2: { name: "B-2", period: 906 },
  C3: { name: "C-3", period: 856 },
  Cs3: { name: "C#3", period: 808 },
  D3: { name: "D-3", period: 762 },
  Ds3: { name: "D#3", period: 720 },
  E3: { name: "E-3", period: 678 },
  F3: { name: "F-3", period: 640 },
  Fs3: { name: "F#3", period: 604 },
  G3: { name: "G-3", period: 570 },
  Gs3: { name: "G#3", period: 538 },
  A3: { name: "A-3", period: 508 },
  As3: { name: "A#3", period: 480 },
  B3: { name: "B-3", period: 453 },
  C4: { name: "C-4", period: 428 },
  Cs4: { name: "C#4", period: 404 },
  D4: { name: "D-4", period: 381 },
  Ds4: { name: "D#4", period: 360 },
  E4: { name: "E-4", period: 339 },
  F4: { name: "F-4", period: 320 },
  Fs4: { name: "F#4", period: 302 },
  G4: { name: "G-4", period: 285 },
  Gs4: { name: "G#4", period: 269 },
  A4: { name: "A-4", period: 254 },
  As4: { name: "A#4", period: 240 },
  B4: { name: "B-4", period: 226.5, modPeriod: 226 },
  C5: { name: "C-5", period: 214 },
  Cs5: { name: "C#5", period: 202 },
  D5: { name: "D-5", period: 190.5, modPeriod: 190 },
  Ds5: { name: "D#5", period: 180 },
  E5: { name: "E-5", period: 169.5, modPeriod: 170 },
  F5: { name: "F-5", period: 160 },
  Fs5: { name: "F#5", period: 151 },
  G5: { name: "G-5", period: 142.5, modPeriod: 143 },
  Gs5: { name: "G#5", period: 134.5, modPeriod: 135 },
  A5: { name: "A-5", period: 127 },
  As5: { name: "A#5", period: 120 },
  B5: { name: "B-5", period: 113.25, modPeriod: 113 },
  C6: { name: "C-6", period: 107 },
  Cs6: { name: "C#6", period: 101 },
  D6: { name: "D-6", period: 95.25, modPeriod: 95 },
  Ds6: { name: "D#6", period: 90 },
  E6: { name: "E-6", period: 84.75, modPeriod: 85 },
  F6: { name: "F-6", period: 80 },
  Fs6: { name: "F#6", period: 75.5, modPeriod: 75 },
  G6: { name: "G-6", period: 71.25, modPeriod: 71 },
  Gs6: { name: "G#6", period: 67.25, modPeriod: 67 },
  A6: { name: "A-6", period: 63.5, modPeriod: 63 },
  As6: { name: "A#6", period: 60 },
  B6: { name: "B-6", period: 56.625, modPeriod: 56 },
  C7: { name: "C-7", period: 53.5, modPeriod: 53 },
  Cs7: { name: "C#7", period: 50.5, modPeriod: 50 },
  D7: { name: "D-7", period: 47.625, modPeriod: 47 },
  Ds7: { name: "D#7", period: 45 },
  E7: { name: "E-7", period: 42.375, modPeriod: 42 },
  F7: { name: "F-7", period: 40 },
  Fs7: { name: "F#7", period: 37.75, modPeriod: 37 },
  G7: { name: "G-7", period: 35.625, modPeriod: 35 },
  Gs7: { name: "G#7", period: 33.625, modPeriod: 33 },
  A7: { name: "A-7", period: 31.75, modPeriod: 31 },
  As7: { name: "A#7", period: 30 },
  B7: { name: "B-7", period: 28.3125, modPeriod: 28 },
  // not used in fileformat but can be played through transposed notes
  C8: { name: "C-8", period: 26.75 },
  Cs8: { name: "C#8", period: 25.25 },
  D8: { name: "D-8", period: 23.8125 },
  Ds8: { name: "D#8", period: 22.5 },
  E8: { name: "E-8", period: 21.1875 },
  F8: { name: "F-8", period: 20 },
  Fs8: { name: "F#8", period: 18.875 },
  G8: { name: "G-8", period: 17.8125 },
  Gs8: { name: "G#8", period: 16.8125 },
  A8: { name: "A-8", period: 15.875 },
  As8: { name: "A#8", period: 15 },
  B8: { name: "B-8", period: 14.15625 },
  C9: { name: "C-9", period: 13.375 },
  Cs9: { name: "C#9", period: 12.625 },
  D9: { name: "D-9", period: 11.90625 },
  Ds9: { name: "D#9", period: 11.25 },
  E9: { name: "E-9", period: 10.59375 },
  F9: { name: "F-9", period: 10 },
  Fs9: { name: "F#9", period: 9.4375 },
  G9: { name: "G-9", period: 8.90625 },
  Gs9: { name: "G#9", period: 8.40625 },
  A9: { name: "A-9", period: 7.9375 },
  As9: { name: "A#9", period: 7.5 },
  B9: { name: "B-9", period: 7.078125 },
  C10: { name: "C-10", period: 6.6875 },
  Cs10: { name: "C#10", period: 6.3125 },
  D10: { name: "D-10", period: 5.953125 },
  Ds10: { name: "D#10", period: 5.625 },
  E10: { name: "E-10", period: 5.296875 },
  F10: { name: "F-10", period: 5 },
  Fs10: { name: "F#10", period: 4.71875 },
  G10: { name: "G-10", period: 4.453125 },
  Gs10: { name: "G#10", period: 4.203125 },
  A10: { name: "A-10", period: 3.96875 },
  As10: { name: "A#10", period: 3.75 },
  B10: { name: "B-10", period: 3.5390625 },
  C11: { name: "C-11", period: 3.34375 },
  Cs11: { name: "C#11", period: 3.15625 },
  D11: { name: "D-11", period: 2.9765625 },
  Ds11: { name: "D#11", period: 2.8125 },
  E11: { name: "E-11", period: 2.6484375 },
  F11: { name: "F-11", period: 2.5 },
  Fs11: { name: "F#11", period: 2.359375 },
  G11: { name: "G-11", period: 2.2265625 },
  Gs11: { name: "G#11", period: 2.1015625 },
  A11: { name: "A-11", period: 1.984375 },
  As11: { name: "A#11", period: 1.875 },
  B11: { name: "B-11", period: 1.76953125 },
  OFF: { name: "OFF", period: 0 }
};
var NOTEOFF = 145;
var TRACKERMODE = {
  PROTRACKER: 1,
  FASTTRACKER: 2
};
var SETTINGS = {
  stereoSeparation: STEREOSEPARATION.BALANCED,
  emulateProtracker1OffsetBug: true
};
function BinaryStream(arrayBuffer, bigEndian) {
  var obj = {
    index: 0,
    litteEndian: !bigEndian
  };
  obj.goto = function(value) {
    setIndex(value);
  };
  obj.jump = function(value) {
    this.goto(this.index + value);
  };
  obj.readByte = function(position) {
    setIndex(position);
    var b = this.dataView.getInt8(this.index);
    this.index++;
    return b;
  };
  obj.readUbyte = function(position) {
    setIndex(position);
    var b = this.dataView.getUint8(this.index);
    this.index++;
    return b;
  };
  obj.readUint = function(position) {
    setIndex(position);
    var i = this.dataView.getUint32(this.index, this.litteEndian);
    this.index += 4;
    return i;
  };
  obj.readBytes = function(len, position, buffer) {
    setIndex(position);
    if (!buffer)
      buffer = new Uint8Array(len);
    var i = this.index;
    var offset = 0;
    for (; offset < len; offset++)
      buffer[offset] = this.dataView.getInt8(i + offset);
    this.index += len;
    return buffer;
  };
  obj.readString = function(len, position) {
    setIndex(position);
    var i = this.index;
    var src = this.dataView;
    var text = "";
    if ((len += i) > this.length)
      len = this.length;
    for (; i < len; ++i) {
      var c = src.getUint8(i);
      if (c == 0)
        break;
      text += String.fromCharCode(c);
    }
    this.index = len;
    return text;
  };
  obj.readWord = function(position) {
    setIndex(position);
    var w = this.dataView.getUint16(this.index, this.litteEndian);
    this.index += 2;
    return w;
  };
  obj.readLong = obj.readDWord = obj.readUint;
  obj.readShort = function(value, position) {
    setIndex(position);
    var w = this.dataView.getInt16(this.index, this.litteEndian);
    this.index += 2;
    return w;
  };
  obj.isEOF = function(margin) {
    margin = margin || 0;
    return this.index >= this.length - margin;
  };
  obj.toString = function() {
    return new TextDecoder().decode(arrayBuffer);
  };
  function setIndex(value) {
    value = value === 0 ? value : value || obj.index;
    if (value < 0)
      value = 0;
    if (value >= obj.length)
      value = obj.length - 1;
    obj.index = value;
  }
  if (arrayBuffer) {
    obj.buffer = arrayBuffer;
    obj.dataView = new DataView(arrayBuffer);
    obj.length = arrayBuffer.byteLength;
  }
  return obj;
}
var Sample = function() {
  var me = {};
  me.data = [];
  me.length = 0;
  me.name = "";
  me.bits = 8;
  me.volume = 64;
  me.finetune = 0;
  me.finetuneX = 0;
  me.panning = 0;
  me.relativeNote = 0;
  me.loop = {
    enabled: false,
    start: 0,
    length: 0,
    type: 0
  };
  return me;
};
const allEventHandlers = {};
const EventBus = {
  on: (event, listener) => {
    allEventHandlers[event] = allEventHandlers[event] || [];
    allEventHandlers[event].push(listener);
    return allEventHandlers[event].length;
  },
  off: (event, index) => {
    let eventHandlers = allEventHandlers[event];
    if (eventHandlers)
      eventHandlers[index - 1] = void 0;
  },
  trigger: (event, context) => {
    let eventHandlers = allEventHandlers[event];
    if (eventHandlers && eventHandlers.length) {
      eventHandlers.forEach((handler) => {
        if (handler)
          handler(context, event);
      });
    }
  }
};
let FilterChain = function() {
  var me = {};
  var input, output;
  var volumeValue = 70;
  var panningValue = 0;
  var context = Audio.context;
  var volumeGain, panner;
  input = context.createGain();
  input.gain.value = 1;
  output = input;
  function connectFilters() {
    output = input;
    panner = panner || Audio.context.createStereoPanner();
    output.connect(panner);
    output = panner;
    volumeGain = volumeGain || context.createGain();
    output.connect(volumeGain);
  }
  function init() {
    connectFilters();
    me.volumeValue(volumeValue);
  }
  me.volumeValue = function(value) {
    if (typeof value !== "undefined") {
      var max = 100;
      volumeValue = value;
      var fraction = value / max;
      volumeGain.gain.value = fraction * fraction;
    }
    return volumeValue;
  };
  me.panningValue = function(value, time) {
    if (typeof value !== "undefined") {
      panningValue = value;
      if (time) {
        panner.pan.setValueAtTime(panningValue, time);
      } else {
        panner.pan.setValueAtTime(panningValue, Audio.context.currentTime);
      }
    }
    return panningValue;
  };
  me.setState = function() {
  };
  me.input = function() {
    return input;
  };
  me.output = function() {
    return output;
  };
  init();
  return me;
};
var Audio = function() {
  var me = {};
  window.AudioContext = window.AudioContext || window.webkitAudioContext;
  var context;
  var masterVolume;
  var cutOffVolume;
  var lowPassfilter;
  var highShelfFilter;
  var i;
  var filterChains = [];
  var currentStereoSeparation = STEREOSEPARATION.BALANCED;
  var lastMasterVolume = 0;
  var usePanning;
  var hasUI;
  var scheduledNotes = [[], [], []];
  var scheduledNotesBucket = 0;
  var prevSampleRate = 4143.569;
  function createAudioConnections(audioContext, destination) {
    cutOffVolume = audioContext.createGain();
    cutOffVolume.gain.setValueAtTime(1, 0);
    cutOffVolume.connect(destination || audioContext.destination);
    masterVolume = audioContext.createGain();
    masterVolume.connect(cutOffVolume);
    me.setMasterVolume(1);
    lowPassfilter = audioContext.createBiquadFilter();
    lowPassfilter.type = "lowpass";
    lowPassfilter.frequency.setValueAtTime(2e4, 0);
    highShelfFilter = context.createBiquadFilter();
    highShelfFilter.type = "highshelf";
    highShelfFilter.frequency.value = 1200;
    highShelfFilter.gain.value = 4;
    lowPassfilter.connect(highShelfFilter);
    highShelfFilter.connect(masterVolume);
    me.masterVolume = masterVolume;
    me.cutOffVolume = cutOffVolume;
    me.lowPassfilter = lowPassfilter;
  }
  if (AudioContext) {
    context = new AudioContext();
  }
  me.init = function(audioContext, destination) {
    audioContext = audioContext || context;
    context = audioContext;
    me.context = context;
    if (!audioContext)
      return;
    usePanning = !!Audio.context.createStereoPanner;
    hasUI = false;
    createAudioConnections(audioContext, destination);
    var numberOfTracks = Tracker.getTrackCount();
    filterChains = [];
    function addFilterChain() {
      var filterChain = FilterChain();
      filterChain.output().connect(lowPassfilter);
      filterChains.push(filterChain);
    }
    for (i = 0; i < numberOfTracks; i++)
      addFilterChain();
    me.filterChains = filterChains;
    me.usePanning = usePanning;
    EventBus.on(EVENT.trackCountChange, function(trackCount) {
      for (i = filterChains.length; i < trackCount; i++)
        addFilterChain();
      EventBus.trigger(EVENT.filterChainCountChange, trackCount);
      me.setStereoSeparation(currentStereoSeparation);
    });
    EventBus.on(EVENT.trackerModeChanged, function(mode) {
      me.setStereoSeparation();
    });
  };
  me.enable = function() {
    if (!cutOffVolume)
      return;
    cutOffVolume.gain.setValueAtTime(1, 0);
    me.cutOff = false;
  };
  me.disable = function() {
    if (!cutOffVolume)
      return;
    cutOffVolume.gain.setValueAtTime(0, 0);
    me.cutOff = true;
    var totalNotes = 0;
    scheduledNotes.forEach(function(bucket, index) {
      totalNotes += bucket.length;
      bucket.forEach(function(volume) {
        if (volume && volume.gain) {
          volume.gain.cancelScheduledValues(0);
          volume.gain.setValueAtTime(0, 0);
        }
      });
      scheduledNotes[index] = [];
    });
  };
  me.checkState = function() {
    if (context) {
      if (context.state === "suspended" && context.resume) {
        context.resume();
      }
    }
  };
  me.playSample = function(index, period, volume, track, effects, time, noteIndex) {
    var audioContext;
    audioContext = context;
    me.enable();
    period = period || 428;
    if (typeof track === "undefined")
      track = hasUI ? Editor.getCurrentTrack() : 0;
    time = time || context.currentTime;
    if (noteIndex === NOTEOFF) {
      volume = 0;
    }
    var instrument = Tracker.getInstrument(index);
    var basePeriod = period;
    var volumeEnvelope;
    var panningEnvelope;
    var scheduled;
    var pan = 0;
    if (instrument) {
      var sampleBuffer;
      var offset = 0;
      var sampleLength = 0;
      volume = typeof volume === "undefined" ? 100 * instrument.sample.volume / 64 : volume;
      pan = (instrument.sample.panning || 0) / 128;
      var sampleRate;
      if (Tracker.inFTMode()) {
        if (Tracker.useLinearFrequency) {
          period -= instrument.getFineTune() / 2;
        } else {
          if (instrument.getFineTune()) {
            period = me.getFineTuneForNote(noteIndex, instrument.getFineTune());
          }
        }
      } else {
        if (instrument.getFineTune()) {
          period = me.getFineTuneForPeriod(period, instrument.getFineTune());
        }
      }
      sampleRate = me.getSampleRateForPeriod(period);
      var initialPlaybackRate = 1;
      if (instrument.sample.data.length) {
        sampleLength = instrument.sample.data.length;
        if (effects && effects.offset) {
          if (effects.offset.value >= sampleLength)
            effects.offset.value = sampleLength - 1;
          offset = effects.offset.value / audioContext.sampleRate;
        }
        sampleBuffer = audioContext.createBuffer(1, sampleLength, audioContext.sampleRate);
        initialPlaybackRate = sampleRate / audioContext.sampleRate;
      } else {
        sampleBuffer = audioContext.createBuffer(1, 1, audioContext.sampleRate);
        offset = 0;
      }
      var buffering = sampleBuffer.getChannelData(0);
      for (i = 0; i < sampleLength; i++) {
        buffering[i] = instrument.sample.data[i];
      }
      prevSampleRate = sampleRate;
      var source = audioContext.createBufferSource();
      source.buffer = sampleBuffer;
      var volumeGain = audioContext.createGain();
      volumeGain.gain.value = volume / 100;
      volumeGain.gain.setValueAtTime(volume / 100, time);
      if (instrument.sample.loop.enabled && instrument.sample.loop.length > 2) {
        if (!SETTINGS.unrollLoops) {
          source.loop = true;
          source.loopStart = instrument.sample.loop.start / audioContext.sampleRate;
          source.loopEnd = (instrument.sample.loop.start + instrument.sample.loop.length) / audioContext.sampleRate;
        }
      }
      if (instrument.volumeEnvelope.enabled || instrument.panningEnvelope.enabled || instrument.hasVibrato()) {
        var envelopes = instrument.noteOn(time);
        var target = source;
        if (envelopes.volume) {
          volumeEnvelope = envelopes.volume;
          source.connect(volumeEnvelope);
          target = volumeEnvelope;
        }
        if (envelopes.panning) {
          panningEnvelope = envelopes.panning;
          target.connect(panningEnvelope);
          target = panningEnvelope;
        }
        scheduled = envelopes.scheduled;
        target.connect(volumeGain);
      } else {
        source.connect(volumeGain);
      }
      var volumeFadeOut = Audio.context.createGain();
      if (Tracker.inFTMode()) {
        volumeFadeOut.gain.setValueAtTime(0, time);
        volumeFadeOut.gain.linearRampToValueAtTime(1, time + 0.01);
      } else {
        volumeFadeOut.gain.setValueAtTime(1, time);
      }
      volumeGain.connect(volumeFadeOut);
      if (usePanning) {
        var panning = Audio.context.createStereoPanner();
        panning.pan.setValueAtTime(pan, time);
        volumeFadeOut.connect(panning);
        panning.connect(filterChains[track].input());
      } else {
        volumeFadeOut.connect(filterChains[track].input());
      }
      source.playbackRate.value = initialPlaybackRate;
      var sourceDelayTime = 0;
      var playTime = time + sourceDelayTime;
      source.start(playTime, offset);
      var result = {
        source,
        volume: volumeGain,
        panning,
        volumeEnvelope,
        panningEnvelope,
        volumeFadeOut,
        startVolume: volume,
        currentVolume: volume,
        startPeriod: period,
        basePeriod,
        noteIndex,
        startPlaybackRate: initialPlaybackRate,
        sampleRate,
        instrumentIndex: index,
        effects,
        track,
        time,
        scheduled
      };
      scheduledNotes[scheduledNotesBucket].push(volumeGain);
      EventBus.trigger(EVENT.samplePlay, result);
      return result;
    }
    return {};
  };
  me.setStereoSeparation = function(value) {
    var panAmount;
    var numberOfTracks = Tracker.getTrackCount();
    if (Tracker.inFTMode()) {
      panAmount = 0;
    } else {
      value = value || currentStereoSeparation;
      currentStereoSeparation = value;
      switch (value) {
        case STEREOSEPARATION.NONE:
          panAmount = 0;
          SETTINGS.stereoSeparation = STEREOSEPARATION.NONE;
          break;
        case STEREOSEPARATION.FULL:
          panAmount = 1;
          SETTINGS.stereoSeparation = STEREOSEPARATION.FULL;
          break;
        default:
          panAmount = 0.3;
          SETTINGS.stereoSeparation = STEREOSEPARATION.BALANCED;
          break;
      }
    }
    for (i = 0; i < numberOfTracks; i++) {
      var filter = filterChains[i];
      if (filter)
        filter.panningValue(i % 4 === 0 || i % 4 === 3 ? -panAmount : panAmount);
    }
  };
  me.getPrevSampleRate = function() {
    return prevSampleRate;
  };
  me.context = context;
  me.getSemiToneFrom = function(period, semitones, finetune) {
    var result = period;
    if (finetune) {
      period = me.getFineTuneBasePeriod(period, finetune);
      if (!period) {
        period = result;
      }
    }
    if (semitones) {
      var rootNote = periodNoteTable[period];
      if (rootNote) {
        var rootIndex = noteNames.indexOf(rootNote.name);
        var targetName = noteNames[rootIndex + semitones];
        if (targetName) {
          var targetNote = nameNoteTable[targetName];
          if (targetNote) {
            result = targetNote.period;
            if (finetune) {
              result = me.getFineTuneForPeriod(result, finetune);
            }
          }
        }
      }
    }
    return result;
  };
  me.getNearestSemiTone = function(period, instrumentIndex) {
    var result = period;
    var minDelta = 1e5;
    var instrument = Tracker.getInstrument(instrumentIndex);
    var note, p, delta;
    if (Tracker.inFTMode()) {
      var targetIndex = 0;
      FTNotes.forEach(function(note2, index) {
        p = note2.period;
        if (p) {
          delta = Math.abs(p - period);
          if (delta < minDelta) {
            minDelta = delta;
            result = p;
            targetIndex = index;
          }
        }
      });
      if (targetIndex && instrument && instrument.getFineTune()) {
        if (Tracker.useLinearFrequency) {
          result -= instrument.getFineTune() / 2;
        } else {
          result = me.getFineTuneForNote(targetIndex, instrument.getFineTune());
        }
      }
    } else {
      var tuning = 8;
      if (instrumentIndex) {
        if (instrument && instrument.sample.finetune)
          tuning = tuning + instrument.sample.finetune;
      }
      for (note in NOTEPERIOD) {
        if (NOTEPERIOD.hasOwnProperty(note)) {
          p = NOTEPERIOD[note].tune[tuning];
          delta = Math.abs(p - period);
          if (delta < minDelta) {
            minDelta = delta;
            result = p;
          }
        }
      }
    }
    return result;
  };
  me.getFineTuneForPeriod = function(period, finetune) {
    var result = period;
    var note = periodNoteTable[period];
    if (note && note.tune) {
      var tune = 8 + finetune;
      if (tune >= 0 && tune < note.tune.length)
        result = note.tune[tune];
    }
    return result;
  };
  me.getFineTuneForNote = function(note, finetune) {
    if (note === NOTEOFF)
      return 1;
    var ftNote1 = FTNotes[note];
    var ftNote2 = finetune > 0 ? FTNotes[note + 1] : FTNotes[note - 1];
    if (ftNote1 && ftNote2) {
      var delta = Math.abs(ftNote2.period - ftNote1.period) / 127;
      return ftNote1.period - delta * finetune;
    }
    return ftNote1 ? ftNote1.period : 1e5;
  };
  me.getFineTuneBasePeriod = function(period, finetune) {
    var result = period;
    var table = periodFinetuneTable[finetune];
    if (table) {
      result = table[period];
    }
    return result;
  };
  me.getSampleRateForPeriod = function(period) {
    if (Tracker.inFTMode()) {
      if (Tracker.useLinearFrequency)
        return 8363 * Math.pow(2, (4608 - period) / 768);
      return PC_FREQUENCY_HALF / period;
    }
    return AMIGA_PALFREQUENCY_HALF / period;
  };
  me.limitAmigaPeriod = function(period) {
    period = Math.max(period, 113);
    period = Math.min(period, 856);
    return period;
  };
  me.setAmigaLowPassFilter = function(on, time) {
    var value = on ? 2e3 : 21e3;
    lowPassfilter.frequency.setValueAtTime(value, time);
  };
  me.setMasterVolume = function(value, time) {
    if (!masterVolume || !masterVolume.gain) return;
    time = time || context.currentTime;
    value = value * 0.7;
    masterVolume.gain.setValueAtTime(lastMasterVolume, time);
    masterVolume.gain.linearRampToValueAtTime(value, time + 0.02);
    lastMasterVolume = value;
  };
  me.slideMasterVolume = function(value, time) {
    if (!masterVolume || !masterVolume.gain) return;
    time = time || context.currentTime;
    value = value * 0.7;
    masterVolume.gain.linearRampToValueAtTime(value, time);
    lastMasterVolume = value;
  };
  me.getLastMasterVolume = function() {
    return lastMasterVolume / 0.7;
  };
  me.clearScheduledNotesCache = function() {
    scheduledNotesBucket++;
    if (scheduledNotesBucket > 2)
      scheduledNotesBucket = 0;
    scheduledNotes[scheduledNotesBucket] = [];
  };
  me.waveFormFunction = {
    sine: function(period, progress, freq, amp) {
      return period + Math.sin(progress * freq * 0.8) * amp * 1.7;
    },
    saw: function(period, progress, freq, amp) {
      var value = 1 - Math.abs(progress * freq / 7 % 1);
      value = value * 2 - 1;
      value = value * amp * -2;
      return period + value;
    },
    square: function(period, progress, freq, amp) {
      var value = Math.sin(progress * freq) <= 0 ? -1 : 1;
      value = value * amp * 2;
      return period + value;
    },
    sawInverse: function(period, progress, freq, amp) {
      var value = Math.abs(progress * freq / 7 % 1);
      value = value * 2 - 1;
      value = value * amp * -2;
      return period + value;
    }
  };
  return me;
}();
var Instrument = function() {
  var me = {};
  me.type = "sample";
  me.name = "";
  me.instrumentIndex = 0;
  me.sampleIndex = -1;
  me.fadeout = 128;
  me.data = [];
  me.samples = [Sample()];
  me.sample = me.samples[0];
  me.volumeEnvelope = { raw: [], enabled: false, points: [[0, 48], [10, 64], [20, 40], [30, 18], [40, 28], [50, 18]], count: 6 };
  me.panningEnvelope = { raw: [], enabled: false, points: [[0, 32], [20, 40], [40, 24], [60, 32], [80, 32]], count: 5 };
  me.vibrato = {};
  me.sampleNumberForNotes = [];
  me.play = function(noteIndex, notePeriod, volume, track, trackEffects, time) {
    if (Tracker.inFTMode()) {
      notePeriod = me.getPeriodForNote(noteIndex);
    }
    return Audio.playSample(me.instrumentIndex, notePeriod, volume, track, trackEffects, time, noteIndex);
  };
  me.noteOn = function(time) {
    var volumeEnvelope;
    var panningEnvelope;
    var scheduled = {};
    if (me.volumeEnvelope.enabled) {
      volumeEnvelope = Audio.context.createGain();
      var envelope = me.volumeEnvelope;
      var scheduledTime = processEnvelop(envelope, volumeEnvelope, time);
      if (scheduledTime)
        scheduled.volume = time + scheduledTime;
    }
    if (me.panningEnvelope.enabled && Audio.usePanning) {
      panningEnvelope = Audio.context.createStereoPanner();
      envelope = me.panningEnvelope;
      scheduledTime = processEnvelop(envelope, panningEnvelope, time);
      if (scheduledTime)
        scheduled.panning = time + scheduledTime;
    }
    if (me.vibrato.rate && me.vibrato.depth) {
      scheduled.ticks = 0;
      scheduled.vibrato = time;
      scheduled.vibratoFunction = me.getAutoVibratoFunction();
    }
    return { volume: volumeEnvelope, panning: panningEnvelope, scheduled };
  };
  me.noteOff = function(time, noteInfo) {
    if (!noteInfo || !noteInfo.volume)
      return;
    function cancelScheduledValues() {
      noteInfo.volume.gain.cancelScheduledValues(time);
      noteInfo.volumeFadeOut.gain.cancelScheduledValues(time);
      if (noteInfo.volumeEnvelope)
        noteInfo.volumeEnvelope.gain.cancelScheduledValues(time);
      if (noteInfo.panningEnvelope)
        noteInfo.panningEnvelope.pan.cancelScheduledValues(time);
      noteInfo.scheduled = void 0;
    }
    if (Tracker.inFTMode()) {
      var tickTime = Tracker.getProperties().tickTime;
      if (me.volumeEnvelope.enabled) {
        if (me.volumeEnvelope.sustain && noteInfo.volumeEnvelope) {
          cancelScheduledValues();
          var timeOffset = 0;
          var startPoint = me.volumeEnvelope.points[me.volumeEnvelope.sustainPoint];
          if (startPoint)
            timeOffset = startPoint[0] * tickTime;
          for (var p = me.volumeEnvelope.sustainPoint; p < me.volumeEnvelope.count; p++) {
            var point = me.volumeEnvelope.points[p];
            if (point)
              noteInfo.volumeEnvelope.gain.linearRampToValueAtTime(point[1] / 64, time + point[0] * tickTime - timeOffset);
          }
        }
        if (me.fadeout) {
          var fadeOutTime = 65536 / me.fadeout * tickTime / 2;
          noteInfo.volumeFadeOut.gain.linearRampToValueAtTime(0, time + fadeOutTime);
        }
      } else {
        cancelScheduledValues();
        noteInfo.volumeFadeOut.gain.linearRampToValueAtTime(0, time + 0.1);
      }
      if (me.panningEnvelope.enabled && Audio.usePanning && noteInfo.panningEnvelope) {
        timeOffset = 0;
        startPoint = me.panningEnvelope.points[me.panningEnvelope.sustainPoint];
        if (startPoint)
          timeOffset = startPoint[0] * tickTime;
        for (p = me.panningEnvelope.sustainPoint; p < me.panningEnvelope.count; p++) {
          point = me.panningEnvelope.points[p];
          if (point)
            noteInfo.panningEnvelope.pan.linearRampToValueAtTime((point[1] - 32) / 32, time + point[0] * tickTime - timeOffset);
        }
      }
      return 100;
    } else {
      cancelScheduledValues();
      if (noteInfo.isKey && noteInfo.volume) {
        noteInfo.volume.gain.linearRampToValueAtTime(0, time + 0.5);
      } else {
        return 0;
      }
    }
  };
  function processEnvelop(envelope, audioNode, time) {
    var tickTime = Tracker.getProperties().tickTime;
    var maxPoint = envelope.sustain ? envelope.sustainPoint + 1 : envelope.count;
    envelope.loopStartPoint = Math.min(envelope.loopStartPoint, envelope.count - 1);
    envelope.loopEndPoint = Math.min(envelope.loopEndPoint, envelope.count - 1);
    var doLoop = envelope.loop && envelope.loopStartPoint < envelope.loopEndPoint;
    if (envelope.sustain && envelope.sustainPoint <= envelope.loopStartPoint)
      doLoop = false;
    if (doLoop)
      maxPoint = envelope.loopEndPoint + 1;
    var scheduledTime = 0;
    var lastX = 0;
    if (audioNode.gain) {
      var audioParam = audioNode.gain;
      var center = 0;
      var max = 64;
    } else {
      audioParam = audioNode.pan;
      center = 32;
      max = 32;
    }
    audioParam.setValueAtTime((envelope.points[0][1] - center) / max, time);
    for (var p = 1; p < maxPoint; p++) {
      var point = envelope.points[p];
      lastX = point[0];
      scheduledTime = lastX * tickTime;
      audioParam.linearRampToValueAtTime((point[1] - center) / max, time + scheduledTime);
    }
    if (doLoop) {
      return me.scheduleEnvelopeLoop(audioNode, time, 2, scheduledTime);
    }
    return false;
  }
  me.scheduleEnvelopeLoop = function(audioNode, startTime, seconds, scheduledTime) {
    scheduledTime = scheduledTime || 0;
    var tickTime = Tracker.getProperties().tickTime;
    if (audioNode.gain) {
      var envelope = me.volumeEnvelope;
      var audioParam = audioNode.gain;
      var center = 0;
      var max = 64;
    } else {
      envelope = me.panningEnvelope;
      audioParam = audioNode.pan;
      center = 32;
      max = 32;
    }
    var point = envelope.points[envelope.loopStartPoint];
    var loopStartX = point[0];
    var doLoop = envelope.loop && envelope.loopStartPoint < envelope.loopEndPoint;
    if (doLoop) {
      while (scheduledTime < seconds) {
        var startScheduledTime = scheduledTime;
        for (var p = envelope.loopStartPoint; p <= envelope.loopEndPoint; p++) {
          point = envelope.points[p];
          scheduledTime = startScheduledTime + (point[0] - loopStartX) * tickTime;
          audioParam.linearRampToValueAtTime((point[1] - center) / max, startTime + scheduledTime);
        }
      }
    }
    return scheduledTime;
  };
  me.scheduleAutoVibrato = function(note, seconds) {
    var scheduledTime = 0;
    note.scheduled.ticks = note.scheduled.ticks || 0;
    var tickTime = Tracker.getProperties().tickTime;
    var freq = -me.vibrato.rate / 40;
    var amp = me.vibrato.depth / 8;
    if (Tracker.useLinearFrequency)
      amp *= 4;
    var currentPeriod, vibratoFunction, time, tick;
    if (note.source) {
      currentPeriod = note.startPeriod;
      vibratoFunction = note.scheduled.vibratoFunction || Audio.waveFormFunction.sine;
      time = note.scheduled.vibrato || Audio.context.currentTime;
      tick = 0;
    }
    while (scheduledTime < seconds) {
      scheduledTime += tickTime;
      if (currentPeriod) {
        var sweepAmp = 1;
        if (me.vibrato.sweep && note.scheduled.ticks < me.vibrato.sweep) {
          sweepAmp = 1 - (me.vibrato.sweep - note.scheduled.ticks) / me.vibrato.sweep;
        }
        var targetPeriod = vibratoFunction(currentPeriod, note.scheduled.ticks, freq, amp * sweepAmp);
        Tracker.setPeriodAtTime(note, targetPeriod, time + tick * tickTime);
        tick++;
      }
      note.scheduled.ticks++;
    }
    return scheduledTime;
  };
  me.getAutoVibratoFunction = function() {
    switch (me.vibrato.type) {
      case 1:
        return Audio.waveFormFunction.square;
      case 2:
        return Audio.waveFormFunction.saw;
      case 3:
        return Audio.waveFormFunction.sawInverse;
    }
    return Audio.waveFormFunction.sine;
  };
  me.resetVolume = function(time, noteInfo) {
    if (noteInfo.volumeFadeOut) {
      noteInfo.volumeFadeOut.gain.cancelScheduledValues(time);
      noteInfo.volumeFadeOut.gain.setValueAtTime(1, time);
    }
    if (noteInfo.volumeEnvelope) {
      noteInfo.volumeEnvelope.gain.cancelScheduledValues(time);
      var tickTime = Tracker.getProperties().tickTime;
      var maxPoint = me.volumeEnvelope.sustain ? me.volumeEnvelope.sustainPoint + 1 : me.volumeEnvelope.count;
      noteInfo.volumeEnvelope.gain.setValueAtTime(me.volumeEnvelope.points[0][1] / 64, time);
      for (var p = 1; p < maxPoint; p++) {
        var point = me.volumeEnvelope.points[p];
        noteInfo.volumeEnvelope.gain.linearRampToValueAtTime(point[1] / 64, time + point[0] * tickTime);
      }
    }
  };
  me.getFineTune = function() {
    return Tracker.inFTMode() ? me.sample.finetuneX : me.sample.finetune;
  };
  me.setFineTune = function(finetune) {
    if (Tracker.inFTMode()) {
      me.sample.finetuneX = finetune;
      me.sample.finetune = finetune >> 4;
    } else {
      if (finetune > 7)
        finetune = finetune - 16;
      me.sample.finetune = finetune;
      me.sample.finetuneX = finetune << 4;
    }
  };
  me.getPeriodForNote = function(noteIndex, withFineTune) {
    var result = 0;
    if (Tracker.useLinearFrequency) {
      result = 7680 - (noteIndex - 1) * 64;
      if (withFineTune)
        result -= me.getFineTune() / 2;
    } else {
      result = FTNotes[noteIndex].period;
      if (withFineTune && me.getFineTune()) {
        result = Audio.getFineTuneForNote(noteIndex, me.getFineTune());
      }
    }
    return result;
  };
  me.setSampleForNoteIndex = function(noteIndex) {
    var sampleIndex = me.sampleNumberForNotes[noteIndex - 1];
    if (sampleIndex !== me.sampleIndex && typeof sampleIndex === "number") {
      me.setSampleIndex(sampleIndex);
    }
  };
  me.setSampleIndex = function(index) {
    if (me.sampleIndex !== index) {
      me.sample = me.samples[index];
      me.sampleIndex = index;
      EventBus.trigger(EVENT.sampleIndexChange, me.instrumentIndex);
    }
  };
  me.hasSamples = function() {
    for (var i = 0, max = me.samples.length; i < max; i++) {
      if (me.samples[i].length)
        return true;
    }
  };
  me.hasVibrato = function() {
    return me.vibrato.rate && me.vibrato.depth;
  };
  return me;
};
var Note = function() {
  var me = {};
  me.period = 0;
  me.index = 0;
  me.effect = 0;
  me.instrument = 0;
  me.param = 0;
  me.volumeEffect = 0;
  me.setPeriod = function(period) {
    me.period = period;
    me.index = FTPeriods[period] || 0;
  };
  me.setIndex = function(index) {
    me.index = index;
    var ftNote = FTNotes[index];
    if (ftNote) {
      me.period = ftNote.modPeriod || ftNote.period;
      if (me.period === 1)
        me.period = 0;
    } else {
      me.period = 0;
    }
  };
  me.clear = function() {
    me.instrument = 0;
    me.period = 0;
    me.effect = 0;
    me.param = 0;
    me.index = 0;
    me.volumeEffect = 0;
  };
  return me;
};
var ProTracker = function() {
  var me = {};
  me.load = function(file, name) {
    Tracker.setTrackerMode(TRACKERMODE.PROTRACKER, true);
    Tracker.useLinearFrequency = false;
    Tracker.clearInstruments(31);
    var song = {
      patterns: [],
      restartPosition: 1
    };
    var patternLength = 64;
    var instrumentCount = 31;
    var channelCount = 4;
    song.typeId = file.readString(4, 1080);
    song.title = file.readString(20, 0);
    if (song.typeId === "2CHN")
      channelCount = 2;
    if (song.typeId === "3CHN")
      channelCount = 3;
    if (song.typeId === "5CHN")
      channelCount = 5;
    if (song.typeId === "6CHN")
      channelCount = 6;
    if (song.typeId === "7CHN")
      channelCount = 7;
    if (song.typeId === "8CHN")
      channelCount = 8;
    if (song.typeId === "9CHN")
      channelCount = 9;
    if (song.typeId === "10CH")
      channelCount = 10;
    if (song.typeId === "11CH")
      channelCount = 11;
    if (song.typeId === "12CH")
      channelCount = 12;
    if (song.typeId === "13CH")
      channelCount = 13;
    if (song.typeId === "14CH")
      channelCount = 14;
    if (song.typeId === "15CH")
      channelCount = 15;
    if (song.typeId === "16CH")
      channelCount = 16;
    if (song.typeId === "18CH")
      channelCount = 18;
    if (song.typeId === "20CH")
      channelCount = 20;
    if (song.typeId === "22CH")
      channelCount = 22;
    if (song.typeId === "24CH")
      channelCount = 24;
    if (song.typeId === "26CH")
      channelCount = 26;
    if (song.typeId === "28CH")
      channelCount = 28;
    if (song.typeId === "30CH")
      channelCount = 30;
    if (song.typeId === "32CH")
      channelCount = 32;
    song.channels = channelCount;
    var sampleDataOffset = 0;
    for (i = 1; i <= instrumentCount; ++i) {
      var instrumentName = file.readString(22);
      var sampleLength = file.readWord();
      var instrument = Instrument();
      instrument.name = instrumentName;
      instrument.sample.length = instrument.sample.realLen = sampleLength << 1;
      var finetune = file.readUbyte();
      if (finetune > 16)
        finetune = finetune % 16;
      if (finetune > 7)
        finetune -= 16;
      instrument.setFineTune(finetune);
      instrument.sample.volume = file.readUbyte();
      instrument.sample.loop.start = file.readWord() << 1;
      instrument.sample.loop.length = file.readWord() << 1;
      instrument.sample.loop.enabled = instrument.sample.loop.length > 2;
      instrument.sample.loop.type = LOOPTYPE.FORWARD;
      instrument.pointer = sampleDataOffset;
      sampleDataOffset += instrument.sample.length;
      instrument.setSampleIndex(0);
      Tracker.setInstrument(i, instrument);
    }
    song.instruments = Tracker.getInstruments();
    file.goto(950);
    song.length = file.readUbyte();
    file.jump(1);
    var patternTable = [];
    var highestPattern = 0;
    for (var i = 0; i < 128; ++i) {
      patternTable[i] = file.readUbyte();
      if (patternTable[i] > highestPattern)
        highestPattern = patternTable[i];
    }
    song.patternTable = patternTable;
    file.goto(1084);
    for (i = 0; i <= highestPattern; ++i) {
      var patternData = [];
      for (var step = 0; step < patternLength; step++) {
        var row = [];
        var channel;
        for (channel = 0; channel < channelCount; channel++) {
          var note = Note();
          var trackStepInfo = file.readUint();
          note.setPeriod(trackStepInfo >> 16 & 4095);
          note.effect = trackStepInfo >> 8 & 15;
          note.instrument = trackStepInfo >> 24 & 240 | trackStepInfo >> 12 & 15;
          note.param = trackStepInfo & 255;
          row.push(note);
        }
        for (channel = channelCount; channel < Tracker.getTrackCount(); channel++) {
          row.push(Note());
        }
        patternData.push(row);
      }
      song.patterns.push(patternData);
    }
    var instrumentContainer = [];
    for (i = 1; i <= instrumentCount; i++) {
      instrument = Tracker.getInstrument(i);
        if (instrument) {
        var sampleEnd = instrument.sample.length;
        for (let j = 0; j < sampleEnd; j++) {
          var b = file.readByte();
          if (j < 2)
            b = 0;
          instrument.sample.data.push(b / 127);
        }
        instrumentContainer.push({ label: i + " " + instrument.name, data: i });
      }
    }
    EventBus.trigger(EVENT.instrumentListChange, instrumentContainer);
    return song;
  };
  return me;
};
var SoundTracker = function() {
  var me = {};
  me.load = function(file, name) {
    Tracker.setTrackerMode(TRACKERMODE.PROTRACKER, true);
    Tracker.useLinearFrequency = false;
    Tracker.clearInstruments(15);
    var song = {
      patterns: [],
      restartPosition: 1
    };
    var patternLength = 64;
    var instrumentCount = 15;
    song.typeId = "ST";
    song.channels = 4;
    song.title = file.readString(20, 0);
    var sampleDataOffset = 0;
    for (i = 1; i <= instrumentCount; ++i) {
      var sampleName = file.readString(22);
      var sampleLength = file.readWord();
      var instrument = Instrument();
      instrument.name = sampleName;
      instrument.sample.length = instrument.realLen = sampleLength << 1;
      instrument.sample.volume = file.readWord();
      instrument.setFineTune(0);
      instrument.sample.loop.start = file.readWord();
      instrument.sample.loop.length = file.readWord() << 1;
      instrument.sample.loop.enabled = instrument.sample.loop.length > 2;
      instrument.sample.loop.type = LOOPTYPE.FORWARD;
      instrument.pointer = sampleDataOffset;
      sampleDataOffset += instrument.sample.length;
      instrument.setSampleIndex(0);
      Tracker.setInstrument(i, instrument);
    }
    song.instruments = Tracker.getInstruments();
    file.goto(470);
    song.length = file.readUbyte();
    song.speed = file.readUbyte();
    var patternTable = [];
    var highestPattern = 0;
    for (var i = 0; i < 128; ++i) {
      patternTable[i] = file.readUbyte();
      if (patternTable[i] > highestPattern)
        highestPattern = patternTable[i];
    }
    song.patternTable = patternTable;
    file.goto(600);
    for (i = 0; i <= highestPattern; ++i) {
      var patternData = [];
      for (var step = 0; step < patternLength; step++) {
        var row = [];
        var channel;
        for (channel = 0; channel < 4; channel++) {
          var trackStep = {};
          var trackStepInfo = file.readUint();
          trackStep.period = trackStepInfo >> 16 & 4095;
          trackStep.effect = trackStepInfo >> 8 & 15;
          trackStep.instrument = trackStepInfo >> 24 & 240 | trackStepInfo >> 12 & 15;
          trackStep.param = trackStepInfo & 255;
          row.push(trackStep);
        }
        for (channel = 4; channel < Tracker.getTrackCount(); channel++) {
          row.push({ note: 0, effect: 0, instrument: 0, param: 0 });
        }
        patternData.push(row);
      }
      song.patterns.push(patternData);
    }
    var instrumentContainer = [];
    for (i = 1; i <= instrumentCount; i++) {
      instrument = Tracker.getInstrument(i);
        if (instrument) {
        var sampleEnd = instrument.sample.length;
        for (let j = 0; j < sampleEnd; j++) {
          var b = file.readByte();
          if (j < 2)
            b = 0;
          instrument.sample.data.push(b / 127);
        }
        instrumentContainer.push({ label: i + " " + instrument.name, data: i });
      }
    }
    EventBus.trigger(EVENT.instrumentListChange, instrumentContainer);
    return song;
  };
  return me;
};
var FastTracker = function() {
  var me = {};
  me.load = function(file) {
    Tracker.setTrackerMode(TRACKERMODE.FASTTRACKER, true);
    Tracker.clearInstruments(1);
    var mod = {};
    var song = {
      patterns: [],
      instruments: []
    };
    file.litteEndian = true;
    file.goto(17);
    song.title = file.readString(20);
    file.jump(1);
    mod.trackerName = file.readString(20);
    mod.trackerVersion = file.readByte();
    mod.trackerVersion = file.readByte() + "." + mod.trackerVersion;
    mod.headerSize = file.readDWord();
    mod.songlength = file.readWord();
    mod.restartPosition = file.readWord();
    mod.numberOfChannels = file.readWord();
    mod.numberOfPatterns = file.readWord();
    mod.numberOfInstruments = file.readWord();
    mod.flags = file.readWord();
    if (mod.flags % 2 === 1) {
      Tracker.useLinearFrequency = true;
    } else {
      Tracker.useLinearFrequency = false;
    }
    mod.defaultTempo = file.readWord();
    mod.defaultBPM = file.readWord();
    var patternTable = [];
    var highestPattern = 0;
    for (var i = 0; i < mod.songlength; ++i) {
      patternTable[i] = file.readUbyte();
      if (highestPattern < patternTable[i])
        highestPattern = patternTable[i];
    }
    song.patternTable = patternTable;
    song.length = mod.songlength;
    song.channels = mod.numberOfChannels;
    song.restartPosition = mod.restartPosition + 1;
    var fileStartPos = 60 + mod.headerSize;
    file.goto(fileStartPos);
    for (i = 0; i < mod.numberOfPatterns; i++) {
      var patternData = [];
      var thisPattern = {};
      thisPattern.headerSize = file.readDWord();
      thisPattern.packingType = file.readUbyte();
      thisPattern.patternLength = file.readWord();
      thisPattern.patternSize = file.readWord();
      fileStartPos += thisPattern.headerSize;
      file.goto(fileStartPos);
      for (var step = 0; step < thisPattern.patternLength; step++) {
        var row = [];
        var channel;
        for (channel = 0; channel < mod.numberOfChannels; channel++) {
          var note = Note();
          var v = file.readUbyte();
          if (v & 128) {
            if (v & 1)
              note.setIndex(file.readUbyte());
            if (v & 2)
              note.instrument = file.readUbyte();
            if (v & 4)
              note.volumeEffect = file.readUbyte();
            if (v & 8)
              note.effect = file.readUbyte();
            if (v & 16)
              note.param = file.readUbyte();
          } else {
            note.setIndex(v);
            note.instrument = file.readUbyte();
            note.volumeEffect = file.readUbyte();
            note.effect = file.readUbyte();
            note.param = file.readUbyte();
          }
          row.push(note);
        }
        patternData.push(row);
      }
      fileStartPos += thisPattern.patternSize;
      file.goto(fileStartPos);
      song.patterns.push(patternData);
    }
    var instrumentContainer = [];
    for (i = 1; i <= mod.numberOfInstruments; ++i) {
      var instrument = Instrument();
      try {
        instrument.filePosition = file.index;
        instrument.headerSize = file.readDWord();
        instrument.name = file.readString(22);
        instrument.type = file.readUbyte();
        instrument.numberOfSamples = file.readWord();
        instrument.samples = [];
        instrument.sampleHeaderSize = 0;
        if (instrument.numberOfSamples > 0) {
          let processEnvelope = function(envelope) {
            envelope.points = [];
            for (si = 0; si < 12; si++)
              envelope.points.push(envelope.raw.slice(si * 2, si * 2 + 2));
            if (envelope.type & 1) {
              envelope.enabled = true;
            }
            if (envelope.type & 2) {
              envelope.sustain = true;
            }
            if (envelope.type & 4) {
              envelope.loop = true;
            }
            return envelope;
          };
          instrument.sampleHeaderSize = file.readDWord();
          instrument.sampleHeaderSize = Math.max(instrument.sampleHeaderSize, 40);
          if (instrument.sampleHeaderSize > 200)
            instrument.sampleHeaderSize = 40;
          for (var si = 0; si < 96; si++)
            instrument.sampleNumberForNotes.push(file.readUbyte());
          for (si = 0; si < 24; si++)
            instrument.volumeEnvelope.raw.push(file.readWord());
          for (si = 0; si < 24; si++)
            instrument.panningEnvelope.raw.push(file.readWord());
          instrument.volumeEnvelope.count = file.readUbyte();
          instrument.panningEnvelope.count = file.readUbyte();
          instrument.volumeEnvelope.sustainPoint = file.readUbyte();
          instrument.volumeEnvelope.loopStartPoint = file.readUbyte();
          instrument.volumeEnvelope.loopEndPoint = file.readUbyte();
          instrument.panningEnvelope.sustainPoint = file.readUbyte();
          instrument.panningEnvelope.loopStartPoint = file.readUbyte();
          instrument.panningEnvelope.loopEndPoint = file.readUbyte();
          instrument.volumeEnvelope.type = file.readUbyte();
          instrument.panningEnvelope.type = file.readUbyte();
          instrument.vibrato.type = file.readUbyte();
          instrument.vibrato.sweep = file.readUbyte();
          instrument.vibrato.depth = Math.min(file.readUbyte(), 15);
          instrument.vibrato.rate = file.readUbyte();
          instrument.fadeout = file.readWord();
          instrument.reserved = file.readWord();
          instrument.volumeEnvelope = processEnvelope(instrument.volumeEnvelope);
          instrument.panningEnvelope = processEnvelope(instrument.panningEnvelope);
        }
      } catch (e) {
      }
      fileStartPos += instrument.headerSize;
      file.goto(fileStartPos);
      if (instrument.numberOfSamples === 0) {
        var sample = Sample();
        instrument.samples.push(sample);
      } else {
        if (file.isEOF(1)) {
          break;
        }
        for (var sampleI = 0; sampleI < instrument.numberOfSamples; sampleI++) {
          sample = Sample();
          sample.length = file.readDWord();
          sample.loop.start = file.readDWord();
          sample.loop.length = file.readDWord();
          sample.volume = file.readUbyte();
          sample.finetuneX = file.readByte();
          sample.type = file.readUbyte();
          sample.panning = file.readUbyte() - 128;
          sample.relativeNote = file.readByte();
          sample.reserved = file.readByte();
          sample.name = file.readString(22);
          sample.bits = 8;
          instrument.samples.push(sample);
          fileStartPos += instrument.sampleHeaderSize;
          file.goto(fileStartPos);
        }
        for (sampleI = 0; sampleI < instrument.numberOfSamples; sampleI++) {
          sample = instrument.samples[sampleI];
          if (!sample.length)
            continue;
          fileStartPos += sample.length;
          if (sample.type & 16) {
            sample.bits = 16;
            sample.type ^= 16;
            sample.length >>= 1;
            sample.loop.start >>= 1;
            sample.loop.length >>= 1;
          }
          sample.loop.type = sample.type || 0;
          sample.loop.enabled = !!sample.loop.type;
          var sampleEnd = sample.length;
          var old = 0;
          if (sample.bits === 16) {
            for (var j = 0; j < sampleEnd; j++) {
              var b = file.readShort() + old;
              if (b < -32768)
                b += 65536;
              else if (b > 32767)
                b -= 65536;
              old = b;
              sample.data.push(b / 32768);
            }
          } else {
            for (j = 0; j < sampleEnd; j++) {
              b = file.readByte() + old;
              if (b < -128)
                b += 256;
              else if (b > 127)
                b -= 256;
              old = b;
              sample.data.push(b / 127);
            }
          }
          if (sample.loop.type === LOOPTYPE.PINGPONG) {
            var loopPart = sample.data.slice(sample.loop.start, sample.loop.start + sample.loop.length);
            sample.data = sample.data.slice(0, sample.loop.start + sample.loop.length);
            sample.data = sample.data.concat(loopPart.reverse());
            sample.loop.length = sample.loop.length * 2;
            sample.length = sample.loop.start + sample.loop.length;
          }
          file.goto(fileStartPos);
        }
      }
      instrument.setSampleIndex(0);
      Tracker.setInstrument(i, instrument);
      instrumentContainer.push({ label: i + " " + instrument.name, data: i });
    }
    EventBus.trigger(EVENT.instrumentListChange, instrumentContainer);
    song.instruments = Tracker.getInstruments();
    Tracker.setBPM(mod.defaultBPM);
    Tracker.setAmigaSpeed(mod.defaultTempo);
    me.validate(song);
    return song;
  };
  me.validate = function(song) {
    function checkEnvelope(envelope, type) {
      var isValid = true;
      if (envelope.points && envelope.points[0]) {
        if (envelope.points[0][0] === 0) {
          var c = 0;
          for (var i = 1; i < envelope.count; i++) {
            var point = envelope.points[i];
            if (point && point[0] > c) {
              c = point[0];
            } else {
              isValid = false;
            }
          }
        } else {
          isValid = false;
        }
      } else {
        isValid = false;
      }
      if (isValid) {
        return envelope;
      } else {
        return type === "volume" ? { raw: [], enabled: false, points: [[0, 48], [10, 64], [20, 40], [30, 18], [40, 28], [50, 18]], count: 6 } : { raw: [], enabled: false, points: [[0, 32], [20, 40], [40, 24], [60, 32], [80, 32]], count: 5 };
      }
    }
    song.instruments.forEach(function(instrument) {
      instrument.volumeEnvelope = checkEnvelope(instrument.volumeEnvelope, "volume");
      instrument.panningEnvelope = checkEnvelope(instrument.panningEnvelope, "panning");
      var maxSampleIndex = instrument.samples.length - 1;
      for (var i = 0, max = instrument.sampleNumberForNotes.length; i < max; i++) {
        instrument.sampleNumberForNotes[i] = Math.min(instrument.sampleNumberForNotes[i], maxSampleIndex);
      }
    });
  };
  return me;
};
let FileDetector = function() {
  let me = {};
  let fileType = {
    unknown: { name: "UNKNOWN", type: FILETYPE.unknown },
    unsupported: { name: "UNSUPPORTED", type: FILETYPE.unknown },
    mod_ProTracker: { name: "PROTRACKER", isMod: true, type: FILETYPE.module, loader: function() {
      return ProTracker();
    } },
    mod_SoundTracker: { name: "SOUNDTRACKER", isMod: true, type: FILETYPE.module, loader: function() {
      return SoundTracker();
    } },
    mod_FastTracker: { name: "FASTTRACKER", isMod: true, type: FILETYPE.module, loader: function() {
      return FastTracker();
    } },
    sample: { name: "SAMPLE", isSample: true, type: FILETYPE.sample },
    zip: { name: "ZIP" },
    gzip: { name: "GZIP" }
  };
  me.detect = function(file, name) {
    let length = file.length;
    let id = "";
    name = name || "";
    if (name.endsWith(".pls"))
      return fileType.playlist;
    if (name.endsWith(".m3u"))
      return fileType.playlist;
    if (name.endsWith(".json")) {
      try {
        let json = JSON.parse(file.toString());
        if (json.modules)
          return fileType.playlist;
      } catch (e) {
      }
      return fileType.unknown;
    }
    id = file.readString(17, 0);
    if (id === "Extended Module: ") {
      return fileType.mod_FastTracker;
    }
    if (length > 1100) {
      id = file.readString(4, 1080);
    }
    let chn = "CHN";
    let ch = "CH";
    if (id === "M.K.")
      return fileType.mod_ProTracker;
    if (id === "M!K!")
      return fileType.mod_ProTracker;
    if (id === "M&K!")
      return fileType.mod_ProTracker;
    if (id === "FLT4")
      return fileType.mod_ProTracker;
    for (let i = 2; i < 10; i++) {
      if (id === i + chn)
        return fileType.mod_ProTracker;
    }
    for (let i = 10; i < 32; i++) {
      if (id === i + ch)
        return fileType.mod_ProTracker;
    }
    let ext = "";
    if (name && name.indexOf(".") > 0)
      ext = name.split(".").pop();
    ext = ext.toLowerCase();
    if (ext === "wav")
      return fileType.sample;
    if (ext === "mp3")
      return fileType.sample;
    if (ext === "iff")
      return fileType.sample;
    if (ext === "flac")
      return fileType.sample;
    if (ext === "ogg")
      return fileType.sample;
    if (ext === "opus")
      return fileType.sample;
    if (ext === "zip")
      return fileType.zip;
    let zipId = file.readString(2, 0);
    if (zipId === "PK")
      return fileType.zip;
    let gzipId = file.readBytes(2, 0);
    if (gzipId[0] === 31 && gzipId[1] === 139)
      return fileType.gzip;
    if (name && name.indexOf(".") >= 0 && length > 1624) {
      let isAscii = function(byte) {
        return byte < 128;
      }, isST = function() {
        file.goto(0);
        for (let i = 0; i < 20; i++)
          if (!isAscii(file.readByte()))
            return false;
        let totalSampleLength = 0;
        let probability = 0;
        for (let s = 0; s < 15; s++) {
          for (let i = 0; i < 22; i++)
            if (!isAscii(file.readByte()))
              return false;
          file.jump(-22);
          let name2 = file.readString(22);
          if (name2.toLowerCase().startsWith("st-"))
            probability += 10;
          if (probability > 20)
            return true;
          totalSampleLength += file.readWord();
          file.jump(6);
        }
        return totalSampleLength * 2 + 1624 <= length;
      };
      let isSoundTracker = isST();
      if (isSoundTracker) {
        return fileType.mod_SoundTracker;
      }
    }
    return fileType.sample;
  };
  return me;
}();
(function(e, t, n) {
  function i(n2, s2) {
    if (!t[n2]) {
      if (!e[n2]) {
        var o = typeof require == "function" && require;
        if (!s2 && o)
          return o(n2, true);
        if (r)
          return r(n2, true);
        throw new Error("'" + n2 + "'");
      }
      var u = t[n2] = { exports: {} };
      e[n2][0].call(u.exports, function(t2) {
        var r2 = e[n2][1][t2];
        return i(r2 ? r2 : t2);
      }, u, u.exports);
    }
    return t[n2].exports;
  }
  var r = typeof require == "function" && require;
  for (var s = 0; s < n.length; s++)
    i(n[s]);
  return i;
})({ 1: [function(require2, module, exports) {
  var WAAClock2 = require2("./lib/WAAClock");
  module.exports = WAAClock2;
  if (typeof window !== "undefined")
    window.WAAClock = WAAClock2;
}, { "./lib/WAAClock": 2 }], 3: [function(require2, module, exports) {
  var process = module.exports = {};
  process.nextTick = function() {
    var canSetImmediate = typeof window !== "undefined" && window.setImmediate;
    var canPost = typeof window !== "undefined" && window.postMessage && window.addEventListener;
    if (canSetImmediate) {
      return function(f) {
        return window.setImmediate(f);
      };
    }
    if (canPost) {
      var queue = [];
      window.addEventListener("message", function(ev) {
        var source = ev.source;
        if ((source === window || source === null) && ev.data === "process-tick") {
          ev.stopPropagation();
          if (queue.length > 0) {
            var fn = queue.shift();
            fn();
          }
        }
      }, true);
      return function nextTick(fn) {
        queue.push(fn);
        window.postMessage("process-tick", "*");
      };
    }
    return function nextTick(fn) {
      setTimeout(fn, 0);
    };
  }();
  process.title = "browser";
  process.browser = true;
  process.env = {};
  process.argv = [];
  process.binding = function(name) {
    throw new Error("");
  };
  process.cwd = function() {
    return "/";
  };
  process.chdir = function(dir) {
    throw new Error("");
  };
}, {}], 2: [function(require2, module, exports) {
  var process = require2("__browserify_process");
  var isBrowser = typeof window !== "undefined";
  if (isBrowser && !AudioContext)
    throw new Error("");
  var CLOCK_DEFAULTS = {
    toleranceLate: 0.1,
    toleranceEarly: 1e-3
  };
  var Event = function(clock, deadline, func) {
    this.clock = clock;
    this.func = func;
    this.repeatTime = null;
    this.toleranceLate = CLOCK_DEFAULTS.toleranceLate;
    this.toleranceEarly = CLOCK_DEFAULTS.toleranceEarly;
    this._armed = false;
    this._latestTime = null;
    this._earliestTime = null;
    this.schedule(deadline);
  };
  Event.prototype.clear = function() {
    this.clock._removeEvent(this);
    return this;
  };
  Event.prototype.repeat = function(time) {
    if (time === 0)
      throw new Error("");
    this.repeatTime = time;
    return this;
  };
  Event.prototype.tolerance = function(values) {
    if (typeof values.late === "number")
      this.toleranceLate = values.late;
    if (typeof values.early === "number")
      this.toleranceEarly = values.early;
    this._update();
    return this;
  };
  Event.prototype.isRepeated = function() {
    return this.repeatTime !== null;
  };
  Event.prototype.schedule = function(deadline) {
    this._armed = true;
    this.deadline = deadline;
    this._update();
    if (this.clock.context.currentTime >= this._earliestTime) {
      this.clock._removeEvent(this);
      this._execute();
    }
  };
  Event.prototype._execute = function() {
    this._armed = false;
    if (this.clock.context.currentTime < this._latestTime)
      this.func(this);
    else {
      if (EventBus)
        EventBus.trigger(EVENT.clockEventExpired);
    }
    if (this._armed === false && this.isRepeated())
      this.schedule(this.deadline + this.repeatTime);
  };
  Event.prototype._update = function() {
    this._latestTime = this.deadline + this.toleranceLate;
    this._earliestTime = this.deadline - this.toleranceEarly;
    this.clock._removeEvent(this);
    this.clock._insertEvent(this);
  };
  var WAAClock2 = module.exports = function(context, opts) {
    opts = opts || {};
    this.toleranceEarly = opts.toleranceEarly || CLOCK_DEFAULTS.toleranceEarly;
    this.toleranceLate = opts.toleranceLate || CLOCK_DEFAULTS.toleranceLate;
    this.context = context;
    this._events = [];
    this._started = false;
  };
  WAAClock2.prototype.setTimeout = function(func, delay) {
    return this._createEvent(func, this._absTime(delay));
  };
  WAAClock2.prototype.callbackAtTime = function(func, deadline) {
    return this._createEvent(func, deadline);
  };
  WAAClock2.prototype.timeStretch = function(tRef, events, ratio) {
    var self = this, currentTime = self.context.currentTime;
    events.forEach(function(event) {
      if (event.isRepeated())
        event.repeat(event.repeatTime * ratio);
      var deadline = tRef + ratio * (event.deadline - tRef);
      if (event.isRepeated()) {
        while (currentTime >= deadline - event.toleranceEarly)
          deadline += event.repeatTime;
      }
      event.schedule(deadline);
    });
    return events;
  };
  WAAClock2.prototype.start = function() {
    if (this._started === false) {
      var self = this;
      this._started = true;
      this._events = [];
      var bufferSize = 256;
      this._clockNode = this.context.createScriptProcessor(bufferSize, 1, 1);
      this._clockNode.connect(this.context.destination);
      this._clockNode.onaudioprocess = function() {
        process.nextTick(function() {
          self._tick();
        });
      };
    }
  };
  WAAClock2.prototype.stop = function() {
    if (this._started === true) {
      this._started = false;
      this._clockNode.disconnect();
    }
  };
  WAAClock2.prototype._tick = function() {
    var event = this._events.shift();
    while (event && event._earliestTime <= this.context.currentTime) {
      event._execute();
      event = this._events.shift();
    }
    if (event)
      this._events.unshift(event);
  };
  WAAClock2.prototype._createEvent = function(func, deadline) {
    var event = new Event(this, deadline, func);
    event.tolerance({ late: this.toleranceLate, early: this.toleranceEarly });
    return event;
  };
  WAAClock2.prototype._insertEvent = function(event) {
    this._events.splice(this._indexByTime(event._earliestTime), 0, event);
  };
  WAAClock2.prototype._removeEvent = function(event) {
    var ind = this._events.indexOf(event);
    if (ind !== -1)
      this._events.splice(ind, 1);
  };
  WAAClock2.prototype._indexByTime = function(deadline) {
    var low = 0, high = this._events.length, mid;
    while (low < high) {
      mid = Math.floor((low + high) / 2);
      if (this._events[mid]._earliestTime < deadline)
        low = mid + 1;
      else
        high = mid;
    }
    return low;
  };
  WAAClock2.prototype._absTime = function(relTime) {
    return relTime + this.context.currentTime;
  };
  WAAClock2.prototype._relTime = function(absTime) {
    return absTime - this.context.currentTime;
  };
}, { "__browserify_process": 3 }] }, {}, [1]);
const WAAClock$1 = WAAClock;
var periodNoteTable = {};
var periodFinetuneTable = {};
var nameNoteTable = {};
var noteNames = [];
var FTNotes = [];
var FTPeriods = [];
var Tracker = function() {
  var me = {};
  me.isMaster = true;
  var clock;
  var isPlaying = false;
  var song;
  var instruments = [];
  var currentInstrumentIndex = 1;
  var prevInstrumentIndex;
  var currentPattern = 0;
  var prevPattern;
  var currentPatternPos = 0;
  var prevPatternPos;
  var currentPlayType = PLAYTYPE.song;
  var currentPatternData;
  var currentSongPosition = 0;
  var prevSongPosition = 0;
  var vibratoFunction;
  var tremoloFunction;
  var bpm = 125;
  var ticksPerStep = 6;
  var tickTime = 2.5 / bpm;
  var mainTimer;
  var trackCount = 4;
  var patternLength = 64;
  var trackerMode = TRACKERMODE.PROTRACKER;
  var trackNotes = [];
  var trackEffectCache = [];
  var trackerStates = [];
  var patternLoopStart = [];
  var patternLoopCount = [];
  me.init = function(config) {
    for (var i = 0; i < trackCount; i++) {
      trackNotes.push({});
      trackEffectCache.push({});
    }
    for (var i = -8; i < 8; i++) {
      periodFinetuneTable[i] = {};
    }
    for (var key in NOTEPERIOD) {
      if (NOTEPERIOD.hasOwnProperty(key)) {
        var note = NOTEPERIOD[key];
        periodNoteTable[note.period] = note;
        nameNoteTable[note.name] = note;
        noteNames.push(note.name);
        if (note.tune) {
          for (i = -8; i < 8; i++) {
            var table = periodFinetuneTable[i];
            var index = i + 8;
            table[note.tune[index]] = note.period;
          }
        }
      }
    }
    var ftCounter = 0;
    for (key in FTNOTEPERIOD) {
      if (FTNOTEPERIOD.hasOwnProperty(key)) {
        var ftNote = FTNOTEPERIOD[key];
        if (!ftNote.period)
          ftNote.period = 1;
        FTNotes.push(ftNote);
        FTPeriods[ftNote.period] = ftCounter;
        if (ftNote.modPeriod)
          FTPeriods[ftNote.modPeriod] = ftCounter;
        ftCounter++;
      }
    }
    if (config) {
      Audio.init(config.audioContext, config.audioDestination);
    }
  };
  me.setCurrentInstrumentIndex = function(index) {
    if (song.instruments[index]) {
      currentInstrumentIndex = index;
      if (prevInstrumentIndex != currentInstrumentIndex)
        EventBus.trigger(EVENT.instrumentChange, currentInstrumentIndex);
      prevInstrumentIndex = currentInstrumentIndex;
    } else {
      if (index <= me.getMaxInstruments()) {
        for (var i = song.instruments.length, max = index; i <= max; i++) {
          me.setInstrument(i, Instrument());
        }
        var instrumentContainer = [];
        for (i = 1; i <= max; i++) {
          var instrument = song.instruments[i] || { name: "" };
          instrumentContainer.push({ label: i + " " + instrument.name, data: i });
          EventBus.trigger(EVENT.instrumentListChange, instrumentContainer);
        }
        currentInstrumentIndex = index;
        if (prevInstrumentIndex != currentInstrumentIndex)
          EventBus.trigger(EVENT.instrumentChange, currentInstrumentIndex);
        prevInstrumentIndex = currentInstrumentIndex;
      }
    }
  };
  me.getCurrentInstrumentIndex = function() {
    return currentInstrumentIndex;
  };
  me.getCurrentInstrument = function() {
    return instruments[currentInstrumentIndex];
  };
  me.getMaxInstruments = function() {
    return me.inFTMode() ? 128 : 31;
  };
  me.setCurrentPattern = function(index) {
    currentPattern = index;
    currentPatternData = song.patterns[currentPattern];
    if (!currentPatternData) {
      currentPatternData = getEmptyPattern();
      song.patterns[currentPattern] = currentPatternData;
    }
    patternLength = currentPatternData.length;
    if (prevPattern != currentPattern)
      EventBus.trigger(EVENT.patternChange, currentPattern);
    prevPattern = currentPattern;
  };
  me.getCurrentPattern = function() {
    return currentPattern;
  };
  me.getCurrentPatternData = function() {
    return currentPatternData;
  };
  me.setCurrentPatternPos = function(index) {
    currentPatternPos = index;
    if (prevPatternPos != currentPatternPos)
      EventBus.trigger(EVENT.patternPosChange, { current: currentPatternPos, prev: prevPatternPos });
    prevPatternPos = currentPatternPos;
  };
  me.getCurrentPatternPos = function() {
    return currentPatternPos;
  };
  me.getCurrentSongPosition = function() {
    return currentSongPosition;
  };
  me.setCurrentSongPosition = function(position, fromUserInteraction) {
    currentSongPosition = position;
    if (currentSongPosition != prevSongPosition) {
      EventBus.trigger(EVENT.songPositionChange, currentSongPosition);
      if (song.patternTable)
        me.setCurrentPattern(song.patternTable[currentSongPosition]);
      prevSongPosition = currentSongPosition;
      if (fromUserInteraction && me.isPlaying()) {
        me.stop();
        me.togglePlay();
      }
    }
  };
  me.setPlayType = function(playType) {
    currentPlayType = playType;
    EventBus.trigger(EVENT.playTypeChange, currentPlayType);
  };
  me.getPlayType = function() {
    return currentPlayType;
  };
  me.playSong = function() {
    me.stop();
    Audio.checkState();
    me.setPlayType(PLAYTYPE.song);
    isPlaying = true;
    playPattern(currentPattern);
    EventBus.trigger(EVENT.playingChange, isPlaying);
  };
  me.playPattern = function() {
    me.stop();
    Audio.checkState();
    currentPatternPos = 0;
    me.setPlayType(PLAYTYPE.pattern);
    isPlaying = true;
    playPattern(currentPattern);
    EventBus.trigger(EVENT.playingChange, isPlaying);
  };
  me.stop = function() {
    if (clock)
      clock.stop();
    Audio.disable();
    if (!me.isPlugin)
      Audio.setMasterVolume(1);
    me.clearEffectCache();
    for (var i = 0; i < trackCount; i++) {
      if (trackNotes[i] && trackNotes[i].source) {
        try {
          trackNotes[i].source.stop();
        } catch (e) {
        }
      }
    }
    isPlaying = false;
    EventBus.trigger(EVENT.playingChange, isPlaying);
  };
  me.pause = function() {
    if (clock)
      clock.stop();
    isPlaying = false;
    EventBus.trigger(EVENT.playingChange, isPlaying);
  };
  me.togglePlay = function() {
    if (me.isPlaying()) {
      me.stop();
    } else {
      if (currentPlayType == PLAYTYPE.pattern) {
        me.playPattern();
      } else {
        me.playSong();
      }
    }
  };
  me.getProperties = function() {
    return {
      ticksPerStep,
      tickTime
    };
  };
  function playPattern(patternIndex) {
    patternIndex = patternIndex || 0;
    clock = clock || new WAAClock$1(Audio.context);
    clock.start();
    Audio.enable();
    patternLoopStart = [];
    patternLoopCount = [];
    currentPatternData = song.patterns[patternIndex];
    var thisPatternLength = currentPatternData.length;
    var stepResult = {};
    var p = 0;
    var time = Audio.context.currentTime + 0.1;
    var delay = 0.2;
    var playingDelay = 1;
    var playPatternData = currentPatternData;
    var playSongPosition = currentSongPosition;
    trackerStates = [];
    mainTimer = clock.setTimeout(function(event) {
      if (p > 1) {
        delay = playingDelay;
        mainTimer.repeat(delay);
      }
      var maxTime = event.deadline + delay;
      Audio.clearScheduledNotesCache();
      while (time < maxTime) {
        if (stepResult.pause) {
          if (!stepResult.pasuseHandled) {
            var delta = time - Audio.context.currentTime;
            if (delta > 0) {
              setTimeout(function() {
                me.pause();
                me.setAmigaSpeed(6);
              }, Math.round(delta * 1e3) + 100);
            }
            stepResult.pasuseHandled = true;
          }
          if (me.autoPlay) {
            EventBus.trigger(EVENT.songEnd, time - Audio.context.currentTime);
          }
          return;
        }
        me.setStateAtTime(time, { patternPos: p, songPos: playSongPosition });
        if (stepResult.patternDelay) {
          stepResult.patternDelay--;
          for (var i = 0; i < trackCount; i++) {
            applyEffects(i, time);
          }
          time += ticksPerStep * tickTime;
        } else {
          stepResult = playPatternStep(p, time, playPatternData, playSongPosition);
          time += ticksPerStep * tickTime;
          p++;
          if (p >= thisPatternLength || stepResult.patternBreak) {
            if (!(stepResult.positionBreak && stepResult.targetSongPosition == playSongPosition)) {
              patternLoopStart = [];
              patternLoopCount = [];
            }
            p = 0;
            if (Tracker.getPlayType() == PLAYTYPE.song) {
              var nextPosition = stepResult.positionBreak ? stepResult.targetSongPosition : ++playSongPosition;
              if (me.autoPlay && stepResult.positionBreak) {
                if (nextPosition < playSongPosition) {
                  if (playSongPosition >= song.length - 2) {
                    nextPosition = song.length;
                  }
                }
              }
              if (nextPosition >= song.length) {
                nextPosition = song.restartPosition ? song.restartPosition - 1 : 0;
                EventBus.trigger(EVENT.songEnd, time - Audio.context.currentTime);
              }
              if (nextPosition >= song.length)
                nextPosition = 0;
              playSongPosition = nextPosition;
              patternIndex = song.patternTable[playSongPosition];
              playPatternData = song.patterns[patternIndex];
              if (!playPatternData) {
                playPatternData = getEmptyPattern();
                song.patterns[patternIndex] = playPatternData;
              }
              thisPatternLength = playPatternData.length;
              if (stepResult.patternBreak) {
                p = stepResult.targetPatternPosition || 0;
                if (p > playPatternData.length)
                  p = 0;
              }
            } else {
              if (stepResult.patternBreak) {
                p = stepResult.targetPatternPosition || 0;
                if (p > patternLength)
                  p = 0;
              }
            }
            EventBus.trigger(EVENT.patternEnd, time - ticksPerStep * tickTime);
          }
        }
      }
      for (i = 0; i < trackCount; i++) {
        var trackNote = trackNotes[i];
        if (trackNote && trackNote.time && trackNote.scheduled) {
          var instrument = me.getInstrument(trackNote.instrumentIndex);
          if (trackNote.scheduled.volume) {
            if (time + delay >= trackNote.scheduled.volume) {
              var scheduledtime = instrument.scheduleEnvelopeLoop(trackNote.volumeEnvelope, trackNote.scheduled.volume, 2);
              trackNote.scheduled.volume += scheduledtime;
            }
          }
          if (trackNote.scheduled.panning) {
            if (time + delay >= trackNote.scheduled.panning) {
              scheduledtime = instrument.scheduleEnvelopeLoop(trackNote.panningEnvelope, trackNote.scheduled.panning, 2);
              trackNote.scheduled.panning += scheduledtime;
            }
          }
        }
      }
    }, 0.01).repeat(delay).tolerance({ early: 0.1 });
  }
  function playPatternStep(step, time, patternData, songPostition) {
    patternData = patternData || currentPatternData;
    var patternStep = patternData[step];
    var tracks = trackCount;
    var result = {};
    var r;
    for (var i = 0; i < tracks; i++) {
      note = patternStep[i];
      if (note && note.effect && note.effect === 15) {
        if (note.param < 32) {
          Tracker.setAmigaSpeed(note.param);
          if (note.param === 0)
            result.pause = true;
        } else {
          Tracker.setBPM(note.param);
        }
      }
    }
    for (var i = 0; i < tracks; i++) {
      var note = patternStep[i];
      if (note) {
        var songPos = { position: songPostition, step };
        var playtime = time;
        r = playNote(note, i, playtime, songPos);
        if (r.patternBreak) {
          result.patternBreak = true;
          result.targetPatternPosition = r.targetPatternPosition || 0;
        }
        if (r.positionBreak) {
          result.positionBreak = true;
          result.targetPatternPosition = r.targetPatternPosition || 0;
          result.targetSongPosition = r.targetSongPosition || 0;
        }
        if (r.patternDelay)
          result.patternDelay = r.patternDelay;
      }
    }
    for (i = 0; i < tracks; i++) {
      applyEffects(i, time);
    }
    return result;
  }
  function playNote(note, track, time, songPos) {
    var defaultVolume = 100;
    var trackEffects = {};
    var instrumentIndex = note.instrument;
    var notePeriod = note.period;
    var noteIndex = note.index;
    if (notePeriod && !instrumentIndex) {
      instrumentIndex = trackNotes[track].currentInstrument;
      defaultVolume = typeof trackNotes[track].currentVolume === "number" ? trackNotes[track].currentVolume : defaultVolume;
      if (SETTINGS.emulateProtracker1OffsetBug && instrumentIndex && trackEffectCache[track].offset) {
        if (trackEffectCache[track].offset.instrument === instrumentIndex) {
          trackEffects.offset = trackEffectCache[track].offset;
        }
      }
    }
    if (typeof note.instrument === "number") {
      instrument = me.getInstrument(note.instrument);
      if (instrument) {
        defaultVolume = 100 * (instrument.sample.volume / 64);
        if (SETTINGS.emulateProtracker1OffsetBug) {
          trackEffectCache[track].offset = trackEffectCache[track].offset || {};
          trackEffectCache[track].offset.value = 0;
          trackEffectCache[track].offset.instrument = note.instrument;
        }
      }
    }
    if (typeof instrumentIndex === "number") {
      instrument = me.getInstrument(instrumentIndex);
    }
    if (SETTINGS.useSampleSwapping && instrument && !notePeriod) {
      if (!me.inFTMode()) {
        let current = trackNotes[track];
        if (current) {
          let prevInstrument = me.getInstrument(current.instrumentIndex);
          let startingTime = current.time;
          let elapsed = time - startingTime;
          let sourceSample = prevInstrument.samples[0];
          let targetSample = instrument.samples[0];
          if (sourceSample) {
            if (sourceSample.loop && sourceSample.loop.enabled && sourceSample.loop.length > 0) {
              let loopStart = sourceSample.loop.start / current.sampleRate;
              let loopLen = sourceSample.loop.length / current.sampleRate;
              let t = startingTime + loopStart + loopLen;
              while (t < time)
                t += loopLen;
              time = t;
            } else {
              let duration = sourceSample.length / current.sampleRate;
              if (duration > elapsed) {
                let remaining = duration - elapsed;
                time += remaining;
              }
            }
            if (targetSample.loop && targetSample.loop.enabled && targetSample.loop.length > 0) {
              notePeriod = current.currentPeriod;
              trackEffects.offset = {
                value: targetSample.loop.start,
                stepValue: targetSample.loop.start
              };
            } else {
              cutNote(track, time);
            }
          }
        }
      }
    }
    var volume = defaultVolume;
    var doPlayNote = true;
    if (noteIndex && me.inFTMode()) {
      if (noteIndex === 97) {
        noteIndex = NOTEOFF;
      }
      if (noteIndex === NOTEOFF) {
        var offInstrument = instrument || me.getInstrument(trackNotes[track].currentInstrument);
        if (offInstrument) {
          volume = offInstrument.noteOff(time, trackNotes[track]);
        } else {
          volume = 0;
        }
        defaultVolume = volume;
        doPlayNote = false;
      } else {
        if (instrument) {
          instrument.setSampleForNoteIndex(noteIndex);
          if (instrument.sample.relativeNote)
            noteIndex += instrument.sample.relativeNote;
        }
        if (me.useLinearFrequency) {
          notePeriod = 7680 - (noteIndex - 1) * 64;
        } else {
          var ftNote = FTNotes[noteIndex];
          if (ftNote)
            notePeriod = ftNote.period;
        }
      }
    }
    var value = note.param;
    var x, y;
    var result = {};
    if (note.volumeEffect && me.inFTMode()) {
      var ve = note.volumeEffect;
      x = ve >> 4;
      y = ve & 15;
      if (ve > 15 && ve <= 80) {
        volume = (ve - 16) / 64 * 100;
        defaultVolume = volume;
        trackEffects.volume = {
          value: volume
        };
      } else {
        switch (x) {
          case 6:
            trackEffects.fade = {
              value: y * -1 * 100 / 64
            };
            break;
          case 7:
            trackEffects.fade = {
              value: y * 100 / 64
            };
            break;
          case 8:
            trackEffects.fade = {
              value: -y * 100 / 64,
              fine: true
            };
            break;
          case 9:
            trackEffects.fade = {
              value: y * 100 / 64,
              fine: true
            };
            break;
          case 10:
            break;
          case 11:
            break;
          case 12:
            trackEffects.panning = {
              value: (ve - 192) * 17,
              slide: false
            };
            break;
          case 13:
            trackEffects.panning = {
              value: ve,
              slide: true
            };
            break;
          case 14:
            break;
          case 15:
            break;
        }
      }
    }
    switch (note.effect) {
      case 0:
        if (value) {
          x = value >> 4;
          y = value & 15;
          var finetune = 0;
          instrument = instrument || me.getInstrument(trackNotes[track].currentInstrument);
          if (me.inFTMode()) {
            if (instrument) {
              var _noteIndex = noteIndex || trackNotes[track].noteIndex;
              var root = instrument.getPeriodForNote(_noteIndex, true);
              if (noteIndex === NOTEOFF) {
                trackEffects.arpeggio = trackEffectCache[track].arpeggio;
              } else {
                trackEffects.arpeggio = {
                  root,
                  interval1: root - instrument.getPeriodForNote(_noteIndex + x, true),
                  interval2: root - instrument.getPeriodForNote(_noteIndex + y, true),
                  step: 1
                };
                trackEffectCache[track].arpeggio = trackEffects.arpeggio;
              }
            }
          } else {
            root = notePeriod || trackNotes[track].startPeriod;
            if (instrument) {
              finetune = instrument.getFineTune();
              if (finetune)
                root = Audio.getFineTuneForPeriod(root, finetune);
            }
            trackEffects.arpeggio = {
              root,
              interval1: root - Audio.getSemiToneFrom(root, x, finetune),
              interval2: root - Audio.getSemiToneFrom(root, y, finetune),
              step: 1
            };
          }
        }
        if (note.instrument) {
          trackEffects.volume = {
            value: defaultVolume
          };
        }
        break;
      case 1:
        value = value * -1;
        if (me.inFTMode()) {
          if (!value && trackEffectCache[track].slideUp)
            value = trackEffectCache[track].slideUp.value;
        }
        trackEffects.slide = {
          value
        };
        trackEffectCache[track].slideUp = trackEffects.slide;
        break;
      case 2:
        if (me.inFTMode()) {
          if (!value && trackEffectCache[track].slideDown)
            value = trackEffectCache[track].slideDown.value;
        }
        trackEffects.slide = {
          value
        };
        trackEffectCache[track].slideDown = trackEffects.slide;
        break;
      case 3:
        doPlayNote = false;
        var target = notePeriod;
        if (me.inFTMode() && noteIndex === NOTEOFF)
          target = 0;
        if (trackNotes[track].currentInstrument)
          instrumentIndex = trackNotes[track].currentInstrument;
        if (target && instrumentIndex) {
          var instrument = me.getInstrument(instrumentIndex);
          if (instrument && instrument.getFineTune()) {
            target = me.inFTMode() ? instrument.getPeriodForNote(noteIndex, true) : Audio.getFineTuneForPeriod(target, instrument.getFineTune());
          }
        }
        var prevSlide = trackEffectCache[track].slide;
        if (prevSlide) {
          if (!value)
            value = prevSlide.value;
        }
        if (!target) {
          target = trackEffectCache[track].defaultSlideTarget;
        }
        trackEffects.slide = {
          value,
          target,
          canUseGlissando: true,
          resetVolume: !!note.instrument,
          volume: defaultVolume
        };
        trackEffectCache[track].slide = trackEffects.slide;
        if (note.instrument) {
          trackEffects.volume = {
            value: defaultVolume
          };
        }
        break;
      case 4:
        if (note.instrument) {
          if (trackNotes[track].startVolume) {
            trackEffects.volume = {
              value: volume
            };
          }
          trackNotes[track].vibratoTimer = 0;
        }
        x = value >> 4;
        y = value & 15;
        var freq = x * ticksPerStep / 64;
        var prevVibrato = trackEffectCache[track].vibrato;
        if (x == 0 && prevVibrato)
          freq = prevVibrato.freq;
        if (y == 0 && prevVibrato)
          y = prevVibrato.amplitude;
        trackEffects.vibrato = {
          amplitude: y,
          freq
        };
        trackEffectCache[track].vibrato = trackEffects.vibrato;
        break;
      case 5:
        doPlayNote = false;
        target = notePeriod;
        if (target && instrumentIndex) {
          instrument = me.getInstrument(instrumentIndex);
          if (instrument && instrument.getFineTune()) {
            target = me.inFTMode() ? Audio.getFineTuneForNote(noteIndex, instrument.getFineTune()) : Audio.getFineTuneForPeriod(target, instrument.getFineTune());
          }
        }
        value = 1;
        var prevSlide = trackEffectCache[track].slide;
        if (prevSlide) {
          if (!target)
            target = prevSlide.target || 0;
          value = prevSlide.value;
        }
        trackEffects.slide = {
          value,
          target
        };
        trackEffectCache[track].slide = trackEffects.slide;
        if (note.instrument) {
          trackEffects.volume = {
            value: defaultVolume
          };
        }
        value = note.param;
        if (!value)
          ;
        else {
          if (note.param < 16) {
            value = value * -1;
          } else {
            value = note.param >> 4;
          }
          value = value * 100 / 64;
          trackEffects.fade = {
            value,
            resetOnStep: !!note.instrument
            // volume only needs resetting when the instrument number is given, other wise the volue is remembered from the preious state
          };
          trackEffectCache[track].fade = trackEffects.fade;
        }
        break;
      case 6:
        if (note.instrument) {
          if (trackNotes[track].startVolume) {
            trackEffects.volume = {
              value: volume
            };
          }
          trackNotes[track].vibratoTimer = 0;
        }
        if (note.param) {
          if (note.param < 16) {
            value = value * -1;
          } else {
            value = note.param & 15;
          }
          value = value * 100 / 64;
          trackEffects.fade = {
            value
          };
          trackEffectCache[track].fade = trackEffects.fade;
        } else {
          if (Tracker.inFTMode()) {
            if (trackEffectCache[track].fade)
              trackEffects.fade = trackEffectCache[track].fade;
          }
        }
        if (trackEffectCache[track].vibrato)
          trackEffects.vibrato = trackEffectCache[track].vibrato;
        break;
      case 7:
        if (notePeriod && !note.instrument) {
          if (trackNotes[track].startVolume) {
            trackEffects.volume = {
              value: volume
            };
          }
          trackNotes[track].tremoloTimer = 0;
        }
        x = value >> 4;
        y = value & 15;
        var amplitude = y;
        var freq = x * ticksPerStep / 64;
        var prevTremolo = trackEffectCache[track].tremolo;
        if (x == 0 && prevTremolo)
          freq = prevTremolo.freq;
        if (y == 0 && prevTremolo)
          amplitude = prevTremolo.amplitude;
        trackEffects.tremolo = {
          amplitude,
          freq
        };
        trackEffectCache[track].tremolo = trackEffects.tremolo;
        break;
      case 8:
        trackEffects.panning = {
          value,
          slide: false
        };
        break;
      case 9:
        value = value << 8;
        if (!value && trackEffectCache[track].offset) {
          value = trackEffectCache[track].offset.stepValue || trackEffectCache[track].offset.value || 0;
        }
        var stepValue = value;
        if (SETTINGS.emulateProtracker1OffsetBug && !note.instrument && trackEffectCache[track].offset) {
          value += trackEffectCache[track].offset.value;
        }
        trackEffects.offset = {
          value,
          stepValue
        };
        trackEffectCache[track].offset = trackEffectCache[track].offset || {};
        trackEffectCache[track].offset.value = trackEffects.offset.value;
        trackEffectCache[track].offset.stepValue = trackEffects.offset.stepValue;
        if (SETTINGS.emulateProtracker1OffsetBug) {
          if (note.instrument) {
            trackEffectCache[track].offset.instrument = note.instrument;
          }
          if (notePeriod) {
            trackEffectCache[track].offset.value += stepValue;
          }
        }
        if (note.instrument) {
          trackEffects.volume = {
            value: defaultVolume
          };
        }
        break;
      case 10:
        if (note.param < 16) {
          value = value * -1;
        } else {
          value = note.param >> 4;
        }
        value = value * 100 / 64;
        if (!note.param) {
          var prevFade = trackEffectCache[track].fade;
          if (prevFade)
            value = prevFade.value;
        }
        trackEffects.fade = {
          value,
          resetOnStep: !!note.instrument
          // volume only needs resetting when the instrument number is given, otherwise the volume is remembered from the previous state
        };
        if (me.inFTMode()) {
          trackEffectCache[track].fade = trackEffects.fade;
        }
        break;
      case 11:
        result.patternBreak = true;
        result.positionBreak = true;
        result.targetSongPosition = note.param;
        result.targetPatternPosition = 0;
        break;
      case 12:
        volume = note.param / 64 * 100;
        trackEffects.volume = {
          value: volume
        };
        break;
      case 13:
        result.patternBreak = true;
        x = value >> 4;
        y = value & 15;
        result.targetPatternPosition = x * 10 + y;
        break;
      case 14:
        var subEffect = value >> 4;
        var subValue = value & 15;
        switch (subEffect) {
          case 0:
            if (!me.inFTMode())
              Audio.setAmigaLowPassFilter(!subValue, time);
            break;
          case 1:
            subValue = subValue * -1;
            if (!subValue && trackEffectCache[track].fineSlide)
              subValue = trackEffectCache[track].fineSlide.value;
            trackEffects.slide = {
              value: subValue,
              fine: true
            };
            trackEffectCache[track].fineSlide = trackEffects.slide;
            break;
          case 2:
            if (!subValue && trackEffectCache[track].fineSlide)
              subValue = trackEffectCache[track].fineSlide.value;
            trackEffects.slide = {
              value: subValue,
              fine: true
            };
            trackEffectCache[track].fineSlide = trackEffects.slide;
            break;
          case 3:
            trackEffectCache[track].glissando = !!subValue;
            break;
          case 4:
            switch (subValue) {
              case 1:
                vibratoFunction = Audio.waveFormFunction.saw;
                break;
              case 2:
                vibratoFunction = Audio.waveFormFunction.square;
                break;
              case 3:
                vibratoFunction = Audio.waveFormFunction.sine;
                break;
              case 4:
                vibratoFunction = Audio.waveFormFunction.sine;
                break;
              case 5:
                vibratoFunction = Audio.waveFormFunction.saw;
                break;
              case 6:
                vibratoFunction = Audio.waveFormFunction.square;
                break;
              case 7:
                vibratoFunction = Audio.waveFormFunction.sine;
                break;
              default:
                vibratoFunction = Audio.waveFormFunction.sine;
                break;
            }
            break;
          case 5:
            if (instrumentIndex) {
              var instrument = me.getInstrument(instrumentIndex);
              trackEffects.fineTune = {
                original: instrument.getFineTune(),
                instrument
              };
              instrument.setFineTune(subValue);
            }
            break;
          case 6:
            if (subValue) {
              patternLoopCount[track] = patternLoopCount[track] || 0;
              if (patternLoopCount[track] < subValue) {
                patternLoopCount[track]++;
                result.patternBreak = true;
                result.positionBreak = true;
                result.targetSongPosition = songPos.position;
                result.targetPatternPosition = patternLoopStart[track] || 0;
              } else {
                patternLoopCount[track] = 0;
              }
            } else {
              patternLoopStart[track] = songPos.step;
            }
            break;
          case 7:
            switch (subValue) {
              case 1:
                tremoloFunction = Audio.waveFormFunction.saw;
                break;
              case 2:
                tremoloFunction = Audio.waveFormFunction.square;
                break;
              case 3:
                tremoloFunction = Audio.waveFormFunction.sine;
                break;
              case 4:
                tremoloFunction = Audio.waveFormFunction.sine;
                break;
              case 5:
                tremoloFunction = Audio.waveFormFunction.saw;
                break;
              case 6:
                tremoloFunction = Audio.waveFormFunction.square;
                break;
              case 7:
                tremoloFunction = Audio.waveFormFunction.sine;
                break;
              default:
                tremoloFunction = Audio.waveFormFunction.sine;
                break;
            }
            break;
          case 8:
            break;
          case 9:
            if (subValue) {
              trackEffects.reTrigger = {
                value: subValue
              };
            }
            break;
          case 10:
            subValue = subValue * 100 / 64;
            trackEffects.fade = {
              value: subValue,
              fine: true
            };
            break;
          case 11:
            subValue = subValue * 100 / 64;
            trackEffects.fade = {
              value: -subValue,
              fine: true
            };
            break;
          case 12:
            if (subValue) {
              if (subValue < ticksPerStep) {
                trackEffects.cutNote = {
                  value: subValue
                };
              }
            } else {
              doPlayNote = false;
            }
            break;
          case 13:
            if (subValue) {
              if (subValue < ticksPerStep) {
                time += tickTime * subValue;
              } else {
                doPlayNote = false;
                if (!me.inFTMode()) {
                  if (instrument && instrument.samples && instrument.samples[0]) {
                    let sample = instrument.samples[0];
                    if (sample.loop.enabled && sample.loop.length) {
                      trackEffects.offset = {
                        value: sample.loop.start,
                        stepValue: sample.loop.start
                      };
                      doPlayNote = true;
                    }
                  }
                }
              }
            }
            break;
          case 14:
            result.patternDelay = subValue;
            break;
          case 15:
            break;
          default:
        }
        break;
      case 15:
        break;
      case 16:
        value = Math.min(value, 64);
        if (!me.isPlugin)
          Audio.setMasterVolume(value / 64, time);
        break;
      case 17:
        x = value >> 4;
        y = value & 15;
        var currentVolume = Audio.getLastMasterVolume() * 64;
        var amount = 0;
        if (x) {
          var targetTime = time + x * tickTime;
          amount = x * (ticksPerStep - 1);
        } else if (y) {
          targetTime = time + y * tickTime;
          amount = -y * (ticksPerStep - 1);
        }
        if (amount) {
          value = (currentVolume + amount) / 64;
          value = Math.max(0, value);
          value = Math.min(1, value);
          Audio.slideMasterVolume(value, targetTime);
        }
        break;
      case 20:
        if (me.inFTMode()) {
          offInstrument = instrument || me.getInstrument(trackNotes[track].currentInstrument);
          if (note.param && note.param >= ticksPerStep)
            ;
          else {
            doPlayNote = false;
            if (offInstrument) {
              if (note.param) {
                trackEffects.noteOff = {
                  value: note.param
                };
                doPlayNote = true;
              } else {
                volume = offInstrument.noteOff(time, trackNotes[track]);
                defaultVolume = volume;
              }
            } else {
              defaultVolume = 0;
            }
          }
        }
        break;
      case 21:
        break;
      case 25:
        break;
      case 27:
        trackEffects.reTrigger = {
          value: note.param
        };
        break;
      case 29:
        break;
      case 33:
        break;
      default:
    }
    if (doPlayNote && instrumentIndex && notePeriod) {
      cutNote(track, time);
      trackNotes[track] = {};
      if (instrument) {
        trackNotes[track] = instrument.play(noteIndex, notePeriod, volume, track, trackEffects, time);
      }
      trackEffectCache[track].defaultSlideTarget = trackNotes[track].startPeriod;
    }
    if (instrumentIndex) {
      trackNotes[track].currentInstrument = instrumentIndex;
      if (trackEffects.fineTune && trackEffects.fineTune.instrument) {
        trackEffects.fineTune.instrument.setFineTune(trackEffects.fineTune.original || 0);
      }
    }
    if (instrument && instrument.hasVibrato()) {
      trackNotes[track].hasAutoVibrato = true;
    }
    trackNotes[track].effects = trackEffects;
    trackNotes[track].note = note;
    return result;
  }
  function cutNote(track, time) {
    try {
      if (trackNotes[track].source) {
        var gain = trackNotes[track].volume.gain;
        gain.setValueAtTime(trackNotes[track].currentVolume / 100, time - 2e-3);
        gain.linearRampToValueAtTime(0, time + 0.01);
        trackNotes[track].source.stop(time + 0.02);
      }
    } catch (e) {
    }
  }
  me.cutNote = cutNote;
  function applyAutoVibrato(trackNote, currentPeriod) {
    var instrument = me.getInstrument(trackNote.instrumentIndex);
    if (instrument) {
      var _freq = -instrument.vibrato.rate / 40;
      var _amp = instrument.vibrato.depth / 8;
      if (me.useLinearFrequency)
        _amp *= 4;
      trackNote.vibratoTimer = trackNote.vibratoTimer || 0;
      if (instrument.vibrato.sweep && trackNote.vibratoTimer < instrument.vibrato.sweep) {
        var sweepAmp = 1 - (instrument.vibrato.sweep - trackNote.vibratoTimer) / instrument.vibrato.sweep;
        _amp *= sweepAmp;
      }
      var instrumentVibratoFunction = instrument.getAutoVibratoFunction();
      var targetPeriod = instrumentVibratoFunction(currentPeriod, trackNote.vibratoTimer, _freq, _amp);
      trackNote.vibratoTimer++;
      return targetPeriod;
    }
    return currentPeriod;
  }
  function applyEffects(track, time) {
    var trackNote = trackNotes[track];
    var effects = trackNote.effects;
    if (!trackNote)
      return;
    if (!effects)
      return;
    var value;
    var autoVibratoHandled = false;
    trackNote.startVibratoTimer = trackNote.vibratoTimer || 0;
    if (trackNote.resetPeriodOnStep && trackNote.source) {
      var targetPeriod = trackNote.currentPeriod || trackNote.startPeriod;
      me.setPeriodAtTime(trackNote, targetPeriod, time);
      trackNote.resetPeriodOnStep = false;
    }
    if (effects.volume) {
      var volume = effects.volume.value;
      if (trackNote.volume) {
        trackNote.volume.gain.setValueAtTime(volume / 100, time);
      }
      trackNote.currentVolume = volume;
    }
    if (effects.panning) {
      value = effects.panning.value;
      if (value === 255)
        value = 254;
      if (trackNote.panning) {
        trackNote.panning.pan.setValueAtTime((value - 127) / 127, time);
      }
    }
    if (effects.fade) {
      value = effects.fade.value;
      var currentVolume;
      var startTick = 1;
      if (effects.fade.resetOnStep) {
        currentVolume = trackNote.startVolume;
      } else {
        currentVolume = trackNote.currentVolume;
      }
      var steps = ticksPerStep;
      if (effects.fade.fine) {
        startTick = 0;
        steps = 1;
      }
      for (var tick = startTick; tick < steps; tick++) {
        if (trackNote.volume) {
          trackNote.volume.gain.setValueAtTime(currentVolume / 100, time + tick * tickTime);
          currentVolume += value;
          currentVolume = Math.max(currentVolume, 0);
          currentVolume = Math.min(currentVolume, 100);
        }
      }
      trackNote.currentVolume = currentVolume;
    }
    if (effects.slide) {
      if (trackNote.source) {
        var currentPeriod = trackNote.currentPeriod || trackNote.startPeriod;
        var targetPeriod = currentPeriod;
        var steps = ticksPerStep;
        if (effects.slide.fine) {
          steps = 2;
        }
        var slideValue = effects.slide.value;
        if (me.inFTMode() && me.useLinearFrequency)
          slideValue = effects.slide.value * 4;
        value = Math.abs(slideValue);
        if (me.inFTMode() && effects.slide.resetVolume && (trackNote.volumeFadeOut || trackNote.volumeEnvelope)) {
          var instrument = me.getInstrument(trackNote.instrumentIndex);
          if (instrument)
            instrument.resetVolume(time, trackNote);
        }
        trackNote.vibratoTimer = trackNote.startVibratoTimer;
        for (var tick = 1; tick < steps; tick++) {
          if (effects.slide.target) {
            trackEffectCache[track].defaultSlideTarget = effects.slide.target;
            if (targetPeriod < effects.slide.target) {
              targetPeriod += value;
              if (targetPeriod > effects.slide.target)
                targetPeriod = effects.slide.target;
            } else {
              targetPeriod -= value;
              if (targetPeriod < effects.slide.target)
                targetPeriod = effects.slide.target;
            }
          } else {
            targetPeriod += slideValue;
            if (trackEffectCache[track].defaultSlideTarget)
              trackEffectCache[track].defaultSlideTarget += slideValue;
          }
          if (!me.inFTMode())
            targetPeriod = Audio.limitAmigaPeriod(targetPeriod);
          var newPeriod = targetPeriod;
          if (effects.slide.canUseGlissando && trackEffectCache[track].glissando) {
            newPeriod = Audio.getNearestSemiTone(targetPeriod, trackNote.instrumentIndex);
          }
          if (targetPeriod !== trackNote.currentPeriod) {
            trackNote.currentPeriod = targetPeriod;
            if (trackNote.hasAutoVibrato && me.inFTMode()) {
              targetPeriod = applyAutoVibrato(trackNote, newPeriod);
              autoVibratoHandled = true;
            }
            me.setPeriodAtTime(trackNote, newPeriod, time + tick * tickTime);
          }
        }
      }
    }
    if (effects.arpeggio) {
      if (trackNote.source) {
        var currentPeriod = trackNote.currentPeriod || trackNote.startPeriod;
        var targetPeriod;
        trackNote.resetPeriodOnStep = true;
        trackNote.vibratoTimer = trackNote.startVibratoTimer;
        for (var tick = 0; tick < ticksPerStep; tick++) {
          var t = tick % 3;
          if (t == 0)
            targetPeriod = currentPeriod;
          if (t == 1 && effects.arpeggio.interval1)
            targetPeriod = currentPeriod - effects.arpeggio.interval1;
          if (t == 2 && effects.arpeggio.interval2)
            targetPeriod = currentPeriod - effects.arpeggio.interval2;
          if (trackNote.hasAutoVibrato && me.inFTMode()) {
            targetPeriod = applyAutoVibrato(trackNote, targetPeriod);
            autoVibratoHandled = true;
          }
          me.setPeriodAtTime(trackNote, targetPeriod, time + tick * tickTime);
        }
      }
    }
    if (effects.vibrato || trackNote.hasAutoVibrato && !autoVibratoHandled) {
      effects.vibrato = effects.vibrato || { freq: 0, amplitude: 0 };
      var freq = effects.vibrato.freq;
      var amp = effects.vibrato.amplitude;
      if (me.inFTMode() && me.useLinearFrequency)
        amp *= 4;
      trackNote.vibratoTimer = trackNote.vibratoTimer || 0;
      if (trackNote.source) {
        trackNote.resetPeriodOnStep = true;
        currentPeriod = trackNote.currentPeriod || trackNote.startPeriod;
        trackNote.vibratoTimer = trackNote.startVibratoTimer;
        for (var tick = 0; tick < ticksPerStep; tick++) {
          targetPeriod = vibratoFunction(currentPeriod, trackNote.vibratoTimer, freq, amp);
          if (trackNote.hasAutoVibrato && me.inFTMode()) {
            targetPeriod = applyAutoVibrato(trackNote, targetPeriod);
            autoVibratoHandled = true;
          } else {
            trackNote.vibratoTimer++;
          }
          me.setPeriodAtTime(trackNote, targetPeriod, time + tick * tickTime);
        }
      }
    }
    if (effects.tremolo) {
      var freq = effects.tremolo.freq;
      var amp = effects.tremolo.amplitude;
      trackNote.tremoloTimer = trackNote.tremoloTimer || 0;
      if (trackNote.volume) {
        var _volume = trackNote.startVolume;
        for (var tick = 0; tick < ticksPerStep; tick++) {
          _volume = tremoloFunction(_volume, trackNote.tremoloTimer, freq, amp);
          if (_volume < 0)
            _volume = 0;
          if (_volume > 100)
            _volume = 100;
          trackNote.volume.gain.setValueAtTime(_volume / 100, time + tick * tickTime);
          trackNote.currentVolume = _volume;
          trackNote.tremoloTimer++;
        }
      }
    }
    if (effects.cutNote) {
      if (trackNote.volume) {
        let t2 = time + effects.cutNote.value * tickTime;
        trackNote.volume.gain.setValueAtTime(trackNote.currentVolume / 100, t2);
        trackNote.volume.gain.linearRampToValueAtTime(0, t2 + 5e-3);
      }
      trackNote.currentVolume = 0;
    }
    if (effects.noteOff) {
      var instrument = me.getInstrument(trackNote.instrumentIndex);
      if (instrument) {
        trackNote.currentVolume = instrument.noteOff(time + effects.noteOff.value * tickTime, trackNote);
      }
    }
    if (effects.reTrigger) {
      var instrumentIndex = trackNote.instrumentIndex;
      var notePeriod = trackNote.startPeriod;
      volume = trackNote.startVolume;
      var noteIndex = trackNote.noteIndex;
      var triggerStep = effects.reTrigger.value || 1;
      var triggerCount = triggerStep;
      while (triggerCount < ticksPerStep) {
        var triggerTime = time + triggerCount * tickTime;
        cutNote(track, triggerTime);
        trackNotes[track] = Audio.playSample(instrumentIndex, notePeriod, volume, track, effects, triggerTime, noteIndex);
        triggerCount += triggerStep;
      }
    }
  }
  me.setBPM = function(newBPM, sender) {
    var fromMaster = sender && sender.isMaster;
    if (me.isMaster || fromMaster) {
      if (clock)
        clock.timeStretch(Audio.context.currentTime, [mainTimer], bpm / newBPM);
      if (!fromMaster)
        EventBus.trigger(EVENT.songBPMChangeIgnored, bpm);
      bpm = newBPM;
      tickTime = 2.5 / bpm;
      EventBus.trigger(EVENT.songBPMChange, bpm);
    } else {
      EventBus.trigger(EVENT.songBPMChangeIgnored, newBPM);
    }
  };
  me.setAmigaSpeed = function(speed, sender) {
    var fromMaster = sender && sender.isMaster;
    if (me.isMaster || fromMaster) {
      ticksPerStep = speed;
      EventBus.trigger(EVENT.songSpeedChange, speed);
    } else {
      EventBus.trigger(EVENT.songSpeedChangeIgnored, speed);
    }
  };
  me.getPatternLength = function() {
    return patternLength;
  };
  me.setPatternLength = function(value) {
    patternLength = value;
    var currentLength = song.patterns[currentPattern].length;
    if (currentLength === patternLength)
      return;
    if (currentLength < patternLength) {
      for (var step = currentLength; step < patternLength; step++) {
        var row = [];
        var channel;
        for (channel = 0; channel < trackCount; channel++) {
          row.push(Note());
        }
        song.patterns[currentPattern].push(row);
      }
    } else {
      song.patterns[currentPattern] = song.patterns[currentPattern].splice(0, patternLength);
      if (currentPatternPos >= patternLength) {
        me.setCurrentPatternPos(patternLength - 1);
      }
    }
    EventBus.trigger(EVENT.patternChange, currentPattern);
  };
  me.getTrackCount = function() {
    return trackCount;
  };
  me.setTrackCount = function(count) {
    trackCount = count;
    for (var i = trackNotes.length; i < trackCount; i++)
      trackNotes.push({});
    for (i = trackEffectCache.length; i < trackCount; i++)
      trackEffectCache.push({});
    EventBus.trigger(EVENT.trackCountChange, trackCount);
  };
  me.isPlaying = function() {
    return isPlaying;
  };
  me.setStateAtTime = function(time, state) {
    trackerStates.push({ time, state });
  };
  me.getStateAtTime = function(time) {
    var result = void 0;
    for (var i = 0, len = trackerStates.length; i < len; i++) {
      var state = trackerStates[0];
      if (state.time < time) {
        result = trackerStates.shift().state;
      } else {
        return result;
      }
    }
    return result;
  };
  me.getTimeStates = function() {
    return trackerStates;
  };
  me.setPeriodAtTime = function(trackNote, period, time) {
    period = Math.max(period, 1);
    if (me.inFTMode() && me.useLinearFrequency) {
      var sampleRate = 8363 * Math.pow(2, (4608 - period) / 768);
      var rate = sampleRate / Audio.context.sampleRate;
    } else {
      rate = trackNote.startPeriod / period;
      rate = trackNote.startPlaybackRate * rate;
    }
    trackNote.source.playbackRate.setValueAtTime(rate, time);
    trackNote.source.playbackRate.setValueAtTime(rate, time + 5e-3);
  };
  me.processFile = function(data, name, url) {
    return new Promise(async (next) => {
      var file;
      var result = FILETYPE.unknown;
      if (data instanceof ArrayBuffer) {
        file = new BinaryStream(data, true);
        result = FileDetector.detect(file, name);
      } else {
        if (data && data.modules) {
          result = { name: "PLAYLIST", type: FILETYPE.playlist };
        }
      }
      if (result.isMod && result.loader) {
        if (me.isPlaying())
          me.stop();
        resetDefaultSettings();
        song = result.loader().load(file, name);
        song.filename = name;
        song.url = url;
        onModuleLoad();
      }
      next(result.type);
    });
  };
  me.getSong = function() {
    return song;
  };
  me.getInstruments = function() {
    return instruments;
  };
  me.getInstrument = function(index) {
    return instruments[index];
  };
  me.setInstrument = function(index, instrument) {
    instrument.instrumentIndex = index;
    instruments[index] = instrument;
  };
  me.getCurrentUrl = function() {
    return song.url;
  };
  function onModuleLoad() {
    if (song.channels)
      me.setTrackCount(song.channels);
    prevPatternPos = void 0;
    prevInstrumentIndex = void 0;
    prevPattern = void 0;
    prevSongPosition = void 0;
    me.setCurrentSongPosition(0);
    me.setCurrentPatternPos(0);
    me.setCurrentInstrumentIndex(1);
    me.clearEffectCache();
    EventBus.trigger(EVENT.songLoaded, song);
    EventBus.trigger(EVENT.songPropertyChange, song);
  }
  function resetDefaultSettings() {
    EventBus.trigger(EVENT.songBPMChangeIgnored, 0);
    EventBus.trigger(EVENT.songSpeedChangeIgnored, 0);
    me.setAmigaSpeed(6);
    me.setBPM(125);
    vibratoFunction = Audio.waveFormFunction.sine;
    tremoloFunction = Audio.waveFormFunction.sine;
    trackEffectCache = [];
    trackNotes = [];
    for (var i = 0; i < trackCount; i++) {
      trackNotes.push({});
      trackEffectCache.push({});
    }
    me.useLinearFrequency = false;
    me.setTrackerMode(TRACKERMODE.PROTRACKER, true);
    if (!me.isPlugin)
      Audio.setMasterVolume(1);
    Audio.setAmigaLowPassFilter(false, 0);
    if (typeof StateManager !== "undefined")
      StateManager.clear();
  }
  me.clearEffectCache = function() {
    trackEffectCache = [];
    for (var i = 0; i < trackCount; i++) {
      trackEffectCache.push({});
    }
  };
  me.clearInstruments = function(count) {
    if (!song)
      return;
    var instrumentContainer = [];
    var max = count || song.instruments.length - 1;
    instruments = [];
    for (let i = 1; i <= max; i++) {
      me.setInstrument(i, Instrument());
      instrumentContainer.push({ label: i + " ", data: i });
    }
    song.instruments = instruments;
    EventBus.trigger(EVENT.instrumentListChange, instrumentContainer);
    EventBus.trigger(EVENT.instrumentChange, currentInstrumentIndex);
  };
  me.setTrackerMode = function(mode, force) {
    var doChange = function() {
      trackerMode = mode;
      SETTINGS.emulateProtracker1OffsetBug = !me.inFTMode();
      EventBus.trigger(EVENT.trackerModeChanged, mode);
    };
    if (mode === TRACKERMODE.PROTRACKER && !force) {
      if (Tracker.getInstruments().length > 32)
        ;
      else {
        doChange();
      }
    } else {
      doChange();
    }
  };
  me.inFTMode = function() {
    return trackerMode === TRACKERMODE.FASTTRACKER;
  };
  me.reset = function() {
    resetDefaultSettings();
  };
  me.clearInstrument = function() {
    instruments[currentInstrumentIndex] = Instrument();
    EventBus.trigger(EVENT.instrumentChange, currentInstrumentIndex);
  };
  function getEmptyPattern() {
    var result = [];
    for (var step = 0; step < patternLength; step++) {
      var row = [];
      var channel;
      for (channel = 0; channel < trackCount; channel++) {
        row.push(Note());
      }
      result.push(row);
    }
    return result;
  }
  me.useLinearFrequency = true;
  return me;
}();
let BassoonTracker = (() => {
  let me = Tracker;
  let initDone;
  me.load = async (url) => {
    if (!initDone) {
      Tracker.init();
      Audio.init();
      initDone = true;
    }
    var data = await fetch(url).then((res) => res.arrayBuffer());
    var name = url.split("/").pop() || "";
    return Tracker.processFile(data, name, url);
  };
  me.loadFromArrayBuffer = function(arrayBuffer, filename) {
    if (!initDone) {
      Tracker.init();
      Audio.init();
      initDone = true;
    }
    var name = filename || "module";
    return Tracker.processFile(arrayBuffer, name, "");
  };
  me.ensureAudio = function() {
    if (!initDone) {
      Tracker.init();
      Audio.init();
      initDone = true;
      if (Audio.context && Audio.context.state === "suspended" && Audio.context.resume) {
        Audio.context.resume();
      }
    } else if (Audio.context && Audio.context.state === "suspended" && Audio.context.resume) {
      Audio.context.resume();
    }
  };
  me.play = () => {
    Tracker.playSong();
  };
  me.audio = Audio;
  window.BassoonTracker = me;
  return me;
})();
