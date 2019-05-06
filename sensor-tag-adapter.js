/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

'use strict';

const noble = require('@abandonware/noble');

const {
  Adapter,
  Device,
  Property
} = require('gateway-addon');

const HUMIDITY_SERVICE = 'f000aa2004514000b000000000000000';
const HUMIDITY_DATA_CHARACTERISTIC = 'f000aa2104514000b000000000000000';
const HUMIDITY_CONFIG_CHARACTERISTIC = 'f000aa2204514000b000000000000000';

class SensorTag extends Device {
  constructor(adapter, peripheral) {
    super(adapter, `${SensorTag.name}-${peripheral.address}`);
    this.peripheral = peripheral;
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
  }

  addProperty(description) {
    const property = new Property(this, description.title, description);
    this.properties.set(description.title, property);
  }

  startPolling(interval) {
    this.timer = setInterval(() => {
      this.poll();
    }, interval * 1000);
  }

  async poll() {
    console.log(`Connecting to ${this.id}`);
    await this.connect();
    console.log(`Connected to ${this.id}`);
    const [dataService] = await this.discoverServices([HUMIDITY_SERVICE]);
    console.log(`Discovered services`);
    // eslint-disable-next-line max-len
    const [dataCharacteristic, configCharacteristic] = await this.discoverCharacteristics(dataService, [HUMIDITY_DATA_CHARACTERISTIC, HUMIDITY_CONFIG_CHARACTERISTIC]);
    console.log(`Discovered characteristics`);
    await this.write(configCharacteristic, Buffer.from([0x01]));
    console.log(`Humidity sensor enabled`);
    const data = await this.read(dataCharacteristic);
    this.disconnect();
    console.log(`Read data characteristic`);
    // SHT21 temperature conversion
    const temperature = -46.85 + 175.72 / 65536.0 * data.readUInt16LE(0);
    this.updateValue('temperature', temperature);
  }

  updateValue(name, value) {
    const property = this.properties.get(name);
    property.setCachedValue(value);
    this.notifyPropertyChanged(property);
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.peripheral.connect((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  async discoverServices(uuids) {
    return new Promise((resolve, reject) => {
      this.peripheral.discoverServices(uuids, (error, services) => {
        if (error) {
          reject(error);
        } else {
          resolve(services);
        }
      });
    });
  }

  async discoverCharacteristics(service, uuids) {
    return new Promise((resolve, reject) => {
      service.discoverCharacteristics(uuids, (error, characteristics) => {
        if (error) {
          reject(error);
        } else {
          resolve(characteristics);
        }
      });
    });
  }

  async read(characteristic) {
    return new Promise((resolve, reject) => {
      characteristic.read((error, data) => {
        if (error) {
          reject(error);
        } else {
          resolve(data);
        }
      });
    });
  }

  async write(characteristic, value) {
    return new Promise((resolve, reject) => {
      characteristic.write(value, false, (error) => {
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
      this.peripheral.disconnect((error) => {
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

    noble.on('stateChange', (state) => {
      console.log('Noble adapter is %s', state);

      if (state === 'poweredOn') {
        console.log('Start scanning for devices');
        noble.startScanning([], true);
      }
    });

    noble.on('discover', (peripheral) => {
      if (peripheral.advertisement.localName == 'SensorTag') {
        const knownDevice = knownDevices[peripheral.address];

        if (!knownDevice) {
          console.log(`Detected new SensorTag ${peripheral.address}`);
          const device = new SensorTag(this, peripheral);
          knownDevices[peripheral.address] = device;
          this.handleDeviceAdded(device);
          device.startPolling(pollInterval || 30);
        }
      }
    });
  }
}

module.exports = SensorTagAdapter;
