<template>
  <view class="rich-text-editor">
    <view class="toolbar" v-if="showToolbar">
      <view class="toolbar-item" @tap="format('bold')" :class="{ active: formats.bold }">
        <text class="toolbar-icon bold">B</text>
      </view>
      <view class="toolbar-item" @tap="format('italic')" :class="{ active: formats.italic }">
        <text class="toolbar-icon italic">I</text>
      </view>
      <view class="toolbar-item" @tap="format('underline')" :class="{ active: formats.underline }">
        <text class="toolbar-icon underline">U</text>
      </view>
      <view class="toolbar-divider"></view>
      <view class="toolbar-item" @tap="pickColor">
        <text class="toolbar-icon color" :style="{ color: formats.color || '#333' }">A</text>
      </view>
      <view class="toolbar-item" @tap="format('list', 'ordered')" :class="{ active: formats.list === 'ordered' }">
        <text class="toolbar-icon">1.</text>
      </view>
      <view class="toolbar-item" @tap="format('list', 'bullet')" :class="{ active: formats.list === 'bullet' }">
        <text class="toolbar-icon">•</text>
      </view>
      <view class="toolbar-divider"></view>
      <view class="toolbar-item" @tap="removeFormat">
        <text class="toolbar-icon">✖</text>
      </view>
    </view>
    <editor
      :id="editorId"
      class="editor-content"
      :placeholder="placeholder"
      @ready="onEditorReady"
      @statuschange="onStatusChange"
      @input="onEditorInput"
    ></editor>
  </view>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: '请输入内容...'
  },
  showToolbar: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['update:modelValue']);

const editorId = 'editor-' + Math.random().toString(36).slice(2, 9);
const formats = ref({});
const isReady = ref(false);
let editorCtx = null;

const onEditorReady = () => {
  uni.createSelectorQuery()
    .in(instance)
    .select(`#${editorId}`)
    .context((res) => {
      editorCtx = res.context;
      isReady.value = true;
      if (props.modelValue) {
        editorCtx.setContents({
          html: props.modelValue
        });
      }
    })
    .exec();
};

import { getCurrentInstance } from 'vue';
const instance = getCurrentInstance();

watch(() => props.modelValue, (newVal) => {
  if (isReady.value && editorCtx) {
    editorCtx.getContents({
      success: (res) => {
        if (res.html !== newVal) {
          editorCtx.setContents({
            html: newVal
          });
        }
      }
    });
  }
});

const onEditorInput = (e) => {
  emit('update:modelValue', e.detail.html);
};

const onStatusChange = (e) => {
  formats.value = e.detail;
};

const format = (name, value) => {
  if (!editorCtx) return;
  editorCtx.format(name, value);
};

const removeFormat = () => {
  if (!editorCtx) return;
  editorCtx.removeFormat();
};

const pickColor = () => {
  const colors = ['#000000', '#f44336', '#2196f3', '#4caf50', '#ffeb3b', '#9c27b0', '#ff9800', '#795548', '#ffffff'];
  uni.showActionSheet({
    itemList: ['黑色', '红色', '蓝色', '绿色', '黄色', '紫色', '橙色', '棕色', '白色'],
    success: (res) => {
      format('color', colors[res.tapIndex]);
    }
  });
};
</script>

<style scoped>
.rich-text-editor {
  width: 100%;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
  background-color: #fff;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  padding: 8px;
  background-color: #f5f5f5;
  border-bottom: 1px solid #eee;
  align-items: center;
}

.toolbar-item {
  height: 28px;
  min-width: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 1px;
  border-radius: 4px;
  cursor: pointer;
}

.toolbar-item.active {
  background-color: #e0e0e0;
}

.toolbar-icon {
  font-size: 14px;
  color: #333;
}

.toolbar-icon.bold { font-weight: bold; }
.toolbar-icon.italic { font-style: italic; }
.toolbar-icon.underline { text-decoration: underline; }

.toolbar-divider {
  width: 1px;
  height: 16px;
  background-color: #ddd;
  margin: 0 8px;
}

.editor-content {
  width: 100%;
  min-height: 150px;
  max-height: 400px;
  padding: 12px;
  box-sizing: border-box;
  font-size: 14px;
  line-height: 1.6;
}
</style>
