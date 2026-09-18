import { useState } from 'react';
import { Button, Field, Icons, Input, IconButton, Menu, Popover, Segmented, Select, SortableList } from '@frameforge/ui';
import type { WorkspaceBridge } from './contracts';
import { useWorkspace } from './store';

function Columns({bridge}: {bridge:WorkspaceBridge}) {
  const state=useWorkspace();const [query,setQuery]=useState('');const [scope,setScope]=useState('visible');
  const entries=state.columns.filter(item=>item.status===scope && item.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const sorted=entries.slice().sort((a,b)=>state.columnOrder.indexOf(a.field)-state.columnOrder.indexOf(b.field));
  const row=(entry:typeof entries[number])=><><span className="ff73-column-label">{entry.label}</span>{entry.fixed?<span className="ffui-muted">固定</span>:entry.status==='visible'?<>
    <IconButton label={`隐藏${entry.label}`} onClick={()=>bridge.column(entry.field,'hide')}><Icons.EyeOff size={14}/></IconButton>
    <IconButton label={`删除${entry.label}`} onClick={()=>bridge.column(entry.field,'remove')}><Icons.Trash2 size={14}/></IconButton>
  </>:<Button onClick={()=>bridge.column(entry.field,entry.status==='removed'?'restore':'show')}>恢复</Button>}</>;
  return <Popover label="列管理" trigger={<Button><Icons.Columns3 size={14}/><span>列</span></Button>} className="ff73-columns">
    <Input type="search" aria-label="搜索列" placeholder="搜索列…" value={query} onChange={e=>setQuery(e.target.value)}/>
    <Segmented label="列状态" value={scope} onChange={setScope} options={[['visible','显示'],['hidden','隐藏'],['removed','已删除']].map(([value,label])=>({value,label:`${label} ${state.columns.filter(c=>c.status===value).length}`}))}/>
    <div className="ff73-column-list">{!entries.length?<p className="ffui-empty">没有匹配的列</p>:scope==='visible'&&!query?<SortableList items={sorted.filter(e=>!e.fixed).map(e=>({...e,id:e.field}))} render={row} onReorder={ids=>bridge.reorderColumns(ids)}/>:entries.map(entry=><div className="ff73-column-row" key={entry.field}>{row(entry)}</div>)}</div>
    <p className="ffui-muted">隐藏和删除均保留已有数据，可在这里恢复。</p>
    <div className="ff73-inline"><Button onClick={()=>bridge.action('addColumn')}><Icons.Plus size={14}/>新增列</Button><Button onClick={()=>bridge.action('autoFit')}>自动列宽</Button><Button onClick={()=>bridge.action('resetColumns')}>重置列宽</Button></div>
  </Popover>;
}
export function WorkspaceToolbar({bridge}: {bridge:WorkspaceBridge}) {
  const state=useWorkspace();const [filterOpen,setFilterOpen]=useState(false);
  const activeFilters=state.filters.filter(f=>f.value!=='ALL').length;
  return <div className="ff73-toolbar-content">
    <Segmented label="分镜视图" value={state.view} onChange={bridge.navigate} options={[
      {value:'table',label:'表格',icon:<Icons.Table2 size={14}/>},{value:'cards',label:'卡片',icon:<Icons.PanelsTopLeft size={14}/>},
      {value:'wall',label:'视觉墙',icon:<Icons.LayoutGrid size={14}/>},{value:'timeline',label:'时间线',icon:<Icons.GanttChart size={14}/>}
    ]}/>
    <div className="ff73-local-search"><Icons.Search size={14}/><Input type="search" aria-label="搜索当前分镜" placeholder="搜索当前分镜…" value={state.search} onChange={e=>bridge.search(e.target.value)}/></div>
    <span className="ff73-shot-count" aria-live="polite">{state.filtered===state.total?`${state.total} 镜头`:`${state.filtered} / ${state.total}`}</span>
    <div className="ff73-toolbar-actions">
      <IconButton label={state.inspectorOpen?'收起镜头详情':'打开镜头详情'} aria-pressed={state.inspectorOpen} onClick={()=>bridge.action('inspector')}><Icons.PanelRight size={15}/></IconButton>
      <Columns bridge={bridge}/>
      <Popover label="筛选镜头" open={filterOpen} onOpenChange={setFilterOpen} trigger={<Button data-active={activeFilters>0}><Icons.ListFilter size={14}/>筛选{activeFilters>0&&<span className="ff73-count">{activeFilters}</span>}</Button>}>
        {state.filters.map(filter=><Field key={filter.key} label={filter.label}><Select label={filter.label} value={filter.value} options={filter.options} onChange={value=>bridge.filter(filter.key,value)}/></Field>)}
        <div className="ff73-inline ff73-space-between"><span className="ffui-muted">{state.filtered} / {state.total} 镜头</span><Button onClick={()=>bridge.action('clearFilters')} disabled={!activeFilters&&!state.search}>清除筛选</Button></div>
      </Popover>
      <Button onClick={()=>bridge.action('import')}><Icons.Upload size={14}/><span>导入</span></Button>
      <Button onClick={()=>bridge.action('pdf')}><Icons.FileDown size={14}/><span>PDF</span></Button>
      <Popover label="显示设置" trigger={<IconButton label="显示设置"><Icons.SlidersHorizontal size={15}/></IconButton>}>
        <Field label="表格行高"><Select label="表格行高" value={state.rowHeight} onChange={value=>bridge.preference('rowHeight',value)} options={[{value:'compact',label:'紧凑'},{value:'standard',label:'标准'},{value:'comfortable',label:'舒适'},{value:'auto',label:'自动'}]}/></Field>
        <Field label="视觉效果"><Select label="视觉效果" value={state.effects} onChange={value=>bridge.preference('effects',value)} options={[{value:'full',label:'标准透明与动效'},{value:'reduced',label:'减少透明与动效'}]}/></Field>
        <Button onClick={()=>bridge.action('resetLayout')}>恢复面板默认尺寸</Button>
      </Popover>
      <Menu label="更多工具" trigger={<IconButton label="更多工具"><Icons.Ellipsis size={16}/></IconButton>} items={[
        {label:'自动计时',icon:<Icons.Timer size={14}/>,onSelect:()=>bridge.action('timing')},
        {label:'保存视图配置',icon:<Icons.Bookmark size={14}/>,onSelect:()=>bridge.action('saveView')},
        {label:'在当前镜头前插入',icon:<Icons.BetweenHorizontalStart size={14}/>,onSelect:()=>bridge.action('insert')},
        {label:'交付与导出',icon:<Icons.Download size={14}/>,onSelect:()=>bridge.navigate('deliverables')}
      ]}/>
      <Button variant="primary" onClick={()=>bridge.action('addShot')}><Icons.Plus size={15}/><span>新增镜头</span></Button>
    </div>
  </div>;
}
