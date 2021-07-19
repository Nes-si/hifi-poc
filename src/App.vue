<template>
  <div id="app">
    <div class="panel">
      <div class="panel-element"><b>My ID:</b> {{userId}}</div>
      <button
        class="panel-element"
        :disabled="connectBtnDisabled"
        @click="onConnectBtnClick"
      >
        {{connectBtnLabel}}
      </button>
      <div class="panel-element"><b>Status:</b> {{stateLabel}}</div>
    </div>

    <div class="panel">
      <div class="panel-element audio-selector">
        <label>
          <b>Audio Input Devices:</b>
          <select
            v-model="inputDevice"
            :disabled="!inputDevices.length"
            class="selector"
            @change="onConstraintsChange"
          >
            <option disabled value="">Choose device</option>
            <option v-for="device in inputDevices" :key="device.id" :value="device">
              {{device.label}}
            </option>
          </select>
        </label>
      </div>
      <div class="panel-element audio-selector">
        <label>
          <b>Audio Output Devices:</b>
          <select
            v-model="outputDevice"
            :disabled="!outputDevices.length"
            class="selector"
            @change="onOutputChange"
          >
            <option disabled value="">Choose device</option>
            <option v-for="device in outputDevices" :key="device.id" :value="device">
              {{device.label}}
            </option>
          </select>
        </label>
      </div>
    </div>

    <div class="panel">
      <div class="panel-element">
        <label>
          <input type="checkbox" v-model="echoCancellation" @change="onConstraintsChange">
          Echo Cancellation
        </label>
      </div>
      <div class="panel-element">
        <label>
          <input type="checkbox" v-model="noiseSuppression" @change="onConstraintsChange">
          Noise Suppression
        </label>
      </div>
      <div class="panel-element">
        <label>
          <input type="checkbox" v-model="autoGainControl" @change="onConstraintsChange">
          Automatic Gain Control
        </label>
      </div>

      <div class="panel-element panel-element-much-margin">
        <label>
          Gain:
          <input type="number" v-model.number="gain" style="width: 50px">
        </label>
      </div>
      <div class="panel-element">
        <button
          class="panel-element"
          @click="setGain"
        >
          Set gain
        </button>
      </div>

      <div class="panel-element panel-element-much-margin">
        <label>
          Threshold:
          <input type="number" v-model.number="threshold" style="width: 50px">
        </label>
      </div>
      <div class="panel-element">
        <button
          class="panel-element"
          @click="setThreshold"
        >
          Set threshold
        </button>
      </div>
    </div>

    <div v-if="usersLoaded" class="inner">
      <h3>Users:</h3>
      <div class="users">
        <div
          v-for="user in users"
          :key="user.providedUserID"
          class="user"
          :class="{'user-current': user.providedUserID == userId}"
        >
          <p><b>User:</b> {{user.providedUserID}}</p>
          <p><b>Position:</b> {{user.position ? `${user.position.x} ${user.position.z}` : `undefined`}}</p>
          <p><b>Orientation:</b> {{user.orientationEuler ? Math.round(user.orientationEuler.yawDegrees) : 'undefined'}}°</p>
          <p><b>Color:</b> <span :style="{color: 'rgba(0, 0, 0, 0)', backgroundColor: user.color}">WWWWW</span></p>
          <p><b>Hi-Fi gain:</b> {{user.hiFiGain}}</p>
          <p><b>Level:</b> {{user.volumeDecibels}} dB</p>
        </div>
      </div>

      <h3>Workspace:</h3>
      <Workspace
        :userId="userId"
        :users="users"
        :hifiCommunicator="hifiCommunicator"
      />
    </div>

    <audio
      controls
      autoplay
      style="display: none"
      ref="outputAudioEl"
    >
    </audio>
  </div>
</template>

<script>
import Parse from 'parse';
import {HiFiAudioAPIData, HiFiCommunicator, Point3D, OrientationEuler3D, UserDataSubscription,
  AvailableUserDataSubscriptionComponents} from 'hifi-spatial-audio';
import {generateId, generateColor} from "@/utils";
import Workspace from './components/Workspace.vue';

export const DIVISOR = 100;



