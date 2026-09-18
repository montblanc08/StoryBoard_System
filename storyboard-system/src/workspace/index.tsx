import { createRoot } from 'react-dom/client';
import { UIProvider } from '@frameforge/ui';
import { WorkspaceToolbar } from './toolbar';
import { Sidebar } from './sidebar';
import { publish } from './store';
import type { Snapshot, WorkspaceBridge } from './contracts';

const workspaceUI={
  ready:false,
  bridge:null as WorkspaceBridge|null,
  sidebarMounted:false,
  mount(bridge:WorkspaceBridge){
    if(this.ready)return;
    const toolbar=document.querySelector('.workspace-toolbar');const sidebar=document.querySelector('#appSidebar');
    if(!toolbar||!sidebar)return;
    this.bridge=bridge;
    const toolbarRoot=document.createElement('div');toolbarRoot.id='workspaceToolbarV73';toolbarRoot.className='ff73-toolbar-root';
    // The compatibility nodes keep existing command handlers alive during migration.
    // They are not a second UI and cannot receive focus.
    toolbar.querySelectorAll<HTMLElement>(':scope > .toolbar-left, :scope > .toolbar-right').forEach(node=>{node.hidden=true;node.inert=true;});
    toolbar.prepend(toolbarRoot);
    createRoot(toolbarRoot).render(<UIProvider><WorkspaceToolbar bridge={bridge}/></UIProvider>);
    document.body.dataset.uiVersion='7.3';this.ready=true;
    this.syncSidebar(false);
  },
  /**
   * R6：Layout 层按顶层 App Context 直接分支，而不是在同一个 Sidebar 里隐藏模块。
   *   PROJECT_HUB      → 不渲染 Workspace Sidebar，整块侧栏容器从布局移除（真实卸载，非 CSS 伪装）
   *   PROJECT_SELECTED → 挂载完整 Workspace Sidebar，模块顺序保持稳定
   */
  syncSidebar(show:boolean){
    const sidebar=document.querySelector<HTMLElement>('#appSidebar');
    if(!sidebar||!this.bridge)return;
    // 以真实 DOM 是否挂载为准，而不是标志位 —— 否则首次 Hub 态
    // （false === false）会被短路掉，导致侧栏从未被隐藏。
    const isMounted=!!sidebar.querySelector('#workspaceSidebarV73');
    if(show===isMounted){
      sidebar.hidden=!show;                       // 幂等校正，保证占位状态正确
      document.body.dataset.appContext=show?'project':'hub';
      this.sidebarMounted=show;
      return;
    }
    if(show){
      const root=document.createElement('div');root.id='workspaceSidebarV73';
      sidebar.replaceChildren(root);
      createRoot(root).render(<UIProvider><Sidebar bridge={this.bridge}/></UIProvider>);
      sidebar.hidden=false;
    }else{
      // 卸载 React 树并移除布局占位，避免出现空白 Sidebar
      sidebar.replaceChildren();
      sidebar.hidden=true;
    }
    this.sidebarMounted=show;
    document.body.dataset.appContext=show?'project':'hub';
  },
  update(snapshot:Snapshot){
    document.body.dataset.shotWorkspace=String(['table','cards','wall','timeline'].includes(snapshot.view)&&snapshot.context==='project');
    this.syncSidebar(snapshot.context==='project');
    publish(snapshot);
  }
};
Object.assign(globalThis,{FrameForgeUI:workspaceUI});
