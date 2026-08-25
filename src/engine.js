import { validateLayout } from './layout.js';
import { connectionAnchor, orthogonalRoute, routeLength } from './route.js';

const findEquipment = (layout, type) => layout.equipment.find(item => item.type === type);
const findAll = (layout, type) => layout.equipment.filter(item => item.type === type);
const nodeIndex = (line, role) => line.nodes.findIndex(node => node.role === role);
const nodeIndexById = (line, id) => line.nodes.findIndex(node => node.id === id);

export const defaultParams = {
  useA: true, useB: false, injectA: 30, injectB: 60, injectC: 20,
  conv2Speed: 5, conv1Speed: 5, pickTime: 2, placeTime: 2,
  station15Time: 60, station16Time: 60, forklift17Time: 30,
  forklift211Time: 30, simDuration: 600
};

const cadDuration=item=>{const p=item?.parameters||{};if(['asrs','stackerCrane'].includes(item?.type)){const travel=12/Math.max(.1,Number(p.travelSpeed||2.5)),lift=Math.max(1,Number(p.levels||1))*1.5/Math.max(.1,Number(p.liftSpeed||1));return Math.max(.2,travel+lift+4);}if(['agv','amr'].includes(item?.type)){const oneWay=Number(p.shuttleDistance||5)/Math.max(.1,Number(p.speed||1.2));return Math.max(.2,oneWay+Number(p.loadTime||2)+Number(p.unloadTime||2));}if(item?.type==='turntable')return Math.max(.2,Number(p.rotationTime||6));if(item?.type==='handoffPoint')return Math.max(.2,Number(p.transferTime||2));if(item?.type==='forkingDevice')return Math.max(.2,Number(p.forkTime||4));return Math.max(.2,Number(p.cycleTime??p.processTime??p.dischargeTime??1));};
export class CadFlowEngine {
  constructor(layout,params={}){this.layout=layout;this.params={...defaultParams,...params};this.nodes=new Map(layout.equipment.filter(item=>item.source?.origin==='dxf'&&item.type!=='processLine').map(item=>[item.id,item]));this.edges=(layout.cadSchematic?.edges||[]).filter(edge=>this.nodes.has(edge.from)&&this.nodes.has(edge.to));this.outgoing=new Map();this.incoming=new Map();for(const edge of this.edges){if(!this.outgoing.has(edge.from))this.outgoing.set(edge.from,[]);this.outgoing.get(edge.from).push(edge);this.incoming.set(edge.to,(this.incoming.get(edge.to)||0)+1);}this.sources=[...this.nodes.values()].filter(node=>node.type==='source'||(!this.incoming.has(node.id)&&this.outgoing.has(node.id)));this.reset();}
  reset(){const storage=[...this.nodes.values()].find(node=>['asrs','stackerCrane'].includes(node.type)),zoneNames=(this.layout.cadSchematic?.inboundBranches||[]).map(branch=>branch.name),names=zoneNames.length?zoneNames:['트림 라인','화이날 라인','도어 라인'],zones=Object.fromEntries(names.map(name=>[name,{inventory:0,capacity:16,putaways:0,retrievals:0}])),capacity=names.length*16,outboundTrucks=Object.fromEntries([...this.nodes.values()].filter(node=>node.type==='dock'&&node.parameters?.dockRole==='outbound').map(node=>[node.id,{loaded:0,capacity:Math.max(1,Number(node.parameters?.truckCapacity||8)),departures:0,lastDeparture:0}]));this.state={t:0,cadTokens:[],nextId:1,nextInjection:0,completedProducts:[],events:[],movedItems:0,locks:{},robot:{phase:'idle'},source:[],product:[],outboundTrucks,asrs:{equipmentId:storage?.id,inventory:0,capacity,zones,putaways:0,retrievals:0,busyTime:0}};return this.state;}
  emit(type,detail={}){this.state.events.push({t:this.state.t,type,...detail});}
  step(dt){const s=this.state;if(!(dt>0)||s.t>=this.params.simDuration)return s;s.t+=Math.min(dt,this.params.simDuration-s.t);if(s.t>=s.nextInjection){for(const [flowIndex,source] of this.sources.entries()){const branch=(this.layout.cadSchematic?.inboundBranches||[]).find(item=>item.nodeIds?.includes(source.id));s.cadTokens.push({id:s.nextId++,nodeId:source.id,createdAt:s.t,readyAt:s.t+cadDuration(source),edge:null,progress:0,flowIndex,flowKey:branch?.name||Object.keys(s.asrs.zones)[flowIndex%Math.max(1,Object.keys(s.asrs.zones).length)]});}s.nextInjection=s.t+Math.max(1,this.params.injectA||30);this.emit('source-injected',{equipmentId:this.sources.map(x=>x.id).join(',')});}
    for(const token of [...s.cadTokens]){if(token.nodeId===s.asrs.equipmentId&&!token.edge)s.asrs.busyTime+=dt;if(token.edge){const fromNode=this.nodes.get(token.edge.from),toNode=this.nodes.get(token.edge.to),from=connectionAnchor(fromNode,token.edge.fromPort),to=connectionAnchor(toNode,token.edge.toPort),zone=s.asrs.zones[token.flowKey];if(toNode.id===s.asrs.equipmentId&&zone&&zone.inventory>=zone.capacity)continue;const distance=Math.max(40,routeLength(orthogonalRoute(from,to))),lineSpeed=Number(fromNode.parameters?.lineSpeed),speed=Math.max(.2,Number(fromNode.parameters?.speed??(Number.isFinite(lineSpeed)?lineSpeed/20:1)));token.progress+=dt*speed*90/distance;if(token.progress>=1){token.nodeId=toNode.id;token.edge=null;token.progress=0;token.readyAt=s.t+cadDuration(toNode);s.movedItems++;if(toNode.id===s.asrs.equipmentId){s.asrs.inventory=Math.min(s.asrs.capacity,s.asrs.inventory+1);s.asrs.putaways++;if(zone){zone.inventory++;zone.putaways++;}this.emit('asrs-putaway',{equipmentId:toNode.id,zone:token.flowKey});}this.emit('equipment-start',{equipmentId:toNode.id});}}else if(s.t>=token.readyAt){const options=this.outgoing.get(token.nodeId)||[];if(options.length){if(token.nodeId===s.asrs.equipmentId){const zone=s.asrs.zones[token.flowKey];s.asrs.inventory=Math.max(0,s.asrs.inventory-1);s.asrs.retrievals++;if(zone){zone.inventory=Math.max(0,zone.inventory-1);zone.retrievals++;}this.emit('asrs-retrieval',{equipmentId:token.nodeId,zone:token.flowKey});}token.edge=options[token.flowIndex%options.length];token.progress=0;}else{const truck=s.outboundTrucks?.[token.nodeId];if(truck){truck.loaded++;if(truck.loaded>=truck.capacity){truck.departures++;truck.loaded=0;truck.lastDeparture=s.t;this.emit('truck-departed',{equipmentId:token.nodeId,departures:truck.departures});}}s.completedProducts.push({id:token.id,cycleTime:s.t-token.createdAt});s.cadTokens.splice(s.cadTokens.indexOf(token),1);this.emit('equipment-complete',{equipmentId:token.nodeId,productId:token.id});}}}return s;}
  getKpis(){const completed=this.state.completedProducts,elapsed=Math.max(this.state.t,1),cycleTime=completed.length?completed.reduce((sum,item)=>sum+item.cycleTime,0)/completed.length:0,asrs=this.state.asrs;return{mode:'cad',throughput:completed.length/elapsed*3600,cycleTime,wip:this.state.cadTokens.length,bottleneck:asrs?.busyTime/elapsed>.8?['asrs',asrs.busyTime/elapsed]:null,movedItems:this.state.movedItems,utilization:{robot:0,asrs:asrs?.busyTime/elapsed||0},asrs:{...asrs,occupancy:asrs?asrs.inventory/asrs.capacity:0}};}
}

