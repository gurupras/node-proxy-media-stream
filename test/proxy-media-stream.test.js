import fs from 'fs'
import path from 'path'
import deepmerge from 'deepmerge'
import puppeteer from 'puppeteer'
import { build } from 'vite'
import { FakeMediaTrack, FakeMediaStream, testForEvent } from '@gurupras/test-helpers'
import ProxyMediaStream from '../index'
import { describe, beforeAll, afterAll, beforeEach, expect, test, vi } from 'vitest'

beforeAll(() => {
  global.jest = vi
})

describe('ProxyMediaStream', () => {
  let stream
  beforeEach(() => {
    stream = new ProxyMediaStream()
  })

  test('Constructor with a MediaStream properly copies over tracks', () => {
    const videoTracks = [...Array(3)].map((x, idx) => new FakeMediaTrack({ kind: 'video' }))
    const audioTracks = [...Array(3)].map((x, idx) => new FakeMediaTrack({ kind: 'audio' }))
    ;[...videoTracks, ...audioTracks].forEach(t => stream.addTrack(t))
    const newStream = new ProxyMediaStream(stream)

    expect([...newStream.audioTracks.keys()]).toIncludeSameMembers(audioTracks)
    expect([...newStream.videoTracks.keys()]).toIncludeSameMembers(videoTracks)
  })

  test('Constructor with array of MediaStreamTrack elements', () => {
    const videoTracks = [...Array(3)].map((x, idx) => new FakeMediaTrack({ kind: 'video' }))
    const audioTracks = [...Array(3)].map((x, idx) => new FakeMediaTrack({ kind: 'audio' }))

    const newStream = new ProxyMediaStream([...videoTracks, ...audioTracks])
    expect([...newStream.audioTracks.keys()]).toIncludeSameMembers(audioTracks)
    expect([...newStream.videoTracks.keys()]).toIncludeSameMembers(videoTracks)
  })
  test('Constructor with no argument passes', async () => {
    expect(() => new ProxyMediaStream()).not.toThrow()
  })
  test.each([
    ['null', null],
    ['object', {}],
    ['number', 1],
    ['empty string', ''],
    ['string', 'test']
  ])('Constructor with bad type (%p) fails', async (type, obj) => {
    expect(() => new ProxyMediaStream(obj)).toThrow()
  })

  test('Constructor with MediaStream properly mirrors source stream even if tracks are added/removed later', () => {
    const videoTracks = [...Array(3)].map((x, idx) => new FakeMediaTrack({ kind: 'video' }))
    const audioTracks = [...Array(3)].map((x, idx) => new FakeMediaTrack({ kind: 'audio' }))
    ;[...videoTracks, ...audioTracks].forEach(t => stream.addTrack(t))
    const newStream = new ProxyMediaStream(stream)

    stream.removeTrack(videoTracks[0])
    stream.removeTrack(audioTracks[0])

    expect([...newStream.audioTracks.keys()]).toIncludeSameMembers(audioTracks.slice(1))
    expect([...newStream.videoTracks.keys()]).toIncludeSameMembers(videoTracks.slice(1))

    stream.addTrack(videoTracks[0])
    stream.addTrack(audioTracks[0])

    expect([...newStream.audioTracks.keys()]).toIncludeSameMembers(audioTracks)
    expect([...newStream.videoTracks.keys()]).toIncludeSameMembers(videoTracks)
  })

  test('addTrack with no arguments throws error', () => {
    expect(() => stream.addTrack()).toThrow()
  })

  test('removeTrack with no arguments throws error', () => {
    expect(() => stream.removeTrack()).toThrow()
  })

  test('Emits \'ended\' event when a track ends', async () => {
    const track = new FakeMediaTrack({ kind: 'video' })
    stream.addTrack(track)
    const promise = testForEvent(stream, 'ended')
    track.dispatchEvent({ type: 'ended' })
    await expect(promise).resolves.toEqual(track)
  })
  test('Properly updates hasVideoTrack', async () => {
    expect(stream.hasVideoTrack).toBe(false)
    const track = new FakeMediaTrack({ kind: 'video' })
    stream.addTrack(track)
    expect(stream.hasVideoTrack).toBe(true)
    expect(stream.videoTracks.size).toEqual(1)

    const promise = testForEvent(stream, 'updated')
    // Now, remove the track and check again
    stream.removeTrack(track)
    expect(stream.hasVideoTrack).toBe(false)
    expect(stream.videoTracks.size).toEqual(0)
    // Expect event to be emitted
    await expect(promise).toResolve()
  })

  test('Properly updates hasAudioTrack', async () => {
    expect(stream.hasAudioTrack).toBe(false)
    const track = new FakeMediaTrack({ kind: 'audio' })
    stream.addTrack(track)
    expect(stream.hasAudioTrack).toBe(true)
    expect(stream.audioTracks.size).toEqual(1)

    const promise = testForEvent(stream, 'updated')
    // Now, remove the track and check again
    stream.removeTrack(track)
    expect(stream.hasAudioTrack).toBe(false)
    expect(stream.audioTracks.size).toEqual(0)
    // Expect event to be emitted
    await expect(promise).toResolve()
  })

  test('Able to handle multiple tracks of the same kind', () => {
    expect(stream.hasAudioTrack).toBe(false)
    const track1 = new FakeMediaTrack({ kind: 'audio' })
    const track2 = new FakeMediaTrack({ kind: 'audio' })
    stream.addTrack(track1)
    stream.addTrack(track2)
    expect(stream.hasAudioTrack).toBe(true)
    expect(stream.audioTracks.size).toEqual(2)

    stream.removeTrack(track1)
    expect(stream.hasAudioTrack).toBe(true)
    stream.removeTrack(track2)
    expect(stream.hasAudioTrack).toBe(false)
  })

  describe('splitStream', () => {
    test('Properly splits video and audio tracks', async () => {
      const stream = new FakeMediaStream(null, { numVideoTracks: 5, numAudioTracks: 5 })
      const { videoStream, audioStream } = ProxyMediaStream.splitStream(stream)
      expect(videoStream.getTracks()).toIncludeSameMembers(stream.getVideoTracks())
      expect(audioStream.getTracks()).toIncludeSameMembers(stream.getAudioTracks())
    })
    test('Returns undefined if no tracks are available', async () => {
      const stream = new FakeMediaStream(null, { numVideoTracks: 0, numAudioTracks: 0 })
      const { videoStream, audioStream } = ProxyMediaStream.splitStream(stream)
      expect(videoStream).toBeUndefined()
      expect(audioStream).toBeUndefined()
    })
  })

  describe('getFilteredTracks', () => {
    test('Calling with null/undefined works', async () => {
      const newStream = new FakeMediaStream(null, { numVideoTracks: 5, numAudioTracks: 5 })
      const newTracks = newStream.getTracks()
      const filteredTracks = ProxyMediaStream.getFilteredTracks(newStream, null)
      expect(filteredTracks).toIncludeSameMembers(newTracks)

      expect(ProxyMediaStream.getFilteredTracks(null, newStream)).toBeArrayOfSize(0)
    })
    test('Properly filters out tracks', async () => {
      const stream = new FakeMediaStream(null, { numVideoTracks: 5, numAudioTracks: 5 })
      const tracks = stream.getTracks()

      const repeatedTracks = [tracks[0], tracks[2], tracks[6], tracks[8]]
      const newTracks = [...Array(3)].map(x => new FakeMediaTrack())
      const newStream = new FakeMediaStream([...repeatedTracks, ...newTracks])
      const filteredTracks = ProxyMediaStream.getFilteredTracks(newStream, stream)

      expect(filteredTracks).toIncludeSameMembers(newTracks)
    })
  })

  describe('Browser tests', () => {
    let browser
    let page
    let browserScript
    beforeAll(async () => {
      await build({
        configFile: path.join(__dirname, 'vite.config.js'),
        logLevel: 'silent'
      })
      const scriptPath = path.join('/tmp', '__browser__proxy-media-stream.umd.cjs')
      browserScript = fs.readFileSync(scriptPath, 'utf8')
      // fs.unlinkSync(scriptPath)

      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--allow-file-access-from-files',
          '--disable-translate',
          '--use-fake-ui-for-media-stream',
          '--use-fake-device-for-media-stream',
          '--use-file-for-fake-video-capture=./fake-stream.mjpeg',
          '--use-file-for-fake-audio-capture=./fake-stream.wav',
          '--mute-audio'
        ]
      })
      page = await browser.newPage()
      await page.goto('https://google.com')
      await page.addScriptTag({
        content: browserScript
      })
    })

    afterAll(async () => {
      await browser.close()
    })

    async function setupUserMedia (opts = {}) {
      const defaults = { audio: true, video: true }
      const finalOpts = deepmerge(defaults, opts)
      return page.evaluate(async (opts) => {
        window.stream = await navigator.mediaDevices.getUserMedia(opts)
      }, finalOpts)
    }

    test('Check if ProxyMediaStream is available in the browser', async () => {
      await expect(page.evaluate(() => !!window._ProxyMediaStream)).resolves.toBe(true)
    })
    test.skip('Adding a video track to the underlying stream updates ProxyMediaStream\'s \'hasVideoTrack\' property', async () => {
      await setupUserMedia({ video: false })
      const result = await page.evaluate(async () => {
        await new Promise(resolve => setTimeout(resolve, 3000))
        if (!window.stream) {
          throw new Error('No window.stream found')
        }
        const { stream } = window
        const proxyStream = window.proxyStream = new _ProxyMediaStream(stream) // eslint-disable-line no-undef
        // // Only has audio track. Now, get the video track
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        // Add to original stream
        stream.addTrack(videoStream.getTracks()[0])
        await new Promise(resolve => setTimeout(resolve, 100)) // Wait for events to propagate
        return proxyStream.hasVideoTrack
      })
      expect(result).toBe(true)
    })
  })
})
