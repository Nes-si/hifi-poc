<template>
  <div class="wrapper" ref="wrapper">
    <v-stage
      ref="stage"
      :config="stageConfig"
      @dragstart="onDragstart"
      @dragend="onDragend"
      @dragmove="onDragmove"
    >
      <v-layer ref="layer">
        <v-group ref="group">
          <v-circle
            v-for="user in otherUsers"
            :key="user.id"
            :config="{
              id: user.id,
              x: user.x,
              y: user.y,
              rotation: 0,
              radius: 20,
              fill: user.color,
              opacity: user.opacity,
              scaleX: user.scale,
              scaleY: user.scale,
              shadowColor: 'black',
              shadowBlur: 10,
              shadowOpacity: 0.6
            }"
          />
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

              shadowOffsetX: dragItemId === userId ? 10 : 5,
              shadowOffsetY: dragItemId === userId ? 10 : 5,
              scaleX: dragItemId === userId ? userData.scale * 1.1 : userData.scale,
              scaleY: dragItemId === userId ? userData.scale * 1.1 : userData.scale,
              draggable: true
            }"
          />
        </v-group>

      </v-layer>
    </v-stage>
  </div>
</template>

<script>
import {Point3D} from 'hifi-spatial-audio';
import {generateColor} from '@/utils';

const OFFSET = 100;
const DIVISOR = 100;

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

      dragItemId: null,

      userData: {
        x: OFFSET,
        y: OFFSET,
        rotation: 0,
        opacity: .8,
        scale: 1,
        color: 'black'
      },
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
        u.providedUserID != this.userId && u.position
      );
      this.otherUsers = otherUsers.map(u => {
        const volume = (Math.max(-50, u.volumeDecibels) + 50) / 50;
        const opacity = volume * .6 + .4;
        const scale = volume * .5 + .5;
        return {
          id: u.providedUserID,
          x: u.position.x * DIVISOR + OFFSET,
          y: u.position.y * DIVISOR + OFFSET,
          volume,
          opacity,
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
    onDragstart(e) {
      this.dragItemId = e.target.id();
    },
    onDragmove(e) {
      if (this.x != e.target.attrs.x || this.y != e.target.attrs.y) {
        this.x = e.target.attrs.x;
        this.y = e.target.attrs.y;

        if (this.hifiCommunicator) {
          const x = (this.x - OFFSET) / DIVISOR;
          const y = (this.y - OFFSET) / DIVISOR;
          this.hifiCommunicator.updateUserDataAndTransmit({
            position: new Point3D({x, y, z: 0})
          });
        }
      }
    },
    onDragend(e) {
      this.dragItemId = null;
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