export function validateParams(params) {
  const errors = [];
  const positive = ['injectA','injectB','injectC','conv2Speed','conv1Speed','forklift17Time','forklift211Time','simDuration'];
  const nonNegative = ['pickTime','placeTime','station15Time','station16Time'];
  for (const key of positive) if (!Number.isFinite(params[key]) || params[key] <= 0) errors.push(`${key}는 0보다 커야 합니다.`);
  for (const key of nonNegative) if (!Number.isFinite(params[key]) || params[key] < 0) errors.push(`${key}는 0 이상이어야 합니다.`);
  if (!params.useA && !params.useB) errors.push('A 또는 B 트레이를 하나 이상 사용해야 합니다.');
  return { valid: errors.length === 0, errors };
}

export class SimulationEngine {
  constructor(layout, params = {}) {
    const layoutCheck = validateLayout(layout);
    if (!layoutCheck.valid) throw new Error(layoutCheck.errors.join(' '));
    this.layout = layout;
    this.params = { ...defaultParams, ...params };
    const paramCheck = validateParams(this.params);
    if (!paramCheck.valid) throw new Error(paramCheck.errors.join(' '));
    const lines = layout.equipment.filter(item => item.type === 'conveyor');
    this.sourceLine = lines.find(line => line.trayKinds.includes('A'));
    this.productLine = lines.find(line => line.trayKinds.includes('C'));
    this.robotConfig = findEquipment(layout, 'robot');
    this.stations = findAll(layout, 'station');
    this.forklifts = findAll(layout, 'forklift');
    this.reset();
  }

