import * as events from 'events';

import * as debugModule from 'debug';
import * as WebSocket from 'isomorphic-ws';

const debug = debugModule('bindings');

import { NobleBindingsInterface } from '../bindings';


export class NobleBindings extends events.EventEmitter implements NobleBindingsInterface {
  private _ws: WebSocket;
  private _startScanCommand;
  private _peripherals;

  constructor() {
    super();
    const port = 0xB1e;
    this._ws = new WebSocket(`ws://localhost:${port}`);

    this._startScanCommand = null;
    this._peripherals = {};

    this.on('message', this._onMessage.bind(this));

    this._ws.on('open', this._onOpen.bind(this));
    this._ws.on('close', this._onClose.bind(this));
    this._ws.on('error', this._onClose.bind(this));

    this._ws.on('message', (data: string) => {
      this.emit('message', JSON.parse(data));
    });
  }

  init() {
    // no-op
  }

  _onOpen() {
    debug('on -> open');
  }

  _onClose() {
    debug('on -> close');
    this.emit('stateChange', 'poweredOff');
  }

  _onMessage(event) {
    const type = event.type;
    const peripheralUuid = event.peripheralUuid;
    const address = event.address;
    const addressType = event.addressType;
    const connectable = event.connectable;
    let advertisement = event.advertisement;
    const rssi = event.rssi;
    const serviceUuids = event.serviceUuids;
    const serviceUuid = event.serviceUuid;
    const includedServiceUuids = event.includedServiceUuids;
    const characteristics = event.characteristics;
    const characteristicUuid = event.characteristicUuid;
    const data = event.data ? Buffer.from(event.data, 'hex') : null;
    const isNotification = event.isNotification;
    const state = event.state;
    const descriptors = event.descriptors;
    const descriptorUuid = event.descriptorUuid;
    const handle = event.handle;

    if (type === 'stateChange') {
      this.emit('stateChange', state);
    } else if (type === 'discover') {
      advertisement = {
        localName: advertisement.localName,
        txPowerLevel: advertisement.txPowerLevel,
        serviceUuids: advertisement.serviceUuids,
        manufacturerData: (advertisement.manufacturerData ? Buffer.from(advertisement.manufacturerData, 'hex') : null),
        serviceData: (advertisement.serviceData ? Buffer.from(advertisement.serviceData, 'hex') : null)
      };

      this._peripherals[peripheralUuid] = {
        uuid: peripheralUuid,
        address: address,
        advertisement: advertisement,
        rssi: rssi
      };

      this.emit('discover', peripheralUuid, address, addressType, connectable, advertisement, rssi);
    } else if (type === 'connect') {
      this.emit('connect', peripheralUuid);
    } else if (type === 'disconnect') {
      this.emit('disconnect', peripheralUuid);
    } else if (type === 'rssiUpdate') {
      this.emit('rssiUpdate', peripheralUuid, rssi);
    } else if (type === 'servicesDiscover') {
      this.emit('servicesDiscover', peripheralUuid, serviceUuids);
    } else if (type === 'includedServicesDiscover') {
      this.emit('includedServicesDiscover', peripheralUuid, serviceUuid, includedServiceUuids);
    } else if (type === 'characteristicsDiscover') {
      this.emit('characteristicsDiscover', peripheralUuid, serviceUuid, characteristics);
    } else if (type === 'read') {
      this.emit('read', peripheralUuid, serviceUuid, characteristicUuid, data, isNotification);
    } else if (type === 'write') {
      this.emit('write', peripheralUuid, serviceUuid, characteristicUuid);
    } else if (type === 'broadcast') {
      this.emit('broadcast', peripheralUuid, serviceUuid, characteristicUuid, state);
    } else if (type === 'notify') {
      this.emit('notify', peripheralUuid, serviceUuid, characteristicUuid, state);
    } else if (type === 'descriptorsDiscover') {
      this.emit('descriptorsDiscover', peripheralUuid, serviceUuid, characteristicUuid, descriptors);
    } else if (type === 'valueRead') {
      this.emit('valueRead', peripheralUuid, serviceUuid, characteristicUuid, descriptorUuid, data);
    } else if (type === 'valueWrite') {
      this.emit('valueWrite', peripheralUuid, serviceUuid, characteristicUuid, descriptorUuid);
    } else if (type === 'handleRead') {
      this.emit('handleRead', peripheralUuid, handle, data);
    } else if (type === 'handleWrite') {
      this.emit('handleWrite', peripheralUuid, handle);
    } else if (type === 'handleNotify') {
      this.emit('handleNotify', peripheralUuid, handle, data);
    }
  }

  _sendCommand(command, errorCallback?) {
    const message = JSON.stringify(command);
    this._ws.send(message, (error) => {
      if (error !== null) {
        if (typeof errorCallback === 'function') {
          errorCallback(error);
        }
      }
    });
  }

  startScanning(serviceUuids: string[] = [], allowDuplicates) {
    this._startScanCommand = {
      action: 'startScanning',
      serviceUuids: serviceUuids,
      allowDuplicates: allowDuplicates
    };
    this._sendCommand(this._startScanCommand);

    this.emit('scanStart');
  }

