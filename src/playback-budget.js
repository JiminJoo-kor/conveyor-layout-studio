// Bound work per browser turn; never enlarge the physical integration step.
export class PlaybackBudget {
 constructor({budgetMs=4,stepSeconds=.02,maxPendingSeconds=2,clock=()=>performance.now()}={}){Object.assign(this,{budgetMs,stepSeconds,maxPendingSeconds,clock});this.reset(0);}
 reset(now){this.last=now;this.pending=0;this.actualSpeed=0;this.limited=false;}
 advance(engine,now,speed){
  const elapsed=Math.max(0,(now-this.last)/1000);this.last=now;
  const requested=this.pending+elapsed*Math.max(0,Number(speed)||0);this.pending=Math.min(this.maxPendingSeconds,requested);
  const started=this.clock();let steps=0,advanced=0;
  while(this.pending+1e-9>=this.stepSeconds&&engine.state.t<engine.params.simDuration){
   if(steps&&this.clock()-started>=this.budgetMs)break;
   const before=engine.state.t;engine.step(this.stepSeconds);advanced+=engine.state.t-before;this.pending=Math.max(0,this.pending-this.stepSeconds);steps++;
   if(steps>=Math.ceil(this.maxPendingSeconds/this.stepSeconds))break;
  }
  this.limited=requested>this.maxPendingSeconds||this.pending>=this.stepSeconds;
  if(elapsed>0)this.actualSpeed=this.actualSpeed*.8+(advanced/elapsed)*.2;
  return {steps,advanced,limited:this.limited,actualSpeed:this.actualSpeed};
 }
}