  reset() {
    const p = this.params;
    this.state = {
      t: 0, source: Array(this.sourceLine.nodes.length).fill(null), product: Array(this.productLine.nodes.length).fill(null),
      nextA: 0, nextB: 0, nextC: 0, nextSourceKind: 'A', nextId: 1,
      sourceTick: p.conv2Speed, productTick: p.conv1Speed,
      robot: { phase: 'idle', until: 0, sourceId: null, productId: null, isLast: false },
      locks: {}, metrics: { robotBusy: 0, station15Busy: 0, station16Busy: 0, forklift17Busy: 0, forklift211Busy: 0 },
      events: [], completedSources: [], completedProducts: [], productArrivals: 0, movedItems: 0
    };
    return this.state;
  }

  emit(type, detail = {}) { this.state.events.push({ t: this.state.t, type, ...detail }); }
  makeSource(kind) { return { id: this.state.nextId++, kind, items: kind === 'A' ? 4 : 1, capacity: kind === 'A' ? 4 : 1 }; }
  makeProduct() { return { id: this.state.nextId++, kind: 'C', items: 0, capacity: 8 }; }

  step(dt) {
    const s = this.state, p = this.params;
    if (!(dt > 0) || s.t >= p.simDuration) return s;
    dt = Math.min(dt, p.simDuration - s.t);
    if (s.robot.phase !== 'idle') s.metrics.robotBusy += dt;
    for (const [id, lock] of Object.entries(s.locks)) if (lock) {
      const metric = id === 'station-15' ? 'station15Busy' : id === 'station-16' ? 'station16Busy' : id === 'forklift-17' ? 'forklift17Busy' : 'forklift211Busy';
      s.metrics[metric] += dt;
    }
    s.t += dt;
    this.inject();
    this.moveSourceLine();
    this.moveProductLine();
    this.releaseLocks();
    this.runRobot();
    return s;
  }

  runUntil(seconds, dt = 0.05) {
    const end = Math.min(seconds, this.params.simDuration);
    while (this.state.t + 1e-9 < end) this.step(Math.min(dt, end - this.state.t));
    return this.state;
  }

  inject() {
    const s = this.state, p = this.params;
    const entry = nodeIndex(this.sourceLine, 'source-entry');
    if (!s.source[entry]) {
      const dueA = p.useA && s.t >= s.nextA, dueB = p.useB && s.t >= s.nextB;
      const kind = dueA && dueB ? s.nextSourceKind : dueA ? 'A' : dueB ? 'B' : null;
      if (kind) {
        const tray = this.makeSource(kind); s.source[entry] = tray;
        if (kind === 'A') { s.nextA = s.t + p.injectA; s.nextSourceKind = 'B'; }
        else { s.nextB = s.t + p.injectB; s.nextSourceKind = 'A'; }
        this.emit('source-injected', { trayId: tray.id, kind });
      }
    }
    const productEntry = nodeIndex(this.productLine, 'product-entry');
    if (!s.product[productEntry] && s.t >= s.nextC) {
      const tray = this.makeProduct(); s.product[productEntry] = tray; s.nextC = s.t + p.injectC;
      this.emit('product-injected', { trayId: tray.id });
    }
  }

  moveSourceLine() {
    const s = this.state, p = this.params;
    if (s.t < s.sourceTick) return;
    const pick = nodeIndex(this.sourceLine, 'robot-pick');
    for (let i = 0; i < s.source.length - 1; i++) {
      const tray = s.source[i + 1];
      if (s.source[i] || !tray || (i + 1 === pick && tray.items > 0)) continue;
      if (i === 0 && s.locks['forklift-211']) continue;
      s.source[i] = tray; s.source[i + 1] = null;
      if (i === 0) this.startLock('forklift-211', tray, p.forklift211Time);
    }
    s.sourceTick = s.t + p.conv2Speed;
  }

