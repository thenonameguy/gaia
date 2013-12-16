'use strict';

var Rocketbar = {

  enabled: false,

  searchAppURL: null,

  _port: null,

  searchContainer: document.getElementById('search-container'),

  searchBar: document.getElementById('search-bar'),

  get shown() {
    return ('visible' in this.searchBar.dataset);
  },

  get searchInput() {
    var input = document.getElementById('search-input');
    var self = this;
    input.addEventListener('input', function onInput(e) {
      self._port.postMessage({
        'type': 'change',
        'input': input.value
      });
    });
    input.addEventListener('keyup', function onKeyPress(e) {
      if (e.keyCode === 13) {
        self._port.postMessage({
          'type': 'submit',
          'input': input.value
        });
      }
    });

    delete this.searchInput;
    return this.searchInput = input;
  },

  init: function() {
    SettingsListener.observe('rocketbar.enabled', false,
    function(value) {
      this.enabled = value;
    }.bind(this));

    SettingsListener.observe('rocketbar.searchAppURL', false,
    function(url) {
      this.searchAppURL = url;
      this.searchManifestURL = url.match(/(^.*?:\/\/.*?\/)/)[1] +
        'manifest.webapp';
    }.bind(this));
  },

  loadSearchApp: function() {
    var container = this.searchContainer;
    var searchFrame = container.querySelector('iframe');

    // If there is already a search frame, tell it that it is
    // visible and bail out.
    if (searchFrame) {
      searchFrame.setVisible(true);
      return;
    }

    searchFrame = document.createElement('iframe');
    searchFrame.src = this.searchAppURL;
    searchFrame.setAttribute('mozapptype', 'mozsearch');
    searchFrame.setAttribute('mozbrowser', 'true');
    searchFrame.setAttribute('remote', 'true');
    searchFrame.setAttribute('mozapp', this.searchManifestURL);

    container.appendChild(searchFrame);

    searchFrame.addEventListener('mozbrowsererror', function() {
      container.removeChild(searchFrame);
    });

    this.initSearchConnection();
  },

  initSearchConnection: function() {
    var self = this;
    navigator.mozApps.getSelf().onsuccess = function() {
      var app = this.result;
      app.connect('search').then(
        function onConnectionAccepted(ports) {
          ports.forEach(function(port) {
            self._port = port;
          });
        },
        function onConnectionRejected(reason) {
          dump('Error connecting: ' + reason + '\n');
        }
      );
    };

    // IACHandler will dispatch inter-app messages
    window.addEventListener('iac-search-results',
      self.onSearchMessage.bind(self));
  },

  onSearchMessage: function(e) {
    var detail = e.detail;
    if (detail.action && detail.action === 'close') {
      this.hide();
    } else if (detail.input) {
      var input = this.searchInput;
      input.value = detail.input;
      this._port.postMessage({ 'input': input.value });
    }
  },

  hide: function() {
    if (!this.shown)
      return;

    this.searchInput.blur();

    var searchFrame = this.searchContainer.querySelector('iframe');
    if (searchFrame) {
      searchFrame.setVisible(false);
    }
    delete this.searchBar.dataset.visible;
  },

  render: function() {
    var search = this.searchBar;
    search.dataset.visible = 'true';

    var input = this.searchInput;
    input.value = '';

    var self = this;
    search.addEventListener('transitionend', function shown(e) {
      search.removeEventListener(e.type, shown);
      input.focus();
      self.loadSearchApp();
    });
  }
};

Rocketbar.init();
