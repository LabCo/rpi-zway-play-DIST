function EventForwarder(id, controller) {
    // Call superconstructor first (AutomationModule)
    EventForwarder.super_.call(this, id, controller);
}

inherits(EventForwarder, AutomationModule);

_module = EventForwarder;

// ----------------------------------------------------------------------------
// --- Module instance initialized
// ----------------------------------------------------------------------------

EventForwarder.prototype.init = function (config) {
    EventForwarder.super_.prototype.init.call(this, config);

    var self = this;

    if(this.config.submit_hosts == null) { throw "EventForwarder - submit_hosts is undefined" }
    if(this.config.submit_uri == null) { throw "EventForwarder - submit_uri is undefined" }

    var hosts = this.config.submit_hosts
    var submitUrls = []
    for (var i = 0; i < hosts.length; i++) {
      var host = hosts[i]
      var submitUrl = host + this.config.submit_uri
      submitUrls.push(submitUrl)
    }
    self.submit_urls = submitUrls

    this.handleDevUpdates = function (vDev) {
        self.updateState(vDev);
    };

    this.handleDevCreation = function(vDev) {
        self.createDevice(vDev);
    };

    this.handleDevDeletion = function(vDev) {
        self.deleteDevice(vDev);
    };

    // Determine current configured devices
    self.controller.devices.each(self.handleDevCreation);

    // self.controller.devices.onAny(function (value, value2, value3) {
    //   console.log("Device event:", this.event, "obj:", JSON.stringify(value), "v2:", value2, "v3:", value3)
    // })
    //
    // self.controller.onAny(function (value, value2) {
    //   console.log("Controller event:", this.event, value, value2)
    // })

    // Setup event listeners

    // to pickup title changes
    self.controller.devices.on('change:metrics:title', self.handleDevUpdates); 
    // to pickup value updates
    self.controller.devices.on('change:metrics:level', self.handleDevUpdates); 
    // to pick up creation events
    self.controller.devices.on('created', self.handleDevCreation);
    // to pick up deletion events
    self.controller.devices.on('removed', self.handleDevDeletion);

    // var callback = function(type,arg) {
    //   console.log('### here I am ###', arguments.length, "type:", type, "arg:", arg)
    // };
    //
    // zway.data.bind(callback);
    //
    // for (var dv in zway.devices) {
    //   var dv = zway.devices[dv];
    //   console.log("STUFF: ", JSON.stringify(dv))
    //   dv.data.bind(callback, null, true);
    // }
};

EventForwarder.prototype.stop = function () {
    var self = this;

    // Remove event listeners
    self.controller.devices.off('change:metrics:level', self.handleDevUpdates);
    self.controller.devices.off('created', self.handleDevCreation);

    EventForwarder.super_.prototype.stop.call(this);
};

// ----------------------------------------------------------------------------
// --- Module methods
// ----------------------------------------------------------------------------

