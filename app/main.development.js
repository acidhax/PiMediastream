/* eslint global-require: 1, flowtype-errors/show-errors: 0 */
// @flow
import { app, BrowserWindow } from 'electron';
import MenuBuilder from './menu';
import fs from 'fs';
import express from 'express';
import pump from 'pump';
import rangeParser from 'range-parser';
const expressapp = require('express')();
const server = require('http').Server(expressapp);

expressapp.get('/:filePath', function (req, res, next) {
  try {
    req.connection.setTimeout(Number.MAX_SAFE_INTEGER);
    let filesize = 0;
    let range = null;
    let filePath = req.params.filePath;
    fs.stat(filePath, function (err, stats) {
        var filesize = stats.size;
        if (req.headers.range) {
          range = rangeParser(filesize, req.headers.range)[0];
          res.statusCode = 206;
          // no support for multi-range reqs
          range = rangeParser(filesize, req.headers.range)[0];
          console.log('range %s', JSON.stringify(range));

          res.setHeader(
            'Content-Range',
            'bytes ' + range.start + '-' + range.end + '/' + filesize
          );
          res.setHeader('Content-Length', range.end - range.start + 1);
        } else {
          res.setHeader('Content-Length', filesize);
        }
        console.log("file:", filePath);
        res.statusCode = 200;
        pump(fs.createReadStream(filePath, range||{}), res);
    });
  } catch (ex) {

  }
});

console.info("http://localhost:3100");
server.listen(3100);
let mainWindow = null;

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

if (process.env.NODE_ENV === 'development') {
  require('electron-debug')();
  const path = require('path');
  const p = path.join(__dirname, '..', 'app', 'node_modules');
  require('module').globalPaths.push(p);
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = [
    'REACT_DEVELOPER_TOOLS',
    'REDUX_DEVTOOLS'
  ];

  return Promise
    .all(extensions.map(name => installer.default(installer[name], forceDownload)))
    .catch(console.log);
};


app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});


app.on('ready', async () => {
  if (process.env.NODE_ENV === 'development') {
    await installExtensions();
  }

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728
  });

  mainWindow.loadURL(`file://${__dirname}/app.html`);

  // @TODO: Use 'ready-to-show' event
  //        https://github.com/electron/electron/blob/master/docs/api/browser-window.md#using-ready-to-show-event
  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();
});
