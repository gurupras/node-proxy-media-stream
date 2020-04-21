const Emittery = require('emittery')

class ProxyMediaStream extends MediaStream {
  constructor (arg = []) {
    super()
    new Emittery().bindMethods(this)
    Object.assign(this, {
      audioTracks: new Map(),
      videoTracks: new Map(),
      hasVideoTrack: false,
      hasAudioTrack: false
    })
    let tracks
    if (arg instanceof MediaStream) {
      tracks = arg.getTracks()
      arg.onaddtrack = ({ track }) => {
        this.addTrack(track)
      }
      arg.onremovetrack = ({ track }) => {
        this.removeTrack(track)
      }
    } else if (Array.isArray(arg)) {
      tracks = arg
    } else {
      throw new Error('Expected MediaStream or an array of MediaStreamTracks')
    }
    for (const track of tracks) {
      this.addTrack(track)
    }
  }

  addTrack (track) {
    if (!track) {
      throw new Error('Failed to execute addTrack: 1 argument required, but only 0 present')
    }
    let map
    let key
    switch (track.kind) {
      case 'video':
        map = this.videoTracks
        key = 'hasVideoTrack'
        break
      case 'audio':
        map = this.audioTracks
        key = 'hasAudioTrack'
        break
    }
    map.set(track, track.kind)
    this[key] = true
    super.addTrack(track)

    track.addEventListener('ended', () => {
      this.emit('ended', track)
    })
  }

  removeTrack (track) {
    if (!track) {
      throw new Error('Failed to execute removeTrack: 1 argument required, but only 0 present')
    }
    let map
    let key
    switch (track.kind) {
      case 'video':
        map = this.videoTracks
        key = 'hasVideoTrack'
        break
      case 'audio':
        map = this.audioTracks
        key = 'hasAudioTrack'
        break
    }
    map.delete(track)
    this[key] = map.size > 0
    super.removeTrack(track)
  }

  static splitStream (stream) {
    const videoTracks = stream.getVideoTracks()
    const audioTracks = stream.getAudioTracks()
    return {
      videoStream: videoTracks.length > 0 ? new MediaStream(videoTracks) : undefined,
      audioStream: audioTracks.length > 0 ? new MediaStream(audioTracks) : undefined
    }
  }

  static getFilteredTracks (newStream, oldStream) {
    const newTracks = (newStream && newStream.getTracks()) || []
    const oldTracks = (oldStream && oldStream.getTracks()) || []
    return newTracks.filter(t => !oldTracks.includes(t))
  }
}

module.exports = ProxyMediaStream
