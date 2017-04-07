// @flow
import React, { Component } from 'react';
import { Link } from 'react-router';
import styles from './Home.css';
import InputRange from 'react-input-range';
import secondsConverter from 'seconds-converter';
import Modal from 'react-modal';
import io from 'socket.io-client/dist/socket.io';

const mdns = require('mdns-js');
const browser = mdns.createBrowser(mdns.tcp("raspberrycast"));
let socket = null;

export default class Home extends Component {
  constructor(props) {
    super(props);
    this.bindHandlers();
    this.state = {};
    this.state.status = {};
    this.state.modalShown = true;
    this.deviceList = [];
    this.devices = {};

    browser.on('ready', () => {
        browser.discover(); 
    });
  }

  bindHandlers() {
    browser.on('update', (data) => {
      console.log('update', data);
      if (data.addresses[0]) {
        this.devices[data.addresses[0]]=data;
        this.deviceList.push(this.renderDevice(data));
        this.setState({
          ...this.state,
          deviceList: this.deviceList
        });
      }
    });
  }

  renderDevice(device) {
    console.log(device);
    return (
      <div onClick={this.connect.bind(this, device)}>
        {device.addresses[0]}
      </div>
    );
  }

  connect(device) {
    console.log("connect");
    this.server = device.addresses[0];
    this.port = device.port;

    if (this.socket) {
      this.socket.close();
    }
    this.socket = io.connect(`http://${this.server}:${this.port}`);
    this.socket.on("data", (data) => {
      this.onStatusUpdate(data);
    });
    this.socket.on("PlaybackStatus", (status, oldStatus) => {
      console.log("PlaybackStatus", status, oldStatus);
    })
    this.setState({...this.state, modalShown: false});
  }

  onModalOpen () {

  }

  onRequestClose() {

  }

  renderModalContent() {
    return (
      <div>
        <h1>Select RaspberryPi Device</h1>
        <ul>
          <li>{this.deviceList}</li>
        </ul>
      </div>
    );
  }

  render() {
    return (
      <div>
        <div className={styles.container}>
          <Modal
            isOpen={this.state.modalShown}
            onAfterOpen={this.onModalOpen.bind(this)}
            onRequestClose={this.onRequestClose.bind(this)}
            closeTimeoutMS={1000}
            contentLabel="Modal">
            {this.renderModalContent()}
          </Modal>
          <h2>Home</h2>
          <input type="file" id="file-input" onChange={this.onFileChange.bind(this)}/>
          <InputRange
            formatLabel={value => {
              if (value) {
                let time = secondsConverter(parseInt(value), "sec");
                let label = pad(time.hours, 2)+":"+pad(time.minutes, 2)+":"+pad(time.seconds, 2);
                return label;
              }

              return value;
            }}
            maxValue={this.state.status.duration/1000000}
            minValue={0}
            value={this.state.status.position/1000000}
            onChange={value => {
              console.log("Change value", value);
              this.state.status.position = value*1000000;
              this.setState(this.state);
            }}
            onChangeComplete={value => {
              this.seek(value*1000000)
            }}
          />
          <button onClick={this.onPlayPauseClick.bind(this)}>Play/Pause</button>
          <button onClick={this.onInfoClick.bind(this)}>Info</button>
        </div>
      </div>
    );
  }

  onStatusUpdate(status) {
    // 1 second = 1000000us
    this.setState({
      ...this.state,
      status
    })
  }

  onFileChange(ev) {
    var file = ev.target.files[0];
    console.log(file.path);
    let ip = this.server+":"+this.port;
    this.stop();
    fetch("http://"+ip+"/stream?url="+encodeURIComponent(`http://{{DYNAMIC_IP}}:3100/${encodeURIComponent(file.path)}`));
  }

  onPlayPauseClick(ev) {
    this.socket.emit("command", {command: "playPause"});
  }

  onInfoClick(ev) {
    // this.socket.emit("command", {command: "info"});
    this.stop();
  }

  stop(){
    this.socket.emit("command", {command: "stop"});
  }

  seek(val) {
    console.log("SEEK TO POSITION", val);
    this.socket.emit("command", {command: "setPosition", value: val});
  }
}
function pad(n, width, z) {
  z = z || '0';
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}