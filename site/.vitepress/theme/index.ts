import DefaultTheme from 'vitepress/theme'
import Mermaid from './Mermaid.vue'
import GlossaryTerm from './GlossaryTerm.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('Mermaid', Mermaid)
    app.component('GlossaryTerm', GlossaryTerm)
  }
}
