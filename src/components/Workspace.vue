<template>
  <div class="wrapper" ref="wrapper">
    <v-stage
      ref="stage"
      :config="stageConfig"
      @dragmove="onDragmove"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
    >
      <v-layer ref="layer">
        <v-group ref="group">
          <v-group
            v-for="user in otherUsers"
            :key="user.id"
            :config="{
              x: user.x,
              y: user.y,
              scaleX: user.scale,
              scaleY: user.scale,
              rotation: user.rotation
            }"
          >
            <v-circle
              :config="{
                x: 0,
                y: 0,
                radius: 20,
                fill: user.color,
                opacity: user.opacity,
                shadowColor: 'black',
                shadowBlur: 10,
                shadowOpacity: 0.6
              }"
            />
            <v-circle
              :config="{
                  x: 0,
                  y: -26,
                  radius: 8,
                  fill: 'red'
                }"
            />
          </v-group>

          <v-star
            :config="{
              id: userId,
              x: userData.x,
              y: userData.y,
              rotation: userData.rotation,
              numPoints: 5,
              innerRadius: 20,
              outerRadius: 35,
              fill: userData.color,
              opacity: .8,
              shadowColor: 'black',
              shadowBlur: 10,
              shadowOpacity: 0.6,

              shadowOffsetX: dragging ? 10 : 5,
              shadowOffsetY: dragging ? 10 : 5,
              scaleX: dragging ? userData.scale * 1.1 : userData.scale,
              scaleY: dragging ? userData.scale * 1.1 : userData.scale,
              draggable: true
            }"
            @mousedown="onDragStart"
          />
          <v-circle
            :config="{
              x: userData.x,
              y: userData.y,
              radius: 5,
              fill: 'red',
              rotation: userData.rotation,
              offset: {
                x: 0,
                y: 40 * (dragging ? userData.scale * 1.1 : userData.scale),
              }
            }"
            @mousedown="onRotationStart"
          />
        </v-group>

      </v-layer>
    </v-stage>
  </div>
</template>

<script>
import {OrientationEuler3D, Point3D} from 'hifi-spatial-audio';
import {DIVISOR} from '../App';
import {generateColor} from '@/utils';

const OFFSET = 100;

export default {
  name: "Workspace",
  props: {
    userId: String,
    users: Array,
    hifiCommunicator: Object
  },
  data() {
    return {
      OFFSET,

      dragging: false,
      rotating: false,
      rotatingStartX: 0,
      rotatingStartY: 0,
      userRotationStart: 0,

      rotatingX: 0,

      userData: {
        x: OFFSET,
        y: OFFSET,
        rotation: 0,
        opacity: .8,
        scale: 1,
        color: 'black'
      },
      userPosition: new Point3D({x: 0, y: 0, z: 0}),
      userOrientation: new OrientationEuler3D({pitch: 0, yaw: 0, roll: 0}),

      otherUsers: [],

      stageConfig: {
        width: 0,
        height: 0,
        draggable: false,
        scaleX: 1,
        scaleY: 1,
      }
    };
  },
  methods: {
    updateData() {
      const otherUsers = this.users.filter(u =>
        u.providedUserID != this.userId
      );
      this.otherUsers = otherUsers.map(u => {
        const volume = (Math.max(-50, u.volumeDecibels) + 50) / 50;
        const opacity = volume * .6 + .4;
        const scale = volume * .5 + .5;
        return {
          id: u.providedUserID,
          x: u.position ? u.position.x * DIVISOR + OFFSET : 0,
          y: u.position ? u.position.y * DIVISOR + OFFSET : 0,
          volume,
          opacity,
          rotation: u.orientationEuler ? u.orientationEuler.yawDegrees : 0,
          scale,
          color: generateColor(u.providedUserID),
        };
      });

      const user = this.users.find(u =>
        u.providedUserID == this.userId
      );
      if (!user)
        return;

      //this.userData.x = user.position ? user.position.x * DIVISOR + OFFSET : 0;
      //this.userData.y = user.position ? user.position.y * DIVISOR + OFFSET : 0;
      this.userData.volume = (Math.max(-50, user.volumeDecibels) + 50) / 50;
      this.userData.opacity = this.userData.volume * .6 + .4;
      this.userData.scale = this.userData.volume * .4 + .6;
      this.userData.color = generateColor(user.providedUserID);
    },

    onResize() {
      this.stageConfig.width = this.$refs.wrapper.clientWidth;
      this.stageConfig.height = this.$refs.wrapper.clientHeight;
    },

    onDragStart() {
      this.dragging = true;
    },
    onDragmove(e) {
      if (this.userData.x == e.target.attrs.x && this.userData.y == e.target.attrs.y)
        return;

      this.userData.x = e.target.attrs.x;
      this.userData.y = e.target.attrs.y;

      if (this.hifiCommunicator) {
        this.userPosition.x = (this.userData.x - OFFSET) / DIVISOR;
        this.userPosition.y = (this.userData.y - OFFSET) / DIVISOR;
        this.hifiCommunicator.updateUserDataAndTransmit({
          position: this.userPosition
        });
      }
    },

    onRotationStart(e) {
      this.rotating = true;
      this.rotatingStartX = e.evt.x;
      this.rotatingStartY = e.evt.y;
      this.userRotationStart = this.userData.rotation;
    },
    onMouseMove(e) {
      if (!this.rotating)
        return;

      let diff = e.evt.x - this.rotatingStartX;
      //diff += e.evt.y - this.rotatingStartY;
      this.userData.rotation = this.userRotationStart + diff;

      if (this.hifiCommunicator) {
        this.userOrientation.yawDegrees = this.userData.rotation;
        this.hifiCommunicator.updateUserDataAndTransmit({
          orientationEuler: this.userOrientation
        });
      }
    },

    onMouseUp() {
      this.dragging = false;
      this.rotating = false;
    },

    onWheel({evt}) {
      evt.preventDefault();
      if (evt.deltaY < 0) {
        this.stageConfig.scaleX *= 1.1;
        this.stageConfig.scaleY *= 1.1;
      } else if (evt.deltaY > 0) {
        this.stageConfig.scaleX /= 1.1;
        this.stageConfig.scaleY /= 1.1;
      }
    }
  },
  watch: {
    users: {
      handler() {
        this.updateData();
      },
      deep: true
    }
  },
  created() {
    this.updateData();
  },
  mounted() {
    this.$refs.stage.getNode().on('wheel', this.onWheel);
    this.onResize();
  }
};
</script>

<style scoped>
.wrapper {
  flex-grow: 1;
  width: 100%;
  border: 1px solid black;
}
</style>
