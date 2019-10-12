/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

'use strict';

const sensortag = require('sensortag');

const {
  Adapter,
  Device,
  Property
} = require('gateway-addon');

class SensorTag extends Device {
  constructor(adapter, tag) {
    super(adapter, `${SensorTag.name}-${tag.id}`);
    this.tag = tag;
    this['@context'] = 'https://iot.mozilla.org/schemas/';
    this['@type'] = ['TemperatureSensor'];
    this.name = this.id;
    this.description = 'SensorTag';

    this.addProperty({
      type: 'number',
      '@type': 'TemperatureProperty',
      unit: 'degree celsius',
      title: 'temperature',
      description: 'The ambient temperature',
      readOnly: true
    });

    this.addProperty({
      type: 'number',
      unit: '%',
      title: 'humidity',
      description: 'The relative humidity',
      readOnly: true
    });
  }

  addProperty(description) {
    const property = new Property(this, description.title, description);
    this.properties.set(description.title, property);
  }

  startPolling(interval) {
    this.poll();
    this.timer = setInterval(() => {
      this.poll();
    }, interval * 1000);
  }

  async poll() {
    console.log(`Connecting to ${this.id}`);
    await this.connect();
    console.log(`Connected to ${this.id}`);
    await this.enableHumidity();
    console.log(`Humidity sensor enabled`);
    await this.sleep(1000);
    const [temperature, humidity] = await this.readHumidity();
    this.updateValue('temperature', temperature);
    this.updateValue('humidity', humidity);
    await this.disableHumidity();
    console.log(`Humidity sensor disabled`);
    await this.disconnect();
    console.log(`Disconnected from ${this.id}`);
  }

  updateValue(name, value) {
    console.log(`Set ${name} to ${value}`);
    const property = this.properties.get(name);
    property.setCachedValue(value);
    this.notifyPropertyChanged(property);
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.tag.connectAndSetUp((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  async enableHumidity() {
    return new Promise((resolve, reject) => {
      this.tag.enableHumidity((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  async sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, ms);
    });
  }

  async readHumidity() {
    return new Promise((resolve, reject) => {
      this.tag.readHumidity((error, temperature, humidity) => {
        if (error) {
          reject(error);
        } else {
          resolve([temperature, humidity]);
        }
      });
    });
  }

  async disableHumidity() {
    return new Promise((resolve, reject) => {
      this.tag.disableHumidity((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  async disconnect() {
    return new Promise((resolve, reject) => {
      this.tag.disconnect((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
}

class SensorTagAdapter extends Adapter {
  constructor(addonManager, manifest) {
    super(addonManager, SensorTagAdapter.name, manifest.name);
    const pollInterval = manifest.moziot.config.pollInterval;
    addonManager.addAdapter(this);
    const knownDevices = {};

    sensortag.discoverAll((tag) => {
      const knownDevice = knownDevices[tag.id];

      if (!knownDevice) {
        console.log(`Detected new SensorTag ${tag.id}`);
        const device = new SensorTag(this, tag);
        knownDevices[tag.id] = device;
        this.handleDeviceAdded(device);
        device.startPolling(pollInterval || 30);
      }
    });
  }
}

module.exports = SensorTagAdapter;
