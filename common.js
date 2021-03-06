'use strict';

var os = navigator.userAgent.indexOf('Firefox') !== -1 ? 'firefox' : (
  navigator.userAgent.indexOf('OPR') === -1 ? 'chrome' : 'opera'
);

var win = {};

var stats = {
  total: 0,
  media: 0
};

var config = {
  urls: {
    chrome: {
      app: 'https://chrome.google.com/webstore/detail/turbo-download-manager/kemfccojgjoilhfmcblgimbggikekjip'
    },
    opera: {
      app: 'https://addons.opera.com/extensions/details/turbo-download-manager/'
    },
    firefox: {
      app: 'https://addons.mozilla.org/firefox/addon/turbo-download-manager/'
    }
  }
};

var position = function (prefs) { // jshint ignore:line
  chrome.storage.local.set(prefs);
};

var monitor = {
  observe: (d) => {
    if (d.tabId === -1) {
      return;
    }
    // prevent YouTube video link detection
    if (d.url.indexOf('googlevideo.') !== -1) {
      return;
    }
    let type = d.responseHeaders.filter(o => o.name === 'content-type' || o.name === 'Content-Type');

    if (type.length) {
      stats.total += 1;
      type = type[0].value;

      const length = d.responseHeaders
        .filter(o => o.name === 'content-length' || o.name === 'Content-Length')
        .map(l => l.value).shift();

      if (
        type.startsWith('image') ||
        type.startsWith('video') ||
        type.startsWith('audio') ||
        (type.startsWith('application') && type.indexOf('javascript') === -1)
      ) {
        stats.media += 1;
        chrome.runtime.sendMessage({
          cmd: 'append',
          id: d.requestId,
          url: d.url,
          otype: d.type,
          tabId: d.tabId,
          timeStamp: d.timeStamp,
          methd: d.method,
          length,
          disposition: d.responseHeaders
            .filter(o => o.name === 'content-disposition' || o.name === 'Content-Disposition')
            .map(o => o.value)
            .shift(),
          type,
          stats
        });
      }
    }
  },
  activate: () => {
    chrome.webRequest.onHeadersReceived.addListener(monitor.observe,
      {urls: ['<all_urls>']},
      ['responseHeaders']
    );
    chrome.browserAction.setBadgeText({text: 'R'});
  },
  deactivate: () => {
    chrome.webRequest.onHeadersReceived.removeListener(monitor.observe);
    chrome.browserAction.setBadgeText({text: ''});
  }
};

chrome.browserAction.onClicked.addListener(() => {
  function create () {
    chrome.storage.local.get({
      width: 700,
      height: 500,
      left: Math.round((screen.availWidth - 700) / 2),
      top: Math.round((screen.availHeight - 500) / 2),
    }, prefs => {
      chrome.windows.create({
        url: chrome.extension.getURL('data/window/index.html'),
        width: prefs.width,
        height: prefs.height,
        left: prefs.left,
        top: prefs.top,
        type: 'popup'
      }, w => {
        win = w;
        monitor.activate();
      });
    });
  }
  if (win.id) {
    chrome.windows.get(win.id, w => {
      if (chrome.runtime.lastError || !w) {
        create();
      }
      else {
        chrome.windows.update(win.id, {focused: true});
      }
    });
  }
  else {
    create();
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message === 'pause') {
    monitor.deactivate();
  }
  else if (message === 'resume') {
    monitor.activate();
  }
  else if (message.cmd === 'download-browser') {
    let options = {
      url: message.url
    };
    if (message.filename && message.filename !== '-') {
      options.filename = message.filename
        .replace(/[`~!@#$%^&*()_|+\-=?;:'",<>\{\}\[\]\\\/]/gi, '');
    }

    chrome.downloads.download(options, () => {
      if (chrome.runtime.lastError) {
        let a = document.createElement('a');
        a.href = options.url;
        a.setAttribute('download', options.filename || 'unknown_name');
        a.dispatchEvent(new MouseEvent('click'));
      }
    });
  }
  else if (message.cmd === 'download-tdm' && chrome.management) {
    const id = ({
      opera: 'lejgoophpfnabjcnfbphcndcjfpinbfk',
      chrome: 'kemfccojgjoilhfmcblgimbggikekjip',
      firefox: 'jid0-dsq67mf5kjjhiiju2dfb6kk8dfw@jetpack'
    })[os];
    chrome.management.get(id,
      (result) => {
        if (result) {
          chrome.management.launchApp(id, () => {
            chrome.runtime.sendMessage(id, {
              'cmd': 'download',
              'url': message.url,
              'referrer': message.referrer
            });
          });
        }
        else {
          chrome.tabs.create({
            url: config.urls[os].app,
            active: true
          });
          chrome.notifications.create(null, {
            type: 'basic',
            iconUrl: './data/icons/48.png',
            title: 'Bulk Media Downloader',
            message: 'Please install "Turbo Download Manager" extension first'
          });
        }
      }
    );
  }
});

// FAQs & Feedback
chrome.storage.local.get({
  'version': null,
  'faqs': navigator.userAgent.toLowerCase().indexOf('firefox') === -1 ? true : false
}, prefs => {
  let version = chrome.runtime.getManifest().version;

  if (prefs.version ? (prefs.faqs && prefs.version !== version) : true) {
    chrome.storage.local.set({version}, () => {
      chrome.tabs.create({
        url: 'http://add0n.com/media-tools.html?version=' + version +
          '&type=' + (prefs.version ? ('upgrade&p=' + prefs.version) : 'install')
      });
    });
  }
});
(function () {
  let {name, version} = chrome.runtime.getManifest();
  chrome.runtime.setUninstallURL('http://add0n.com/feedback.html?name=' + name + '&version=' + version);
})();
