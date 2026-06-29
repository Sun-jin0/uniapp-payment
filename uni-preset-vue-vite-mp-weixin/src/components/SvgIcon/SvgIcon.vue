<template>
  <view class="svg-icon" :style="iconStyle">
    <!-- #ifdef H5 -->
    <span v-html="svgContent"></span>
    <!-- #endif -->
    <!-- #ifdef MP-WEIXIN -->
    <image v-if="iconUrl" :src="iconUrl" mode="aspectFit" style="width: 100%; height: 100%;" />
    <!-- #endif -->
  </view>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  name: {
    type: String,
    required: true
  },
  size: {
    type: [Number, String],
    default: 36
  },
  fill: {
    type: String,
    default: '#333'
  },
  strokeWidth: {
    type: [Number, String],
    default: 3
  }
});

const iconStyle = computed(() => {
  let size = props.size;
  if (!isNaN(size) && size !== '') {
    size = `${size}rpx`;
  }
  return {
    width: size,
    height: size,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
  };
});

// 预定义 SVG 图标 (H5 使用)
const icons = {
  'more': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="12" r="3" fill="currentColor"/><circle cx="24" cy="24" r="3" fill="currentColor"/><circle cx="24" cy="36" r="3" fill="currentColor"/></svg>`,
  'settings': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M36.686 15.171C37.9364 16.9643 38.8163 19.0352 39.2147 21.2727H44V26.7273H39.2147C38.8163 28.9648 37.9364 31.0357 36.686 32.829L40.0706 36.2137L36.2137 40.0706L32.829 36.686C31.0357 37.9364 28.9648 38.8163 26.7273 39.2147V44H21.2727V39.2147C19.0352 38.8163 16.9643 37.9364 15.171 36.686L11.7863 40.0706L7.92939 36.2137L11.314 32.829C10.0636 31.0357 9.18372 28.9648 8.78533 26.7273H4V21.2727H8.78533C9.18372 19.0352 10.0636 16.9643 11.314 15.171L7.92939 11.7863L11.7863 7.92939L15.171 11.314C16.9643 10.0636 19.0352 9.18372 21.2727 8.78533V4H26.7273V8.78533C28.9648 9.18372 31.0357 10.0636 32.829 11.314L36.2137 7.92939L40.0706 11.7863L36.686 15.171Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="miter"/><path d="M24 29C26.7614 29 29 26.7614 29 24C29 21.2386 26.7614 19 24 19C21.2386 19 19 21.2386 19 24C19 26.7614 21.2386 29 24 29Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="miter"/></svg>`,
  'back': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M31 36L19 24L31 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="miter"/></svg>`,
  'home': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 18V42H39V18L24 6L9 18Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="miter"/><path d="M19 29V42H29V29H19Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="miter"/><path d="M9 42H39" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  'feedback': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M44 6H4V36H13V41L23 36H44V6Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 19H34" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 27H24" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'correct': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24 44C29.5228 44 34.5228 41.7614 38.1421 38.1421C41.7614 34.5228 44 29.5228 44 24C44 18.4772 41.7614 13.4772 38.1421 9.85786C34.5228 6.23858 29.5228 4 24 4C18.4772 4 13.4772 6.23858 9.85786 9.85786C6.23858 13.4772 4 18.4772 4 24C4 29.5228 6.23858 34.5228 9.85786 38.1421C13.4772 41.7614 18.4772 44 24 44Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="miter"/><path d="M16 24L22 30L34 18" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="miter"/></svg>`,
  'error': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24 44C35.0457 44 44 35.0457 44 24C44 12.9543 35.0457 4 24 4C12.9543 4 4 12.9543 4 24C4 35.0457 12.9543 44 24 44Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="miter"/><path d="M29.6567 18.3432L18.343 29.6569" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="miter"/><path d="M18.3433 18.3432L29.657 29.6569" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="miter"/></svg>`,
  'like': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M27.6002 18.5998V11.3998C27.6002 8.41743 25.1826 5.99977 22.2002 5.99977L15.0002 22.1998V41.9998H35.9162C37.7113 42.0201 39.2471 40.7147 39.5162 38.9398L42.0002 22.7398C42.1587 21.6955 41.8506 20.6343 41.1576 19.8373C40.4645 19.0403 39.4564 18.5878 38.4002 18.5998H27.6002Z" stroke="currentColor" stroke-width="3" stroke-linejoin="miter"/><path d="M15 22.0001H10.194C8.08532 21.9628 6.2827 23.7095 6 25.7994V38.3994C6.2827 40.4894 8.08532 42.0367 10.194 41.9994H15V22.0001Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="miter"/></svg>`,
  'like-fill': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M27.6002 18.5998V11.3998C27.6002 8.41743 25.1826 5.99977 22.2002 5.99977L15.0002 22.1998V41.9998H35.9162C37.7113 42.0201 39.2471 40.7147 39.5162 38.9398L42.0002 22.7398C42.1587 21.6955 41.8506 20.6343 41.1576 19.8373C40.4645 19.0403 39.4564 18.5878 38.4002 18.5998H27.6002Z" fill="currentColor" stroke="currentColor" stroke-width="3" stroke-linejoin="miter"/><path d="M15 22.0001H10.194C8.08532 21.9628 6.2827 23.7095 6 25.7994V38.3994C6.2827 40.4894 8.08532 42.0367 10.194 41.9994H15V22.0001Z" fill="currentColor" stroke="currentColor" stroke-width="3" stroke-linejoin="miter"/></svg>`,
  'star': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M23.9986 5L31.1074 18.368L45.9986 20.941L35.4986 31.632L37.6986 46.5L23.9986 39.734L10.2986 46.5L12.4986 31.632L1.99857 20.941L16.8897 18.368L23.9986 5Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/></svg>`,
  'star-fill': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M23.9986 5L31.1074 18.368L45.9986 20.941L35.4986 31.632L37.6986 46.5L23.9986 39.734L10.2986 46.5L12.4986 31.632L1.99857 20.941L16.8897 18.368L23.9986 5Z" fill="currentColor" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/></svg>`,
  'time': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24 44C35.0457 44 44 35.0457 44 24C44 12.9543 35.0457 4 24 4C12.9543 4 4 12.9543 4 24C4 35.0457 12.9543 44 24 44Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M24.0083 12V24L32.0083 32" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'calendar': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="8" width="40" height="36" rx="2" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M4 20H44" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 4V12" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 4V12" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 30L22 35L31 25" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'computer': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="6" width="40" height="28" rx="2" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M24 34V42" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 42H36" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'math': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M38 14L10 42" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M38 42L10 14" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 10V4" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 10V4" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M42 16H4" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M42 32H4" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'flag': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 44V4" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 6H40L35 15L40 24H8" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/></svg>`,
  'books': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 40C8 36 8 10 8 6C8 4.89543 8.89543 4 10 4H40V44H10C8.89543 44 8 43.1046 8 42V40Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M12 40H40" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 12H32" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 20H32" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'brain': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24 42C14.0589 42 6 33.9411 6 24C6 14.0589 14.0589 6 24 6C33.9411 6 42 14.0589 42 24C42 33.9411 33.9411 42 24 42Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M24 6V42" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 24H42" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'edit': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 42H41" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 26.7199V34H18.3172L39 13.3081L31.6951 6L11 26.7199Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/></svg>`,
  'trophy': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 16C10 16 10 22 10 24C10 26 11 28 12 30C13 32 15 34 18 35V40H14V44H34V40H30V35C33 34 35 32 36 30C37 28 38 26 38 24C38 22 38 16 38 16" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 16H38" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 16V22C10 22 4 22 4 16V10H10V16Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M38 16V22C38 22 44 22 44 16V10H38V16Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/></svg>`,
  'book-one': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 6C8 4.89543 8.89543 4 10 4H40V44H10C8.89543 44 8 43.1046 8 42V6Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M12 40H40" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 12H32" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 20H32" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 4V12L28 9L24 12V4" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'graduation-cap': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 18L24 8L44 18L24 28L44 18Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M8 22V32C8 32 16 38 24 38C32 38 40 32 40 32V22" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M44 18V30" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'sun': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24 34C29.5228 34 34 29.5228 34 24C34 18.4772 29.5228 14 24 14C18.4772 14 14 18.4772 14 24C14 29.5228 18.4772 34 24 34Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M24 4V10" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 38V44" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M38.1421 9.85791L33.8995 14.1005" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M14.1005 33.8995L9.85791 38.1422" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M44 24H38" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 24H4" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M38.1421 38.1422L33.8995 33.8995" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M14.1005 14.1005L9.85791 9.85791" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'moon': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M30 4C30 4 21.3333 4 14.6667 10.6667C8 17.3333 8 26 14.6667 32.6667C21.3333 39.3333 30 39.3333 36.6667 32.6667C43.3333 26 43.3333 17.3333 36.6667 10.6667C34 8 30 4 30 4Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M30 4C30 4 34.6667 10.6667 34.6667 17.3333C34.6667 24 30 30.6667 24 30.6667C18 30.6667 13.3333 26 13.3333 17.3333C13.3333 10.6667 18 4 18 4" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'folder': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 9V41C4 42.1046 4.89543 43 6 43H42C43.1046 43 44 42.1046 44 41V17C44 15.8954 43.1046 15 42 15H24L19 9H6C4.89543 9 4 9.89543 4 11V9Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/></svg>`,
  'warning': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24 5L2 43H46L24 5Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M24 35V36" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 19V31" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'dot': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="20" fill="currentColor"/></svg>`,
  'plus': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24 10V38" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 24H38" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'close': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 8L40 40" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 40L40 8" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'left': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M31 36L19 24L31 12" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'right': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19 12L31 24L19 36" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'menu': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.94971 11.9497H39.9497" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.94971 23.9497H39.9497" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.94971 35.9497H39.9497" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'lock': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="22" width="36" height="22" rx="2" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M14 22V14C14 8.47715 18.4772 4 24 4C29.5228 4 34 8.47715 34 14V22" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 30V36" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'fire': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M28 4C28 4 21 8 16 16C11 24 16 34 16 34C16 34 14 31 14 27C14 23 16 20 16 20C16 20 10 24 8 32C6 40 14 44 24 44C34 44 42 38 42 28C42 18 34 14 28 4Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M24 44C24 44 32 40 32 30C32 20 24 16 24 16C24 16 20 20 20 26C20 32 24 36 24 36C24 36 22 34 22 30C22 26 24 24 24 24" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'answer-sheet': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6H8C6.89543 6 6 6.89543 6 8V18C6 19.1046 6.89543 20 8 20H18C19.1046 20 20 19.1046 20 18V8C20 6.89543 19.1046 6 18 6Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="miter"/><path d="M18 28H8C6.89543 28 6 28.8954 6 30V40C6 41.1046 6.89543 42 8 42H18C19.1046 42 20 41.1046 20 40V30C20 28.8954 19.1046 28 18 28Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="miter"/><path d="M40 6H30C28.8954 6 28 6.89543 28 8V18C28 19.1046 28.89543 20 30 20H40C41.1046 20 42 19.1046 42 18V8C42 6.89543 41.1046 6 40 6Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="miter"/><path d="M40 28H30C28.89543 28 28 28.8954 28 30V40C28 41.1046 28.89543 42 30 42H40C41.1046 42 42 41.1046 42 40V30C42 28.8954 41.1046 28 40 28Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="miter"/></svg>`,
  'delete': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 10V44H39V10H9Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="miter"/><path d="M20 20V33" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="miter"/><path d="M28 20V33" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="miter"/><path d="M4 10H44" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="miter"/><path d="M16 10L19.289 4H28.7771L32 10H16Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="miter"/></svg>`,
  'chart': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 36V42H12" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M42 12V6H36" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 36L36 12" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'arrow-right': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19 12L31 24L19 36" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'ranking': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 22V44H34V22" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 44H44" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 4L24 22" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 14L14 22H34L38 14" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'sort': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 14L24 30L40 14" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 34L24 18L40 34" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'help': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24 44C35.0457 44 44 35.0457 44 24C44 12.9543 35.0457 4 24 4C12.9543 4 4 12.9543 4 24C4 35.0457 12.9543 44 24 44Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M24 34V36" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 14C18.9543 14 15 17.9543 15 23H19C19 19.9543 21.2386 18 24 18C26.7614 18 29 20.2386 29 23C29 25.7614 26.7614 28 24 28C21.2386 28 19 25.7614 19 23" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'empty': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24 44C35.0457 44 44 35.0457 44 24C44 12.9543 35.0457 4 24 4C12.9543 4 4 12.9543 4 24C4 35.0457 12.9543 44 24 44Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M16 16L32 32" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 16L16 32" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'user': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24 4C29.5228 4 34 8.47715 34 14C34 19.5228 29.5228 24 24 24C18.4772 24 14 19.5228 14 14C14 8.47715 18.4772 4 24 4Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M6 44C6 35.1634 13.1634 28 22 28H26C34.8366 28 42 35.1634 42 44" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'edit-pen': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 42H41" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 26.7199V34H18.3172L39 13.3081L31.6951 6L11 26.7199Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M28 6L39 17" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'shield': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24 4L4 14V24C4 35.0457 12.9543 44 24 44C35.0457 44 44 35.0457 44 24V14L24 4Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M24 28C26.7614 28 29 25.7614 29 23C29 20.2386 26.7614 18 24 18C21.2386 18 19 20.2386 19 23C19 25.7614 21.2386 28 24 28Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/></svg>`,
  'refresh': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M42 24C42 33.9411 33.9411 42 24 42C14.0589 42 6 33.9411 6 24C6 14.0589 14.0589 6 24 6C28.5228 6 32.7228 7.64286 36 10.5" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M36 4V10.5H42.5" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'book-open': `<svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 12V40H24V12H4Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M44 12V40H24V12H44Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M24 12V40" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 20H20" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M28 20H40" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

// 微信小程序使用 iconify CDN 链接（支持自定义颜色）
const iconifyIcons = {
  'more': 'https://api.iconify.design/mdi:dots-vertical.svg',
  'settings': 'https://api.iconify.design/mdi:cog.svg',
  'back': 'https://api.iconify.design/mdi:arrow-left.svg',
  'home': 'https://api.iconify.design/mdi:home.svg',
  'feedback': 'https://api.iconify.design/mdi:message-text-outline.svg',
  'correct': 'https://api.iconify.design/mdi:check-circle-outline.svg',
  'error': 'https://api.iconify.design/mdi:close-circle-outline.svg',
  'like': 'https://api.iconify.design/mdi:thumb-up-outline.svg',
  'like-fill': 'https://api.iconify.design/mdi:thumb-up.svg',
  'star': 'https://api.iconify.design/mdi:star-outline.svg',
  'star-fill': 'https://api.iconify.design/mdi:star.svg',
  'time': 'https://api.iconify.design/mdi:clock-outline.svg',
  'calendar': 'https://api.iconify.design/mdi:calendar.svg',
  'computer': 'https://api.iconify.design/mdi:monitor.svg',
  'math': 'https://api.iconify.design/mdi:calculator.svg',
  'flag': 'https://api.iconify.design/mdi:flag.svg',
  'books': 'https://api.iconify.design/mdi:book-multiple.svg',
  'brain': 'https://api.iconify.design/mdi:brain.svg',
  'edit': 'https://api.iconify.design/mdi:pencil.svg',
  'trophy': 'https://api.iconify.design/mdi:trophy.svg',
  'book-one': 'https://api.iconify.design/mdi:book.svg',
  'graduation-cap': 'https://api.iconify.design/mdi:school.svg',
  'sun': 'https://api.iconify.design/mdi:white-balance-sunny.svg',
  'moon': 'https://api.iconify.design/mdi:moon-waning-crescent.svg',
  'folder': 'https://api.iconify.design/mdi:folder.svg',
  'warning': 'https://api.iconify.design/mdi:alert.svg',
  'dot': 'https://api.iconify.design/mdi:circle.svg',
  'plus': 'https://api.iconify.design/mdi:plus.svg',
  'close': 'https://api.iconify.design/mdi:close.svg',
  'left': 'https://api.iconify.design/mdi:chevron-left.svg',
  'right': 'https://api.iconify.design/mdi:chevron-right.svg',
  'menu': 'https://api.iconify.design/mdi:menu.svg',
  'lock': 'https://api.iconify.design/mdi:lock.svg',
  'fire': 'https://api.iconify.design/mdi:fire.svg',
  'answer-sheet': 'https://api.iconify.design/mdi:grid.svg',
  'delete': 'https://api.iconify.design/mdi:delete-outline.svg',
  'chart': 'https://api.iconify.design/mdi:trending-up.svg',
  'arrow-right': 'https://api.iconify.design/mdi:chevron-right.svg',
  'ranking': 'https://api.iconify.design/mdi:trophy-outline.svg',
  'sort': 'https://api.iconify.design/mdi:sort.svg',
  'help': 'https://api.iconify.design/mdi:help-circle-outline.svg',
  'empty': 'https://api.iconify.design/mdi:emoticon-sad-outline.svg',
  'user': 'https://api.iconify.design/mdi:account.svg',
  'edit-pen': 'https://api.iconify.design/mdi:pencil-outline.svg',
  'shield': 'https://api.iconify.design/mdi:shield-outline.svg',
  'refresh': 'https://api.iconify.design/mdi:refresh.svg',
  'book-open': 'https://api.iconify.design/mdi:book-open-page-variant.svg',
  'paint-brush': 'https://api.iconify.design/mdi:brush.svg',
  'diamond': 'https://api.iconify.design/mdi:diamond-stone.svg',
  'target': 'https://api.iconify.design/mdi:target.svg',
  'hundred': 'https://api.iconify.design/mdi:checkbox-marked-circle.svg',
  'people': 'https://api.iconify.design/mdi:account-group.svg',
  'clear': 'https://api.iconify.design/mdi:close-circle-outline.svg',
  'order': 'https://api.iconify.design/mdi:sort-numeric-ascending.svg',
  'wrong': 'https://api.iconify.design/mdi:close-circle.svg',
  'category': 'https://api.iconify.design/mdi:apps.svg',
  'play': 'https://api.iconify.design/mdi:play-circle.svg',
  'note': 'https://api.iconify.design/mdi:notebook-outline.svg',
  'eye': 'https://api.iconify.design/mdi:eye.svg',
  'eye-close': 'https://api.iconify.design/mdi:eye-off.svg',
};

// H5 平台使用 SVG 内容
const svgContent = computed(() => {
  const icon = icons[props.name];
  if (!icon) return '';
  return icon.replace(/currentColor/g, props.fill);
});

// 微信小程序使用 iconify CDN 链接（支持自定义颜色）
const iconUrl = computed(() => {
  const baseUrl = iconifyIcons[props.name];
  if (!baseUrl) return '';
  
  // 将颜色转换为 URL 编码格式
  const color = props.fill || '#333333';
  const encodedColor = encodeURIComponent(color);
  
  // 添加颜色参数
  return `${baseUrl}?color=${encodedColor}`;
});
</script>

<style scoped>
.svg-icon {
  display: inline-block;
  vertical-align: middle;
}
</style>
