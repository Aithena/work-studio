import { createApp } from 'vue'
import App from './App.vue'
import { applyAccent, readAccent } from './composables/useAccent'
import './styles/tokens.less'
import './styles/base.less'
import './styles/element.less'
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/message-box/style/css'
import 'element-plus/es/components/notification/style/css'
import 'element-plus/es/components/dialog/style/css'

applyAccent(readAccent())

createApp(App).mount('#app')