EventForwarder.prototype.updateState = function(vDev) {
    var self = this;

    var zwayIds = self.parseZWayId(vDev.id)
    if(zwayIds == null) {
      console.error("EventForwarder: ERROR could not parse vDev.id ", vDev.id)
      return
    }

    // console.log("DEVICES", JSON.stringify(self.devices, null, 2))

    // if(!self.devices[vDev.id]) {
    //     debugPrint('EventForwarder: update: Unknown device ' + vDev.id);
    //     return;
    // }

    var nodeId = zwayIds.nodeId
    var instanceId = zwayIds.instanceId
    var cmdClass = zwayIds.cmdClass
    var sensorType = zwayIds.sensorType

    // log if missing data
    if(nodeId == null) {
      console.error("EventForwarder: ERROR could not parse node id from zwayId", vDev.id)
    }
    if(instanceId == null) {
      console.error("EventForwarder: ERROR could not parse instanceId from zwayId", vDev.id)
    }
    if(cmdClass == null) {
      console.error("EventForwarder: ERROR could not parse cmdClass from zwayId", vDev.id)
    }

    var zwayDevice = nodeId && global.zway.devices[nodeId]

    // attach a callback on failure event
    if(zwayDevice == null) {
      console.error("EventForwarder: ERROR could find zway device for nodeId", nodeId)
    }

    // determine the meter type

    // A bug in zway is causing multiple update events to be triggered for each update
    // if(self.devices[vDev.id].level !== vDev.get('metrics:level')) {
    //     self.devices[vDev.id].level = vDev.get('metrics:level');

    var meterType = this.getMeterType(instanceId, cmdClass, sensorType, zwayDevice)
    var status = self.getDeviceStatus(nodeId)
    var value = self.cleanValue(vDev.get('metrics:level'))

    var devId = vDev.get('id'),
        devType = vDev.get('deviceType'),
        devProbeType = vDev.get('probeType'),
        devName = vDev.get('metrics:title'),
        scaleUnit = vDev.get('metrics:scaleTitle'),
        eventType = function(){
            if(vDev.get('metrics:probeTitle')){
                return vDev.get('metrics:probeTitle').toLowerCase();
            }else {
                return 'status';
            }
        }

    for (var i = 0; i < self.submit_urls.length; i++) {
      var url = self.submit_urls[i]
      var httpObj = {
          method: 'POST',
          async: true,
          url: url,
          headers: {
              'Content-Type': 'application/json'
          },
          data: JSON.stringify({
              protocol: "zwave",
              eventType: "update",
              status: status ? 'offline' : 'online',
              foreignDeviceId: nodeId ? "" + nodeId : null,
              instanceId: instanceId,
              cmdClass: cmdClass,
              meterType: meterType,
              sensorType: sensorType ? sensorType : undefined,
              vDevId: vDev.id,
              value: value != null ? "" + value : null,
              updateTime: vDev.get('updateTime'),

              scaleUnit: scaleUnit,
              deviceName: devName,
              probeType: devProbeType,
              deviceType: devType,
          })
      }
      console.log("EventForwarder: sending update event to", url)
      http.request(httpObj)
    }
};

EventForwarder.prototype.deleteDevice = function(vDev) {
    var self = this;

    var zwayIds = self.parseZWayId(vDev.id)
    if(zwayIds == null) {
      console.error("EventForwarder: ERROR could not parse vDev.id ", vDev.id)
      return
    }

    var nodeId = zwayIds.nodeId
    var instanceId = zwayIds.instanceId
    var cmdClass = zwayIds.cmdClass
    var sensorType = zwayIds.sensorType

    // log if missing data
    if(nodeId == null) {
      console.error("EventForwarder.deleteDevice: ERROR could not parse node id from zwayId", vDev.id)
    }
    if(instanceId == null) {
      console.error("EventForwarder.deleteDevice: ERROR could not parse instanceId from zwayId", vDev.id)
    }
    if(cmdClass == null) {
      console.error("EventForwarder.deleteDevice: ERROR could not parse cmdClass from zwayId", vDev.id)
    }

    var zwayDevice = nodeId && global.zway.devices[nodeId]
    if(zwayDevice == null) {
      console.error("EventForwarder.deleteDevice: ERROR could find zway device for nodeId", nodeId)
    }

    var meterType = this.getMeterType(instanceId, cmdClass, sensorType, zwayDevice)
    var value = self.cleanValue(vDev.get('metrics:level'))
    var devType = vDev.get('deviceType')
    var devName = vDev.get('metrics:title')

    for (var i = 0; i < self.submit_urls.length; i++) {
        var url = self.submit_urls[i]
        var httpObj = {
            method: 'POST',
            async: true,
            url: url,
            headers: {
                'Content-Type': 'application/json'
            },
            data: JSON.stringify({
                protocol: "zwave",
                eventType: "delete",
                foreignDeviceId: nodeId != null ? "" + nodeId : null,
                instanceId: instanceId,
                cmdClass: cmdClass,
                meterType: meterType,
                sensorType: sensorType ? sensorType : undefined,
                vDevId: vDev.id,
                updateTime: vDev.get('updateTime'),
                deviceType: devType,
                deviceName: devName
            })
        }
        console.log("EventForwarder: sending delete event to", url)
        http.request(httpObj);
    }
};


