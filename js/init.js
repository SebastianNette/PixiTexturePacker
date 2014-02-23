/* lets catch all console logs if we have any and the browser doesn't support window.console */
if(!window.console) { window.console = { log: function(){} }; }

/* require.js config */
require.config({
  baseUrl				: 'js/',
  urlArgs				: 'v=' + new Date().getTime(),// <- dev 'v=0.0.1',
  waitSeconds			: 15,
  paths: {
    'class'				: 'lib/class',
    'jquery'			: 'lib/jquery',
    'jquery-ui'			: 'lib/jquery-ui',
    'underscore'		: 'lib/underscore',
    'pixi'				: 'lib/pixi',
    'text'				: 'lib/text'
  },
  shim: {
    'util'				: [ 'jquery' ],
    'jquery-ui'			: [ 'jquery' ]
  }
});

define(['class', 'underscore', 'jquery', 'util'], function() {
  require(['texturepacker']);
});