export default {
  name: 'App',

  components: {
    Workspace
  },

  data() {
    return {
      DIVISOR,

      userId: generateId(),
      users: [],
      usersLoaded: false,

      state: null,
      stateLabel: 'Stopped',

      connectBtnLabel: 'Connect',
      connectBtnDisabled: false,

      inputDevices: [],
      outputDevices: [],
      inputDevice: null,
      outputDevice: null,

      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,

      hifiAudioJWT: null,
      hifiCommunicator: null,

      gain: 1,
      threshold: -96
    }
  },

  methods: {
    async setupAudioIODropdowns() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        console.warn("Your browser does not support `enumerateDevices()`; audio input/output device selection is unavailable.");
        return;
      }

      // Just for get mic permissions
      try {
        await navigator.mediaDevices.getUserMedia({video: false, audio: true});
      } catch(err) {
        console.log("Can't get microphone permission:" + err);
        return;
      }

      // Some browsers require that the user interact with the DOM before `enumerateDevices()` can be called.
      // This code attempts to call `enumerateDevices()` immediately when the user navigates to the website.
      let ioDevices;
      try {
        ioDevices = await navigator.mediaDevices.enumerateDevices();
      } catch (e) {
        console.error(`Error in \`enumerateDevices()\`:\n${e}`);
        return;
      }

      ioDevices.forEach(device => {
        let {label, kind, deviceId} = device;
        if (!label)
          label = "Unknown Device";

        if (kind === "audioinput")
          this.inputDevices.push({label, kind, deviceId});
        else if (kind === "audiooutput")
          this.outputDevices.push({label, kind, deviceId});
      });
      this.inputDevice = this.inputDevices[0];
      this.outputDevice = this.outputDevices[0];
    },

    onConnectBtnClick() {
      if (!this.usersLoaded)
        this.connectToAudio();
      else
        this.disconnectAudio();
    },

    async setJWTtoken() {
      this.hifiAudioJWT = await Parse.Cloud.run("generateAudioJWT", {
        userID: this.userId,
        vulcanSpaceId: '6c3be7c3-f9a1-5144-173c-bc4acd66e03d',
        spaceName: 'Test'
      });
    },

    async getInputStream() {
      const constraints = {
        echoCancellation: this.echoCancellation,
        noiseSuppression: this.noiseSuppression,
        autoGainControl: this.autoGainControl
      };
      if (this.inputDevice)
        constraints.deviceId = {exact: this.inputDevice.deviceId};

      return await navigator.mediaDevices.getUserMedia({
        audio: constraints,
        video: false
      });
    },

    async connectToAudio() {
      this.stateLabel = 'Connecting...';
      this.connectBtnDisabled = true;

      if (!this.hifiAudioJWT) {
        try {
          await this.setJWTtoken();
        } catch (e) {
          console.error(`Error while generating audio JWT\n${e}`);
          this.stateLabel = 'Error while generating audio JWT!';
          this.connectBtnDisabled = false;
          this.connectBtnLabel = 'Waiting';
          return;
        }
      }

      // Set up the initial data for our user.
      // They'll be standing at the origin, facing "forward".
      const initialHiFiAudioAPIData = new HiFiAudioAPIData({
        position: new Point3D({x: 0, y: 0, z: 0}),
        orientationEuler: new OrientationEuler3D({pitchDegrees: 0, yawDegrees: 0, rollDegrees: 0})
      });

      // Set up our `HiFiCommunicator` object, supplying our media stream and initial user data.
      this.hifiCommunicator = new HiFiCommunicator({
        initialHiFiAudioAPIData,
        onConnectionStateChanged: this.onConnectionStateChanged,
        onUsersDisconnected: this.onUsersDisconnected
      });

      try {
        let stream = await this.getInputStream();
        await this.hifiCommunicator.setInputAudioMediaStream(stream);
      } catch (e) {
        console.error(`Error while set audio input stream\n${e}`);
        this.stateLabel = 'Error while set audio input stream!';
        this.connectBtnDisabled = false;
        this.connectBtnLabel = 'Waiting';
        return;
      }

      // Connect to the HiFi Audio API server!
      // Supply your own JWT here.
      let connectResponse;
      try {
        connectResponse = await this.hifiCommunicator.connectToHiFiAudioAPIServer(this.hifiAudioJWT);
      } catch (e) {
        console.error(`Error connecting to High Fidelity:\n${e}`);
        this.stateLabel = 'Error connecting to High Fidelity!';
        this.connectBtnDisabled = false;
        this.connectBtnLabel = 'Waiting';
        return;
      }

      this.stateLabel = 'Connected!';

      // This will get all Position and Orientation updates for all Users (including ourselves).
      let newUserDataSubscription = new UserDataSubscription({
        components: [
          AvailableUserDataSubscriptionComponents.Position,
          AvailableUserDataSubscriptionComponents.OrientationEuler,
          AvailableUserDataSubscriptionComponents.VolumeDecibels
        ],
        callback: this.onNewUserDataReceived
      });
      this.hifiCommunicator.addUserDataSubscription(newUserDataSubscription);

      this.$refs.outputAudioEl.setSinkId(this.outputDevice.deviceId);
      // Set the `srcObject` on our `audio` DOM element to the final, mixed audio stream from the High Fidelity Audio API Server.
      this.$refs.outputAudioEl.srcObject = this.hifiCommunicator.getOutputAudioMediaStream();
      // We explicitly call `play()` here because certain browsers won't play the newly-set stream automatically.
      this.$refs.outputAudioEl.play();
    },

    onConnectionStateChanged(state) {
      console.log(`New High Fidelity connection state: ${state}`);
      this.state = state;
    },

    async onConstraintsChange() {
      if (!this.hifiCommunicator)
        return;

      try {
        const stream = await this.getInputStream();
        await this.hifiCommunicator.setInputAudioMediaStream(stream);
      } catch (e) {
        console.error(`Error while set audio input stream\n${e}`);
      }
    },

    onOutputChange() {
      if (typeof this.$refs.outputAudioEl.sinkId !== 'undefined') {
        try {
          this.$refs.outputAudioEl.setSinkId(this.outputDevice.deviceId)
        } catch(error) {
          console.error(`Error when setting output device :\n${error}`);
        }
      } else {
        console.error(`Your browser does not support output device selection.`);
      }
    },

    async disconnectAudio() {
      this.stateLabel = 'Disconnecting...';
      this.connectBtnDisabled = true;
      this.$refs.outputAudioEl.pause();
      this.$refs.outputAudioEl.srcObject = null;

      await this.hifiCommunicator.disconnectFromHiFiAudioAPIServer();

      this.users = [];
      this.usersLoaded = false;
      this.stateLabel = 'Waiting';
      this.connectBtnLabel = 'Connect';
      this.connectBtnDisabled = false;
    },

    onNewUserDataReceived(_users) {
      //console.log(JSON.stringify(_users, null, 2));

      for (let _user of _users) {
        if (!_user.providedUserID && !_user.hashedVisitID)
          continue;

        const user = this.users.find(u =>
          _user.providedUserID === u.providedUserID || _user.hashedVisitID === u.hashedVisitID);

        if (user) {
          if (_user.position) {
            if (!user.position)
              user.position = new Point3D();
            user.position.x = _user.position.x;
            user.position.y = _user.position.y;
            user.position.z = _user.position.z;
          }

          if (_user.orientationEuler) {
            if (!user.orientationEuler)
              user.orientationEuler = new OrientationEuler3D();
            user.orientationEuler.pitchDegrees = _user.orientationEuler.pitchDegrees;
            user.orientationEuler.yawDegrees = _user.orientationEuler.yawDegrees;
            user.orientationEuler.rollDegrees = _user.orientationEuler.rollDegrees;
          }

          if (typeof (_user.volumeDecibels) === "number")
            user.volumeDecibels = _user.volumeDecibels;
          if (typeof (_user.hiFiGain) === "number")
            user.hiFiGain = _user.hiFiGain;

        } else {
          _user.color = generateColor(_user.providedUserID);
          this.users.push(_user);
        }
      }

      this.usersLoaded = true;
      this.connectBtnDisabled = false;
      this.connectBtnLabel = 'Disconnect';
    },

    onUsersDisconnected(usersDis) {
      this.users.reduceRight((acc, user, index, array) => {
        const userDis = usersDis.find(u =>
          user.providedUserID === u.providedUserID || user.hashedVisitID === u.hashedVisitID);
        if (userDis)
          array.splice(index, 1);
      }, []);
    },

    setGain() {
      if (this.hifiCommunicator)
        this.hifiCommunicator.updateUserDataAndTransmit({
          hiFiGain: this.gain
        });
    },
    setThreshold() {
      if (this.hifiCommunicator)
        this.hifiCommunicator.updateUserDataAndTransmit({
          volumeThreshold: this.threshold
        });
    }

  },

  async created() {
    this.setupAudioIODropdowns();
  }
}
</script>

<style>
p {
  margin-top: 6px;
  margin-bottom: 0px;
}

* {
  box-sizing: border-box;
}

#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;

  position: relative;
  display: flex;
  flex-direction: column;
  height: 100vh;
}

h3 {
  text-align: left;
  margin-top: 20px;
  margin-bottom: 10px;
}

.panel {
  display: flex;
  align-items: center;
  margin-top: 20px;
  margin-left: 20px;
  margin-right: 20px;
}

.panel-element {
  margin-left: 20px;
}
.panel-element:first-child {
  margin-left: 0;
}
.panel-element-much-margin {
  margin-left: 50px;
}

.audio-selector {
}

.selector {
  width: 100%;
  margin-top: 4px;
}


.inner {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0 20px 20px 20px;
}

.users {
  display: flex;
  flex-wrap: wrap;
}

.user {
  border: 1px solid black;
  margin-right: 10px;
  padding: 10px;
  text-align: center;
  width: 180px;
}

.user-current {
  background: #ffe9d5;
  order: -1;
}
</style>
