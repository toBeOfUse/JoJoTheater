<template>
    <div id="modal-bg" @click="$emit('bgClick')"></div>
    <div class="modal" :style="style" :id="id"><slot></slot></div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
    props: {
        style: {
            type: Object,
            required: false,
        },
        id: {
            type: String,
            required: false,
        },
    },
    emits: ["bgClick"],
});
</script>


<style lang="scss" scoped>
#modal-bg {
    position: fixed;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: #fff8;
    z-index: 1000;
}
.modal {
    position: fixed;
    width: 50%;
    top: 50px;
    left: 50%;
    transform: translateX(-50%);
    background-color: white;
    border-radius: 5px;
    border: 1px solid black;
    padding: 10px;
    overflow-y: auto;
    max-height: calc(100% - 100px);
    @media (max-width: 500px) {
        width: 95%;
    }
    z-index: 1001;
}
</style>