EventForwarder.prototype.createDevice = function(vDev) {
    var self = this;

    var zwayIds = self.parseZWayId(vDev.id)
    if(zwayIds == null) {
      console.error("EventForwarder: ERROR could not parse vDev.id ", vDev.id)
      return
    }

    var nodeId = zwayIds.nodeId
    var instanceId = zwayIds.instanceId
    var cmdClass = zwayIds.cmdClass
    var sensorType = zwayIds.sensorType

    // log if missing data
    if(nodeId == null) {
      console.error("EventForwarder: ERROR could not parse node id from zwayId", vDev.id)
    }
    if(instanceId == null) {
      console.error("EventForwarder: ERROR could not parse instanceId from zwayId", vDev.id)
    }
    if(cmdClass == null) {
      console.error("EventForwarder: ERROR could not parse cmdClass from zwayId", vDev.id)
    }

    var zwayDevice = nodeId && global.zway.devices[nodeId]

    // attach a callback on failure event
    if(zwayDevice == null) {
      console.error("EventForwarder: ERROR could find zway device for nodeId", nodeId)
    } else {

      if(zwayDevice.data == null) {
        console.error("EventForwarder: ERROR device with nodeId", nodeId, "has no data")
      } else {
        global.zway.devices[nodeId].data.isFailed.bind(self.updateStatus, self.submit_urls, nodeId);
      }

    }

    // determine the meter type
    var meterType = this.getMeterType(instanceId, cmdClass, sensorType, zwayDevice)
    var value = self.cleanValue(vDev.get('metrics:level'))
    var devType = vDev.get('deviceType')
    var devName = vDev.get('metrics:title')

    for (var i = 0; i < self.submit_urls.length; i++) {
      var url = self.submit_urls[i]
      var httpObj = {
          method: 'POST',
          async: true,
          url: url,
          headers: {
              'Content-Type': 'application/json'
          },
          data: JSON.stringify({
              protocol: "zwave",
              eventType: "create",
              status: self.getDeviceStatus(nodeId) ? 'offline' : 'online',
              foreignDeviceId: nodeId != null ? "" + nodeId : null,
              instanceId: instanceId,
              cmdClass: cmdClass,
              meterType: meterType,
              sensorType: sensorType ? sensorType : undefined,
              vDevId: vDev.id,
              value: value != null ? "" + value : null,
              updateTime: vDev.get('updateTime'),
              deviceType: devType,
              deviceName: devName
          })
      }
      console.log("EventForwarder: sending create event to", url)
      http.request(httpObj)
    }
};

EventForwarder.prototype.updateStatus = function(unknown, submit_urls, nodeId) {
    var self = this;

    console.log("EventForwarder: update status:", JSON.stringify(self))

    for (var i = 0; i < submit_urls.length; i++) {
      var url = submit_urls[i]
      var httpObj = {
          method: 'POST',
          async: true,
          url: url,
          headers: {
              'Content-Type': 'application/json'
          },
          data: JSON.stringify({
              protocol: "zwave",
              eventType: "status_update",
              status: self.value ? 'offline' : 'online',
              foreignDeviceId: "" + parseInt(nodeId, 10),
              updateTime: self.updateTime
          })
      }
      console.log("EventForwarder: sending status update event to", url)
      http.request(httpObj)

    }

}

EventForwarder.prototype.getMeterType = function(instanceId, cmdClass, sensorType, zwayDevice) {
  var meterType = null

  if(instanceId == null) return null
  if(cmdClass == null) return null
  if(sensorType == null) return null
  if(zwayDevice == null) return null

  if(cmdClass == 0x32) {

    var zwayDeviceInstance = zwayDevice.instances[instanceId]
    if(zwayDeviceInstance == null) {
      console.error("EventForwarder: ERROR device with nodeId", nodeId, "has no instance")
    } else {
      meterType = zwayDeviceInstance.commandClasses[cmdClass].data[sensorType].sensorType.value
    }

  }

  return meterType
}

EventForwarder.prototype.parseZWayId = function(zwayId) {
  if(zwayId == null) return null

  var result = { nodeId: null, instanceId:null, cmdClass: null, sensorType:null }
  var indexOfUnderscore = zwayId.lastIndexOf('_')

  // check that undercore exists
  if(indexOfUnderscore < 0) return {}
  var unparsedData = zwayId.substring(zwayId.lastIndexOf('_') + 1)
  var splitResult = unparsedData.split('-')

  result.nodeId = parseInt(splitResult[0], 10)
  result.instanceId = parseInt(splitResult[1], 10)
  result.cmdClass = parseInt(splitResult[2], 10)
  result.sensorType = splitResult[3]
  return result
}

EventForwarder.prototype.getDeviceStatus = function(deviceId) {
  if(deviceId == null) return null

  var device = global.zway.devices[deviceId]
  if(device == null) return null

  var data = device.data
  if(data == null) return null

  var isFailed = data.isFailed
  if(isFailed == null) return null

  return isFailed.value
}

EventForwarder.prototype.cleanValue = function(value) {
  if(value === "off") return 0
  else if(value === "on") return 255
  else return value
}
