import type { Option } from '@frameforge/ui';
export type Column = {field:string; label:string; fixed:boolean; status:'visible'|'hidden'|'archived'};
export type NavigationItem = {key:string;view:string;group:string;label:string;icon:string};
export type Snapshot = {
  projectId:string; context:string; view:string; search:string; total:number; filtered:number;
  inspectorOpen:boolean; columns:Column[]; columnOrder:string[];
  filters:{key:string;label:string;value:string;options:Option[]}[];
  navigation:NavigationItem[]; sidebarPrefs:{hidden:string[];labels:Record<string,string>};
  rowHeight:string; effects:string; saveRefreshBusy?:boolean;
};
export interface WorkspaceBridge {
  navigate:(view:string)=>void;
  action:(name:string,anchor?:HTMLElement|null)=>void;
  search:(value:string)=>void;
  filter:(key:string,value:string)=>void;
  column:(field:string,action:'hide'|'show'|'remove'|'restore')=>void;
  reorderColumns:(ids:string[])=>void;
  sidebar:(prefs:Snapshot['sidebarPrefs'])=>void;
  preference:(key:'rowHeight'|'effects',value:string)=>void;
}