  moveProductLine() {
    const s = this.state, p = this.params;
    if (s.t < s.productTick) return;
    const place = nodeIndex(this.productLine, 'robot-place');
    for (let i = 0; i < s.product.length - 1; i++) {
      const tray = s.product[i + 1];
      if (s.product[i] || !tray || (i + 1 === place && tray.items < tray.capacity)) continue;
      const nodeId = this.productLine.nodes[i].id;
      const equipment = [...this.stations, ...this.forklifts].find(item => item.nodeId === nodeId);
      if (equipment && s.locks[equipment.id]) continue;
      s.product[i] = tray; s.product[i + 1] = null;
      if (equipment) {
        const duration = p[equipment.durationParam];
        this.startLock(equipment.id, tray, duration);
        if (equipment.id === 'forklift-17') s.productArrivals++;
      }
    }
    s.productTick = s.t + p.conv1Speed;
  }

  startLock(id, tray, duration) {
    this.state.locks[id] = { trayId: tray.id, until: this.state.t + duration };
    this.emit('equipment-start', { equipmentId: id, trayId: tray.id });
  }

  releaseLocks() {
    const s = this.state;
    for (const [id, lock] of Object.entries(s.locks)) {
      if (!lock || s.t < lock.until) continue;
      const config = [...this.stations, ...this.forklifts].find(item => item.id === id);
      if (config?.type === 'forklift') {
        const line = config.nodeId.startsWith('2-') ? this.sourceLine : this.productLine;
        const slots = line === this.sourceLine ? s.source : s.product;
        const index = nodeIndexById(line, config.nodeId);
        const tray = slots[index]; slots[index] = null;
        if (line === this.productLine && tray) s.completedProducts.push({ id: tray.id, completedAt: s.t });
      }
      this.emit('equipment-complete', { equipmentId: id, trayId: lock.trayId });
      s.locks[id] = null;
    }
  }

  runRobot() {
    const s = this.state, p = this.params;
    const pick = nodeIndexById(this.sourceLine, this.robotConfig.pickNode);
    const place = nodeIndexById(this.productLine, this.robotConfig.placeNode);
    const src = s.source[pick], dst = s.product[place];
    if (s.robot.phase === 'idle' && src?.items > 0 && dst && dst.items < dst.capacity) {
      s.robot = { phase: 'pick', until: s.t + p.pickTime, sourceId: src.id, productId: dst.id, isLast: src.items === 1 };
      this.emit('robot-pick-start', { trayId: src.id });
    }
    if (s.robot.phase === 'pick' && s.t >= s.robot.until) {
      const current = s.source[pick]; if (current?.id === s.robot.sourceId) current.items--;
      s.robot.phase = 'place'; s.robot.until = s.t + p.placeTime;
    }
    if (s.robot.phase === 'place' && s.t >= s.robot.until) {
      const currentDst = s.product[place];
      if (currentDst?.id === s.robot.productId) { currentDst.items++; s.movedItems++; }
      const sourceId = s.robot.sourceId, wasLast = s.robot.isLast;
      s.robot = { phase: 'idle', until: 0, sourceId: null, productId: null, isLast: false };
      this.emit('robot-place-complete', { trayId: sourceId, productId: currentDst?.id });
      if (wasLast) {
        s.completedSources.push({ id: sourceId, completedAt: s.t });
        s.sourceTick = s.t;
      }
      if (currentDst?.items >= currentDst?.capacity) s.productTick = s.t;
    }
  }

  getKpis() {
    const s = this.state, elapsed = Math.max(s.t, 0.001);
    const utilization = {
      robot: s.metrics.robotBusy / elapsed,
      station15: s.metrics.station15Busy / elapsed,
      station16: s.metrics.station16Busy / elapsed,
      forklift17: s.metrics.forklift17Busy / elapsed,
      forklift211: s.metrics.forklift211Busy / elapsed
    };
    const bottleneck = Object.entries(utilization).sort((a, b) => b[1] - a[1])[0];
    return {
      throughput: s.productArrivals / elapsed * 3600,
      wip: s.source.filter(Boolean).length + s.product.filter(Boolean).length,
      movedItems: s.movedItems, utilization,
      bottleneck: bottleneck[1] > 0 ? bottleneck : null
    };
  }
}
