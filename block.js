// IME Unfreeze — runs in the MAIN page world at document_start.
//
// Why: ChatGPT (and Claude) eagerly construct an RTCPeerConnection during
// early page life — likely a voice-mode warm-up. On macOS this can block the
// main thread for 20-90s on the first CJK IME compositionstart, because
// Chrome's WebRTC stack initializes audio device enumeration / mDNS ICE
// candidate gathering synchronously on the main thread.
//
// Fix: replace the constructor with a stub that returns an object exposing
// the full RTCPeerConnection API surface as no-ops / rejected promises. The
// warm-up gets back an "object" instead of throwing (avoids React error
// boundaries), but every real call fails harmlessly. Voice mode breaks; text
// chat is unaffected.
//
// Disable this extension if you want to actually use Advanced Voice Mode.

(() => {
  if (window.__imeUnfreezeInstalled) return;
  window.__imeUnfreezeInstalled = true;

  const noop = () => {};
  const rejected = () => Promise.reject(
    new DOMException("RTCPeerConnection disabled by ime-unfreeze", "NotAllowedError")
  );

  function makeStub() {
    const target = new EventTarget();
    Object.assign(target, {
      localDescription: null,
      remoteDescription: null,
      currentLocalDescription: null,
      currentRemoteDescription: null,
      pendingLocalDescription: null,
      pendingRemoteDescription: null,
      signalingState: "closed",
      iceGatheringState: "new",
      iceConnectionState: "new",
      connectionState: "new",
      canTrickleIceCandidates: null,
      onconnectionstatechange: null,
      ondatachannel: null,
      onicecandidate: null,
      onicecandidateerror: null,
      oniceconnectionstatechange: null,
      onicegatheringstatechange: null,
      onnegotiationneeded: null,
      onsignalingstatechange: null,
      ontrack: null,
      addTrack() { return { track: null, transport: null, getParameters: () => ({}), replaceTrack: rejected }; },
      removeTrack: noop,
      addTransceiver() {
        return {
          direction: "inactive",
          currentDirection: null,
          mid: null,
          stopped: true,
          stop: noop,
          sender: {
            track: null,
            transport: null,
            replaceTrack: rejected,
            setParameters: rejected,
            getParameters: () => ({}),
            getStats: () => Promise.resolve(new Map())
          },
          receiver: {
            track: null,
            transport: null,
            getParameters: () => ({}),
            getStats: () => Promise.resolve(new Map()),
            getContributingSources: () => [],
            getSynchronizationSources: () => []
          }
        };
      },
      createOffer: rejected,
      createAnswer: rejected,
      setLocalDescription: rejected,
      setRemoteDescription: rejected,
      addIceCandidate: rejected,
      close: noop,
      getSenders: () => [],
      getReceivers: () => [],
      getTransceivers: () => [],
      getStats: () => Promise.resolve(new Map()),
      createDataChannel() {
        const dc = new EventTarget();
        Object.assign(dc, {
          label: "",
          ordered: true,
          maxPacketLifeTime: null,
          maxRetransmits: null,
          protocol: "",
          negotiated: false,
          id: null,
          readyState: "closed",
          bufferedAmount: 0,
          bufferedAmountLowThreshold: 0,
          binaryType: "blob",
          send: noop,
          close: noop,
          onopen: null,
          onclose: null,
          onerror: null,
          onmessage: null,
          onbufferedamountlow: null
        });
        return dc;
      },
      setConfiguration: noop,
      getConfiguration: () => ({}),
      restartIce: noop,
      setIdentityProvider: noop,
      getIdentityAssertion: rejected
    });
    return target;
  }

  let blockedCount = 0;
  function Blocked() {
    blockedCount++;
    if (blockedCount <= 3) {
      console.warn(
        "[ime-unfreeze] RTCPeerConnection stubbed (#" + blockedCount + ") on " + location.hostname +
        " — disable this extension if you need voice mode"
      );
    }
    return makeStub();
  }

  // Preserve static members / prototype so `instanceof` checks and feature
  // detection (`'generateCertificate' in RTCPeerConnection`) still pass.
  const orig = window.RTCPeerConnection;
  if (orig) {
    try { Object.setPrototypeOf(Blocked, orig); } catch {}
    Blocked.prototype = orig.prototype;
    if (typeof orig.generateCertificate === "function") {
      Blocked.generateCertificate = rejected;
    }
  }

  function install(name) {
    if (!(name in window)) return;
    try {
      Object.defineProperty(window, name, {
        value: Blocked,
        writable: false,
        configurable: false
      });
    } catch (e) {
      try { window[name] = Blocked; } catch {}
    }
  }

  install("RTCPeerConnection");
  install("webkitRTCPeerConnection");

  console.log("[ime-unfreeze] installed on " + location.hostname);
})();
