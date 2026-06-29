import {
	createSSRApp
} from "vue";
import App from "./App.vue";
import api from "./api";

// 全局分享配置
const globalShareMixin = {
	// #ifdef MP-WEIXIN
	onLoad() {
		// 显示分享菜单
		uni.showShareMenu({
			withShareTicket: true,
			menus: ['shareAppMessage', 'shareTimeline']
		});
	},
	onShareAppMessage() {
		// 获取当前页面路径
		const pages = getCurrentPages();
		const currentPage = pages[pages.length - 1];
		const route = currentPage ? currentPage.route : '';
		const options = currentPage ? currentPage.options : {};
		
		// 构建分享路径
		let path = '/' + route;
		const params = Object.keys(options).map(key => `${key}=${options[key]}`).join('&');
		if (params) {
			path += '?' + params;
		}
		
		return {
			title: '考研刷题宝 - 计算机数学政治英语西医综合等海量真题',
			path: path || '/pages/index/index',
			imageUrl: '/static/logo.png' // 默认分享图片
		};
	},
	onShareTimeline() {
		// 获取当前页面路径
		const pages = getCurrentPages();
		const currentPage = pages[pages.length - 1];
		const route = currentPage ? currentPage.route : '';
		const options = currentPage ? currentPage.options : {};
		
		// 构建分享路径
		let path = '/' + route;
		const params = Object.keys(options).map(key => `${key}=${options[key]}`).join('&');
		if (params) {
			path += '?' + params;
		}
		
		return {
			title: '考研刷题宝 - 计算机数学政治英语西医综合等海量真题',
			query: params,
			imageUrl: '/static/logo.png' // 默认分享图片
		};
	}
	// #endif
};

export function createApp() {
	const app = createSSRApp(App);
	
	app.config.globalProperties.$api = api;
	
	// 全局混入分享功能
	app.mixin(globalShareMixin);
	
	return {
		app,
	};
}