  stopScanning() {
    this._startScanCommand = null;

    this._sendCommand({
      action: 'stopScanning'
    });

    this.emit('scanStop');
  }

  connect(deviceUuid: string) {
    const peripheral = this._peripherals[deviceUuid];

    this._sendCommand({
      action: 'connect',
      peripheralUuid: peripheral.uuid
    });
  }

  disconnect(deviceUuid: string) {
    const peripheral = this._peripherals[deviceUuid];

    this._sendCommand({
      action: 'disconnect',
      peripheralUuid: peripheral.uuid
    });
  }

  updateRssi(deviceUuid: string) {
    const peripheral = this._peripherals[deviceUuid];

    this._sendCommand({
      action: 'updateRssi',
      peripheralUuid: peripheral.uuid
    });
  }

  discoverServices(deviceUuid: string, serviceUuids: string[] = []) {
    const peripheral = this._peripherals[deviceUuid];

    this._sendCommand({
      action: 'discoverServices',
      peripheralUuid: peripheral.uuid,
      uuids: serviceUuids
    });
  }

  discoverIncludedServices(deviceUuid: string, serviceUuid: string, serviceUuids: string[]) {
    const peripheral = this._peripherals[deviceUuid];

    this._sendCommand({
      action: 'discoverIncludedServices',
      peripheralUuid: peripheral.uuid,
      serviceUuid: serviceUuid,
      serviceUuids: serviceUuids
    });
  }

  discoverCharacteristics(deviceUuid: string, serviceUuid: string, characteristicUuids: string[]) {
    const peripheral = this._peripherals[deviceUuid];

    this._sendCommand({
      action: 'discoverCharacteristics',
      peripheralUuid: peripheral.uuid,
      serviceUuid: serviceUuid,
      characteristicUuids: characteristicUuids
    });
  }

  read(deviceUuid: string, serviceUuid: string, characteristicUuid: string) {
    const peripheral = this._peripherals[deviceUuid];

    this._sendCommand({
      action: 'read',
      peripheralUuid: peripheral.uuid,
      serviceUuid: serviceUuid,
      characteristicUuid: characteristicUuid
    });
  }

  write(deviceUuid: string, serviceUuid: string, characteristicUuid: string, data, withoutResponse) {
    const peripheral = this._peripherals[deviceUuid];

    this._sendCommand({
      action: 'write',
      peripheralUuid: peripheral.uuid,
      serviceUuid: serviceUuid,
      characteristicUuid: characteristicUuid,
      data: data.toString('hex'),
      withoutResponse: withoutResponse
    });
  }

  broadcast(deviceUuid: string, serviceUuid: string, characteristicUuid: string, broadcast) {
    const peripheral = this._peripherals[deviceUuid];

    this._sendCommand({
      action: 'broadcast',
      peripheralUuid: peripheral.uuid,
      serviceUuid: serviceUuid,
      characteristicUuid: characteristicUuid,
      broadcast: broadcast
    });
  }

  notify(deviceUuid: string, serviceUuid: string, characteristicUuid: string, notify) {
    const peripheral = this._peripherals[deviceUuid];

    this._sendCommand({
      action: 'notify',
      peripheralUuid: peripheral.uuid,
      serviceUuid: serviceUuid,
      characteristicUuid: characteristicUuid,
      notify: notify
    });
  }

  discoverDescriptors(deviceUuid: string, serviceUuid: string, characteristicUuid: string) {
    const peripheral = this._peripherals[deviceUuid];

    this._sendCommand({
      action: 'discoverDescriptors',
      peripheralUuid: peripheral.uuid,
      serviceUuid: serviceUuid,
      characteristicUuid: characteristicUuid
    });
  }

  readValue(deviceUuid: string, serviceUuid: string, characteristicUuid: string, descriptorUuid: string) {
    const peripheral = this._peripherals[deviceUuid];

    this._sendCommand({
      action: 'readValue',
      peripheralUuid: peripheral.uuid,
      serviceUuid: serviceUuid,
      characteristicUuid: characteristicUuid,
      descriptorUuid: descriptorUuid
    });
  }

  writeValue(deviceUuid: string, serviceUuid: string, characteristicUuid: string, descriptorUuid: string, data) {
    const peripheral = this._peripherals[deviceUuid];

    this._sendCommand({
      action: 'writeValue',
      peripheralUuid: peripheral.uuid,
      serviceUuid: serviceUuid,
      characteristicUuid: characteristicUuid,
      descriptorUuid: descriptorUuid,
      data: data.toString('hex')
    });
  }

  readHandle(deviceUuid: string, handle) {
    const peripheral = this._peripherals[deviceUuid];

    this._sendCommand({
      action: 'readHandle',
      peripheralUuid: peripheral.uuid,
      handle: handle
    });
  }

  writeHandle(deviceUuid: string, handle, data, withoutResponse) {
    const peripheral = this._peripherals[deviceUuid];

    this._sendCommand({
      action: 'writeHandle',
      peripheralUuid: peripheral.uuid,
      handle: handle,
      data: data.toString('hex'),
      withoutResponse: withoutResponse
    });
  }
}
