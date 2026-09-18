import { useSyncExternalStore } from 'react';
import type { Snapshot } from './contracts';
let snapshot:Snapshot={projectId:'',context:'hub',view:'table',search:'',total:0,filtered:0,inspectorOpen:false,columns:[],columnOrder:[],filters:[],navigation:[],sidebarPrefs:{hidden:[],labels:{}},rowHeight:'standard',effects:'full'};
const listeners=new Set<()=>void>();
export function publish(next:Snapshot){snapshot=next;listeners.forEach(listener=>listener());}
export function useWorkspace(){return useSyncExternalStore(listener=>{listeners.add(listener);return()=>listeners.delete(listener);},()=>snapshot);}
