// ==UserScript==
// @name         idk
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  idk
// @author       midleg
// @match        https://pixelplanet.fun/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';
    const spoofedUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    Object.defineProperty(navigator, 'userAgent', { get: () => spoofedUA });
    Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });

    const originalQuery = window.screen.availWidth;
    Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
    Object.defineProperty(screen, 'availHeight', { get: () => 1080 });
    Object.defineProperty(screen, 'width', { get: () => 1920 });
    Object.defineProperty(screen, 'height', { get: () => 1080 });
    if (window.RTCPeerConnection) {
        const originalRTCPeerConnection = window.RTCPeerConnection;
        window.RTCPeerConnection = function() {
            return { createDataChannel: () => {}, createOffer: () => {}, createAnswer: () => {} };
        };
    }
    window.webkitRTCPeerConnection = undefined;
    window.mozRTCPeerConnection = undefined;
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type) {
        if (type === 'webgl' || type === 'experimental-webgl' || type === 'webgl2') {
            const ctx = getContext.apply(this, arguments);
            const originalGetParameter = ctx.getParameter;
            ctx.getParameter = function(parameter) {
                if (parameter === 0x1F00 || parameter === 0x1F01) { 
                    return 'Intel Inc.ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)';
                }
                if (parameter === 0x9245) { 
                    return 'Intel Inc.';
                }
                if (parameter === 0x9246) { 
                    return 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)';
                }
                return originalGetParameter.apply(this, arguments);
            };
            return ctx;
        }
        return getContext.apply(this, arguments);
    };
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const [url, options = {}] = args;
        if (options.headers) {
            delete options.headers['X-Forwarded-For'];
            delete options.headers['X-Real-IP'];
            options.headers['User-Agent'] = spoofedUA;
        }
        return originalFetch.apply(this, [url, options]);
    };
    const originalXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function() {
        const xhr = new originalXHR();
        const originalOpen = xhr.open;
        xhr.open = function(method, url, ...rest) {
            this._custom = { method, url };
            return originalOpen.apply(this, [method, url, ...rest]);
        };
        const originalSend = xhr.send;
        xhr.send = function(body) {
            if (this._custom) {
                this.setRequestHeader('User-Agent', spoofedUA);
                this.setRequestHeader('Accept-Language', 'en-US,en;q=0.9');
            }
            return originalSend.apply(this, [body]);
        };
        return xhr;
    };
    console.log('pixelblabla shit proxy');
})();
