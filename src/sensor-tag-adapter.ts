/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

'use strict';

import sensortag, { Tag } from 'sensortag';

import { Adapter, Device, Property } from 'gateway-addon';

class SensorTag extends Device {
  constructor(adapter: Adapter, private tag: Tag, private debugLogs: boolean) {
    super(adapter, `${SensorTag.name}-${tag.id}`);
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
      '@type': 'HumidityProperty',
      unit: '%',
      title: 'humidity',
      description: 'The relative humidity',
      readOnly: true
    });
  }

  debug(msg: string) {
    if (this.debugLogs) {
      console.log(msg);
    }
  }

  addProperty(description: any) {
    const property = new Property(this, description.title, description);
    this.properties.set(description.title, property);
  }

  startPolling(interval: number) {
    this.poll();

    setInterval(() => {
      this.poll();
    }, interval * 1000);
  }

  async poll() {
    this.debug(`Connecting to ${this.id}`);
    await this.connect();
    this.debug(`Connected to ${this.id}`);
    await this.enableHumidity();
    this.debug(`Humidity sensor enabled`);
    await this.sleep(1000);
    const [temperature, humidity] = await this.readHumidity();
    this.updateValue('temperature', temperature);
    this.updateValue('humidity', humidity);
    await this.disableHumidity();
    this.debug(`Humidity sensor disabled`);
    await this.disconnect();
    this.debug(`Disconnected from ${this.id}`);
  }

  updateValue(name: string, value: any) {
    this.debug(`Set ${name} to ${value}`);
    const property = this.properties.get(name);
    if (property) {
      property.setCachedValue(value);
      this.notifyPropertyChanged(property);
    }
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.tag.connectAndSetUp((error: any) => {
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
      this.tag.enableHumidity((error: any) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  async sleep(ms: number) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, ms);
    });
  }

  async readHumidity(): Promise<number[]> {
    return new Promise((resolve, reject) => {
      this.tag.readHumidity((error: any, temperature: number, humidity: number) => {
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
      this.tag.disableHumidity((error: any) => {
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
      this.tag.disconnect((error: any) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
}

export class SensorTagAdapter extends Adapter {
  constructor(addonManager: any, manifest: any) {
    super(addonManager, SensorTagAdapter.name, manifest.name);

    const {
      pollInterval,
      debug
    } = manifest.moziot.config;

    addonManager.addAdapter(this);

    const knownDevices: { [key: string]: SensorTag } = {};

    sensortag.discoverAll((tag) => {
      const knownDevice = knownDevices[tag.id];

      if (!knownDevice) {
        console.log(`Detected new SensorTag ${tag.id}`);
        const device = new SensorTag(this, tag, debug);
        knownDevices[tag.id] = device;
        this.handleDeviceAdded(device);
        device.startPolling(pollInterval || 30);
      }
    });
  }
}
